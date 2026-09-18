// Shared "has this field been changed from what was originally loaded" helper for the recipe
// editors (PicoPackEditor.tsx and RecipeEditor/index.tsx). Deliberately separate from any other
// editor concern (validation, AI sidekick state, etc.) — it's just a per-field comparison plus a
// text color class to flag the diff, so the user can see at a glance what they've actually
// changed before hitting Save.
//
// Only meaningful when editing an existing record: a brand-new recipe has no "original" to diff
// against, so callers gate this on `active` (e.g. `Boolean(recipe) && !readOnly`) rather than
// comparing against an empty/default original, which would flag everything as dirty.

// A warm accent distinct from this app's semantic colors (danger=red, success=green, info=blue,
// brand=primary action) so a "changed" field doesn't read as an error or a call to action.
export const DIRTY_FIELD_CLASS = 'text-accent-lime-500';

export function dirtyClass(current: unknown, original: unknown, active: boolean): string | undefined {
  if (!active) {
    return undefined;
  }
  return current !== original ? DIRTY_FIELD_CLASS : undefined;
}
