import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { useLoaderData, Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import { useState, type FC } from 'react';
import { MdAdd, MdArrowDownward, MdArrowUpward, MdContentCopy, MdDelete, MdEdit, MdMoreVert } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { RecipeRepository } from '~/repositories/recipe.server';

export const meta = () => [{ title: 'Recipes | RePicoBrew' }];

type SortKey = 'name' | 'style' | 'abv' | 'ibu' | 'sessions' | 'type';
type SortDir = 'asc' | 'desc';
const SORT_KEYS: SortKey[] = ['name', 'style', 'abv', 'ibu', 'sessions', 'type'];
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  style: 'asc',
  abv: 'desc',
  ibu: 'desc',
  sessions: 'desc',
  type: 'asc',
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const sortParam = url.searchParams.get('sort');
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'name';
  const dirParam = url.searchParams.get('dir');
  const dir: SortDir = dirParam === 'asc' || dirParam === 'desc' ? dirParam : DEFAULT_DIR[sort];

  const recipes = await RecipeRepository.getAllRecipesWithSessionCounts();
  const sorted = [...recipes].sort((a, b) => {
    const cmp = (() => {
      switch (sort) {
        case 'style':
          return (a.style ?? '').localeCompare(b.style ?? '');
        case 'abv':
          return a.abv - b.abv;
        case 'ibu':
          return a.ibu - b.ibu;
        case 'sessions':
          return a.sessionCount - b.sessionCount;
        case 'type':
          return a.deviceType.localeCompare(b.deviceType);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    })();
    return dir === 'asc' ? cmp : -cmp;
  });

  return { recipes: sorted, sort, dir };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    const id = parseInt(formData.get('id') as string);
    await RecipeRepository.deleteRecipe(id);
    return { success: true };
  }

  if (intent === 'duplicate') {
    const id = parseInt(formData.get('id') as string);
    await RecipeRepository.duplicateRecipe(id);
    return { success: true };
  }

  return data({ error: 'Unknown intent' }, { status: 400 });
};

const columns = '1.6fr 1.1fr 0.8fr 0.8fr 0.9fr 1fr 1fr';

type Recipe = ReturnType<typeof useLoaderData<typeof loader>>['recipes'][number];

const SortableHeader: FC<{ label: string; sortKey: SortKey; activeSort: SortKey; dir: SortDir; href: string }> = ({
  label,
  sortKey,
  activeSort,
  dir,
  href,
}) => {
  const isActive = activeSort === sortKey;
  return (
    <Link to={href} className="no-underline">
      <div
        className={`flex items-center gap-1 hover:text-ink-text ${isActive ? 'text-ink-text' : 'text-ink-text-faint'}`}
      >
        <span>{label}</span>
        {isActive && (dir === 'asc' ? <MdArrowUpward className="size-3" /> : <MdArrowDownward className="size-3" />)}
      </div>
    </Link>
  );
};

const RecipeRow: FC<{ recipe: Recipe; onRequestDelete: (recipe: Recipe) => void }> = ({ recipe, onRequestDelete }) => {
  const navigate = useNavigate();
  const duplicateFetcher = useFetcher();

  return (
    <div
      className="grid min-w-[720px] cursor-pointer items-center border-b border-ink-divider px-5 py-4 hover:bg-ink-card-hover"
      style={{ gridTemplateColumns: columns }}
      onClick={() => navigate(`/recipes/${recipe.id}?mode=view`)}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="size-[7px] shrink-0 rounded-full bg-brand-500" />
        <p className="truncate text-sm font-bold">{recipe.name}</p>
      </div>
      <p className="text-[13px] text-ink-text-secondary">{recipe.style || '-'}</p>
      <span className="w-fit rounded-md bg-brand-100 px-2 py-[3px] text-[11px] font-bold text-brand-500">
        {recipe.abv.toFixed(1)}%
      </span>
      <span className="w-fit rounded-md bg-accent-lime-100 px-2 py-[3px] text-[11px] font-bold text-accent-lime-500">
        {recipe.ibu} IBU
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="w-fit font-mono text-[13px] text-ink-text-secondary">
            {recipe.completedSessionCount}/{recipe.sessionCount}
          </p>
        </TooltipTrigger>
        <TooltipContent>
          {recipe.completedSessionCount} completed out of {recipe.sessionCount}{' '}
          {recipe.sessionCount === 1 ? 'session' : 'sessions'}
        </TooltipContent>
      </Tooltip>
      <span className="w-fit rounded-md bg-info-100 px-2 py-[3px] text-[11px] font-bold text-info-500">
        {recipe.deviceType}
      </span>
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Recipe actions" variant="ghost" size="icon">
              <MdMoreVert className="size-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/recipes/${recipe.id}`)}>
              <MdEdit className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={duplicateFetcher.state !== 'idle'}
              onClick={() =>
                duplicateFetcher.submit({ intent: 'duplicate', id: String(recipe.id) }, { method: 'post' })
              }
            >
              <MdContentCopy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem variant="danger" onClick={() => onRequestDelete(recipe)}>
              <MdDelete className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default function RecipesPage() {
  const { recipes, sort, dir } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const deleteFetcher = useFetcher();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const sortHref = (key: SortKey) => {
    let nextDir: SortDir = DEFAULT_DIR[key];
    if (sort === key) {
      nextDir = dir === 'asc' ? 'desc' : 'asc';
    }
    const params = new URLSearchParams(searchParams);
    params.set('sort', key);
    params.set('dir', nextDir);
    return `?${params.toString()}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[26px] font-bold tracking-[-0.3px]">Recipes</p>
          <p className="mt-1 text-sm text-ink-text-dim">Manage your brewing recipes</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand-100 px-3 py-[5px] text-xs font-bold text-brand-500">
            {recipes.length} Total
          </span>
          <Link to="/recipes/new">
            <Button variant="brand" size="sm">
              <MdAdd />
              New Recipe
            </Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 py-16">
            <p className="text-lg font-bold">No Recipes Yet</p>
            <p className="max-w-[380px] text-center text-sm text-ink-text-faint">
              Create your first recipe to start brewing with your Pico device
            </p>
            <Link to="/recipes/new">
              <Button variant="brand">
                <MdAdd />
                Create Your First Recipe
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[720px] border-b border-ink-divider px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.5px] text-ink-text-faint"
              style={{ gridTemplateColumns: columns }}
            >
              <SortableHeader label="Name" sortKey="name" activeSort={sort} dir={dir} href={sortHref('name')} />
              <SortableHeader label="Style" sortKey="style" activeSort={sort} dir={dir} href={sortHref('style')} />
              <SortableHeader label="ABV" sortKey="abv" activeSort={sort} dir={dir} href={sortHref('abv')} />
              <SortableHeader label="IBU" sortKey="ibu" activeSort={sort} dir={dir} href={sortHref('ibu')} />
              <SortableHeader
                label="Sessions"
                sortKey="sessions"
                activeSort={sort}
                dir={dir}
                href={sortHref('sessions')}
              />
              <SortableHeader label="Type" sortKey="type" activeSort={sort} dir={dir} href={sortHref('type')} />
              <div />
            </div>
            {recipes.map((recipe) => (
              <RecipeRow
                key={recipe.id}
                recipe={recipe}
                onRequestDelete={(r) => setDeleteTarget({ id: r.id, name: r.name })}
              />
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this recipe?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-text-secondary">
            This removes {deleteTarget?.name} from your recipe list. This can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              disabled={deleteFetcher.state !== 'idle'}
              onClick={() => {
                if (!deleteTarget) {
                  return;
                }
                deleteFetcher.submit({ intent: 'delete', id: String(deleteTarget.id) }, { method: 'post' });
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
