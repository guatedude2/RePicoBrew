import { useEffect } from 'react';
import { useBlocker, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';

// Asks before leaving a form with unsaved edits — both in-app navigation (sidebar, links, back) and
// closing/reloading the tab. Submitting the form itself never triggers it: a save keeps the same
// URL while it runs and then redirects, so anything in flight is let through.
export const UnsavedChangesPrompt = ({ when }: { when: boolean }) => {
  const navigation = useNavigation();
  const saving = navigation.state !== 'idle';
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      !saving &&
      currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search,
  );

  useEffect(() => {
    if (!when) {
      return;
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [when]);

  return (
    <Dialog open={blocker.state === 'blocked'} onOpenChange={(open) => !open && blocker.reset?.()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-ink-text-secondary">
          You have edits to this recipe that haven&apos;t been saved. If you leave now they will be lost.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => blocker.reset?.()}>
            Keep Editing
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            Discard Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
