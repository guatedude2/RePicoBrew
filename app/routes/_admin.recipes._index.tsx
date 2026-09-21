import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { useLoaderData, Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import { useState, type FC } from 'react';
import {
  MdAdd,
  MdArrowDownward,
  MdArrowUpward,
  MdChevronRight,
  MdContentCopy,
  MdDelete,
  MdDownload,
  MdEdit,
  MdMoreVert,
} from 'react-icons/md';
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
import { PicobrewImportModal } from '~/components/recipes/PicobrewImportModal';
import { cn } from '~/lib/utils';
import { RecipeRepository } from '~/repositories/recipe.server';
import { RecipePackType } from '~/types';
import { formatAbv, formatIbu } from '~/utils/brew-stats';

export const meta = () => [{ title: 'Recipes | RePicoBrew' }];

const PACK_TYPE_LABEL: Record<string, string> = {
  [RecipePackType.PICOPACK]: 'PicoPack',
  [RecipePackType.ZPACK]: 'ZPack',
};

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
          return a.packType.localeCompare(b.packType);
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
    const copy = await RecipeRepository.duplicateRecipe(id);
    return { success: true, id: copy.id };
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

type FormatOption = {
  format: 'picopack' | 'zpack';
  badge: string;
  badgeClass: string;
  title: string;
  description: string;
  href: string;
};

const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: 'picopack',
    badge: 'PICOPACK',
    badgeClass: 'bg-info-100 text-info-500',
    title: 'PicoPack',
    description: 'Steps-only recipe, fixed 5L batch. Quick to build, just the machine step sequence.',
    href: '/recipes/new-picopack',
  },
  {
    format: 'zpack',
    badge: 'ZPACK',
    badgeClass: 'bg-brand-100 text-brand-500',
    title: 'ZPack (Advanced)',
    description: 'Full brew science: water, mash, fermentables, boil, hops, yeast, fermentation, plus machine steps.',
    href: '/recipes/new',
  },
];

const NewRecipeModal: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportFromPicobrew: () => void;
}> = ({ open, onOpenChange, onImportFromPicobrew }) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<'picopack' | 'zpack'>('zpack');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Recipe</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-ink-text-dim">Choose the recipe format for your Pico device.</p>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              onClick={() => setSelected(option.format)}
              className={cn(
                'flex flex-col gap-2 rounded-[10px] border bg-ink-card p-[18px] text-left transition-colors',
                selected === option.format
                  ? 'border-brand-500'
                  : 'border-ink-card-border hover:border-ink-border-strong',
              )}
            >
              <span className={cn('w-fit rounded-md px-2 py-[3px] text-[11px] font-bold', option.badgeClass)}>
                {option.badge}
              </span>
              <p className="text-[15px] font-bold">{option.title}</p>
              <p className="text-xs leading-relaxed text-ink-text-faint">{option.description}</p>
            </button>
          ))}
        </div>

        <div className="border-t border-ink-divider pt-4">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onImportFromPicobrew();
            }}
            className="flex w-full items-center gap-3.5 rounded-[10px] border border-ink-card-border bg-ink-card p-[14px] text-left transition-colors hover:border-brand-500"
          >
            <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-ink-bg text-info-500">
              <MdDownload className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-sm font-bold">Import from PicoBrew</p>
              <p className="text-xs text-ink-text-faint">Search the official &amp; community recipe library</p>
            </span>
            <MdChevronRight className="size-5 flex-none text-ink-text-faint" />
          </button>
        </div>

        <DialogFooter>
          <Button
            variant="brand"
            onClick={() => {
              onOpenChange(false);
              navigate(FORMAT_OPTIONS.find((o) => o.format === selected)!.href);
            }}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      {recipe.abv >= 0 ? (
        <span className="w-fit rounded-md bg-brand-100 px-2 py-[3px] text-[11px] font-bold text-brand-500">
          {formatAbv(recipe.abv, { unit: false })}
        </span>
      ) : (
        <span />
      )}
      {recipe.ibu >= 0 ? (
        <span className="w-fit rounded-md bg-accent-lime-100 px-2 py-[3px] text-[11px] font-bold text-accent-lime-500">
          {formatIbu(recipe.ibu)}
        </span>
      ) : (
        <span />
      )}
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
      <span
        className={cn(
          'w-fit rounded-md px-2 py-[3px] text-[11px] font-bold',
          recipe.packType === RecipePackType.PICOPACK ? 'bg-info-100 text-info-500' : 'bg-brand-100 text-brand-500',
        )}
      >
        {PACK_TYPE_LABEL[recipe.packType] ?? recipe.packType}
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
  const [newRecipeOpen, setNewRecipeOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

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
          <Button variant="brand" size="sm" onClick={() => setNewRecipeOpen(true)}>
            <MdAdd />
            New Recipe
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 py-16">
            <p className="text-lg font-bold">No Recipes Yet</p>
            <p className="max-w-[380px] text-center text-sm text-ink-text-faint">
              Create your first recipe to start brewing with your Pico device
            </p>
            <Button variant="brand" onClick={() => setNewRecipeOpen(true)}>
              <MdAdd />
              Create Your First Recipe
            </Button>
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

      <NewRecipeModal
        open={newRecipeOpen}
        onOpenChange={setNewRecipeOpen}
        onImportFromPicobrew={() => setImportModalOpen(true)}
      />
      <PicobrewImportModal open={importModalOpen} onOpenChange={setImportModalOpen} />
    </>
  );
}
