import { useFetcher, useNavigate } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { MdDownload, MdSearch } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Select } from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { formatAbv, formatIbu } from '~/utils/brew-stats';
import { srmSwatchUrl } from '~/utils/srm-swatch';

// ZPak/Community are both PicoBrew's full brew-science format (fermentables/hops/yeast/mash
// steps); PicoPak is the steps-only format. "Community" is community-submitted recipes only —
// ZPak's official library is excluded from it server-side to avoid duplicate listings.
type Tab = 'zpak' | 'community' | 'picopak';
const TAB_LABEL: Record<Tab, string> = { zpak: 'ZPak', community: 'Community', picopak: 'PicoPak' };

type SortValue = 'name-asc' | 'name-desc' | 'abv-desc' | 'abv-asc' | 'ibu-desc' | 'ibu-asc';

const SORT_OPTIONS: Array<{ value: SortValue; label: string }> = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'abv-desc', label: 'ABV (High-Low)' },
  { value: 'abv-asc', label: 'ABV (Low-High)' },
  { value: 'ibu-desc', label: 'IBU (High-Low)' },
  { value: 'ibu-asc', label: 'IBU (Low-High)' },
];

type ResultItem = {
  id: string;
  name: string;
  style: string | null;
  author: string | null;
  abv: number;
  ibu: number;
  og: number | null;
  fg: number | null;
  srm: number | null;
};

type SearchResponse = {
  items: ResultItem[];
  total: number;
  page: number;
  pageSize: number;
};

export const PicobrewImportModal: FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('zpak');
  const [query, setQuery] = useState('');
  const [sortValue, setSortValue] = useState<SortValue>('name-asc');
  const [items, setItems] = useState<ResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchFetcher = useFetcher<SearchResponse>();
  const importFetcher = useFetcher<{ success?: boolean; recipeId?: number; error?: string }>();

  const [sortKey, sortDir] = sortValue.split('-') as ['name' | 'abv' | 'ibu', 'asc' | 'desc'];

  useEffect(() => {
    if (!open) {
      return;
    }
    const params = new URLSearchParams({ tab, page: String(page), sort: sortKey, dir: sortDir });
    if (query.trim()) {
      params.set('q', query.trim());
    }
    const timeout = setTimeout(() => {
      searchFetcher.load(`/api/picobrew-recipes?${params.toString()}`);
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, query, page, sortKey, sortDir]);

  useEffect(() => {
    if (searchFetcher.data) {
      setItems((prev) =>
        searchFetcher.data!.page === 1 ? searchFetcher.data!.items : [...prev, ...searchFetcher.data!.items],
      );
      setTotal(searchFetcher.data.total);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFetcher.data]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setPage(1);
      setTab('zpak');
      setSortValue('name-asc');
      setItems([]);
      setTotal(0);
      setSelectedId(null);
    }
  }, [open]);

  // Any change to the filters themselves (not `page`) restarts from page 1.
  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [tab, query, sortValue]);

  useEffect(() => {
    if (importFetcher.state === 'idle' && importFetcher.data?.success && importFetcher.data.recipeId) {
      const recipeId = importFetcher.data.recipeId;
      onOpenChange(false);
      navigate(`/recipes/${recipeId}?mode=edit`);
    }
  }, [importFetcher.state, importFetcher.data, navigate, onOpenChange]);

  const handleImport = () => {
    if (!selectedId) {
      return;
    }
    importFetcher.submit(JSON.stringify({ intent: 'import', tab, id: selectedId }), {
      method: 'post',
      action: '/api/picobrew-recipes',
      encType: 'application/json',
    });
  };

  const isSearching = searchFetcher.state !== 'idle';
  const isImporting = importFetcher.state !== 'idle';
  const hasMore = items.length < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Import from PicoBrew</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-ink-text-dim">Browse the official PicoBrew library and community recipes.</p>

        <div className="flex flex-wrap gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipes or styles..."
            className="min-w-[200px] flex-1"
          />
          <Select
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value as SortValue)}
            className="w-fit min-w-[170px]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-text-faint">
            {total} recipe{total === 1 ? '' : 's'}
          </p>
          <div className="flex rounded-lg border border-ink-card-border p-0.5">
            {(['picopak', 'zpak', 'community'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors',
                  tab === t ? 'bg-brand-500 text-ink-on-brand' : 'text-ink-text-secondary hover:text-ink-text',
                )}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[320px] overflow-y-auto">
          {isSearching && items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-text-faint">Loading…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-ink-bg">
                <MdSearch className="size-6 text-ink-text-faint" />
              </span>
              <p className="text-sm font-bold">No recipes found</p>
              <p className="text-xs text-ink-text-faint">Try a different search term or check the spelling.</p>
              {query && (
                <Button size="sm" variant="outline" className="mt-1" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-[10px] border bg-ink-card p-3 text-left transition-colors',
                    selectedId === item.id
                      ? 'border-brand-500'
                      : 'border-ink-card-border hover:border-ink-border-strong',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={srmSwatchUrl(item.srm) ?? '/img/no-photo.jpg'}
                      alt=""
                      className="size-9 flex-none rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold leading-tight">{item.name}</p>
                      {item.style && <p className="truncate text-xs text-ink-text-secondary">{item.style}</p>}
                    </div>
                  </div>
                  {(item.abv >= 0 || item.ibu >= 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.abv >= 0 && (
                        <span className="rounded-md bg-brand-100 px-1.5 py-[2px] text-[10px] font-bold text-brand-500">
                          {formatAbv(item.abv)}
                        </span>
                      )}
                      {item.ibu >= 0 && (
                        <span className="rounded-md bg-brand-100 px-1.5 py-[2px] text-[10px] font-bold text-brand-500">
                          {formatIbu(item.ibu)}
                        </span>
                      )}
                    </div>
                  )}
                  {item.author && <p className="text-[11px] text-ink-text-faint">By {item.author}</p>}
                </button>
              ))}
            </div>
          )}
          {hasMore && !isSearching && (
            <div className="flex justify-center pt-3">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)}>
                Load more
              </Button>
            </div>
          )}
          {importFetcher.data?.error && (
            <p className="mt-2 text-center text-xs text-danger-500">{importFetcher.data.error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="brand" disabled={!selectedId || isImporting} onClick={handleImport}>
            <MdDownload className="size-4" />
            {isImporting ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
