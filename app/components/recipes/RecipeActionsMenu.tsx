import { useEffect, useState, type FC } from 'react';
import { useFetcher, useNavigate } from 'react-router';
import { MdContentCopy, MdDelete, MdMoreVert } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';

// The same Duplicate / Delete actions as the row menu on the Recipes list (both post to that route's
// action), for use on a recipe's own page. Afterwards it follows the result: to the new copy after a
// duplicate, back to the list after a delete.
export const RecipeActionsMenu: FC<{ recipe: { id: number; name: string } }> = ({ recipe }) => {
  const navigate = useNavigate();
  const fetcher = useFetcher<{ success?: boolean; id?: number }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data?.success) {
      return;
    }
    navigate(fetcher.data.id ? `/recipes/${fetcher.data.id}?mode=view` : '/recipes');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  const post = (intent: 'duplicate' | 'delete') =>
    // No revalidation: this page is about to be left, and reloading a just-deleted recipe would 404.
    fetcher.submit(
      { intent, id: String(recipe.id) },
      { method: 'post', action: '/recipes', defaultShouldRevalidate: false },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Recipe actions" variant="outline" size="icon" disabled={busy}>
            <MdMoreVert className="size-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={busy} onClick={() => post('duplicate')}>
            <MdContentCopy className="size-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem variant="danger" onClick={() => setConfirmDelete(true)}>
            <MdDelete className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this recipe?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            This removes {recipe.name} from your recipe list. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                post('delete');
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
