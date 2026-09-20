import { useFetcher, useMatches, useNavigate } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GiHops } from 'react-icons/gi';
import { MdClose, MdDeleteSweep, MdMenuBook, MdSend } from 'react-icons/md';
import { useAiSidekickBridge } from './AiSidekickContext';
import { ChatMarkdown } from './ChatMarkdown';
import type { AiChatAction } from '~/services/ai-chat-assistant.server';
import type { PicoPackAiRecipe, ZPackAiRecipe } from '~/services/ai-recipe-generator.server';

// "AI Brewmaster" sidekick: a persistent floating action button (bottom-right, hop-cone icon) that
// expands into a small chat-style panel. Rendered exactly once, globally, from MainLayout — see
// that file — so it's visible on every page instead of being embedded per-editor. It automatically
// figures out what it's chatting about from the current route (see useAiChatScope below) and,
// server-side, every exchange is persisted to that scope's own AiChatThread (app/routes/api.ai-
// chat.ts, app/routes/api.ai-recipe.ts), so history survives closing the panel, navigating away,
// and reloading — only the open/closed panel state itself is ephemeral per page load.
//
// Two distinct modes, chosen automatically:
//  - Recipe generate/edit: active whenever a recipe editor (PicoPackEditor / RecipeEditor) is
//    mounted and registers itself via useRegisterAiRecipeBridge (AiSidekickContext.tsx) — same
//    "draft or tweak this exact recipe, never auto-save" behavior the sidekick always had, just
//    relocated out of the editor's own render tree.
//  - Open-ended chat: everywhere else (Dashboard, Recipes/Sessions lists, Settings, a read-only
//    recipe view, a session detail page, ...) — free-form conversation via /api/ai-chat, plus two
//    concrete actions ("create me a new recipe", "start a new session on <device>") when the scope
//    is 'general'. Both actions hand back a pre-filled draft for the client to navigate to and the
//    user to review/confirm — nothing is ever saved directly from chat.

const GENERATE_EXAMPLES = [
  'a hoppy citrus IPA around 6% ABV',
  'a light session lager for summer',
  'a big, roasty imperial stout',
  'a malty Oktoberfest-style lager',
];
const EDIT_EXAMPLES = ['add more bitterness', 'make this maltier', 'increase the ABV a bit', 'make it lighter bodied'];
const GENERAL_EXAMPLES = [
  'create me a new recipe',
  'start a new session on my Pico',
  'how do I clean the machine?',
  'what temperature should fermentation be?',
];
const SESSION_EXAMPLES = ["how's this batch looking?", 'what should I watch out for next?', 'update this recipe'];
const RECIPE_VIEW_EXAMPLES = ['how would I make this hoppier?', 'what style is this closest to?', 'update this recipe'];

// Warm amber/hop-gold accent for the sidekick's own branding — distinct from the app's blue/brand
// accent so the floating widget reads as its own thing, not just another primary button.
const ACCENT = 'oklch(0.7 0.16 65)';
const ACCENT_SOFT = 'oklch(0.7 0.16 65 / 0.16)';

type AiChatScope = 'general' | 'recipe' | 'session';

type ChatMessageRow = { id: number; role: 'user' | 'assistant'; content: string; createdAt: string };
type HistoryResponse = { threadId: number; messages: ChatMessageRow[] };
type RecipeGenResponse =
  | { success: true; recipe: PicoPackAiRecipe | ZPackAiRecipe; explanation: string; suggestions: string[] }
  | { error: string };
type GeneralChatResponse = { success: true; reply: string; action: AiChatAction | null } | { error: string };

// Route ids come from file-based routing (flatRoutes): `_admin.recipes.$id.tsx` and
// `_admin.sessions.$id.tsx` become `routes/_admin.recipes.$id` / `routes/_admin.sessions.$id` —
// the same convention already used elsewhere in this app (e.g. `useRouteLoaderData('routes/_admin')`
// in RecipeEditor/SessionDetail). Matching on these route ids via useMatches() is what makes scope
// detection generic/route-driven rather than something every page has to wire up by hand.
const RECIPE_ROUTE_ID = 'routes/_admin.recipes.$id';
const SESSION_ROUTE_ID = 'routes/_admin.sessions.$id';

function useAiChatScope(): { scope: AiChatScope; scopeId: number | null; contextLabel: string | null } {
  const matches = useMatches();
  const recipeMatch = matches.find((m) => m.id === RECIPE_ROUTE_ID);
  // The route's own loader data already has the recipe's name — reading it straight off the match
  // means the "Recipe: <name>" chip works on a read-only recipe view too, not just while editing
  // (where useRegisterAiRecipeBridge's `recipeLabel` covers it instead — see the sidekick's chip).
  const recipeData = recipeMatch?.data as { recipe?: { id: number; name: string } } | undefined;
  if (recipeData?.recipe) {
    return { scope: 'recipe', scopeId: recipeData.recipe.id, contextLabel: recipeData.recipe.name };
  }

  const sessionMatch = matches.find((m) => m.id === SESSION_ROUTE_ID);
  // The session detail route's own :id param is the Session id, but AiChatThread scopes a "brew
  // session" chat by Batch id (one batch spans Brewing/Fermentation/Carbonation as one continuous
  // flow) — the loader's own returned `batch.id`/`batch.name` are what we want, read straight off
  // the match.
  const batch = (sessionMatch?.data as { batch?: { id?: number; name?: string } } | undefined)?.batch;
  if (sessionMatch && typeof batch?.id === 'number') {
    return { scope: 'session', scopeId: batch.id, contextLabel: batch.name ?? null };
  }

  return { scope: 'general', scopeId: null, contextLabel: null };
}

function historyUrl(scope: AiChatScope, scopeId: number | null): string {
  const params = new URLSearchParams({ scope });
  if (scopeId != null) {
    params.set('scopeId', String(scopeId));
  }
  return `/api/ai-chat?${params.toString()}`;
}

type SidekickMode = 'edit' | 'generate' | null;

// Small lookup helpers rather than nested ternaries for every piece of copy that depends on the
// bridge/mode/scope combination — same logic, easier to scan and lint-clean.
function subtitleFor(mode: SidekickMode, scope: AiChatScope): string {
  if (mode === 'edit') {
    return 'Tweak the recipe you’re working on';
  }
  if (mode === 'generate') {
    return 'Draft a new recipe from a description';
  }
  if (scope === 'session') {
    return 'Chat about this brew session';
  }
  if (scope === 'recipe') {
    return 'Ask about this recipe, or ask me to update it';
  }
  return 'Ask about brewing, draft a recipe, or start a session';
}

function emptyStateTextFor(mode: SidekickMode, scope: AiChatScope): string {
  if (mode === 'edit') {
    return 'Ask for a change and I’ll update this recipe — review everything before saving.';
  }
  if (mode === 'generate') {
    return 'Describe a beer and I’ll draft a full recipe — review everything before saving.';
  }
  if (scope === 'session') {
    return 'Ask anything about this brew session, or ask me to update its recipe.';
  }
  if (scope === 'recipe') {
    return 'Ask anything about this recipe, or ask me to update it and I’ll take you to the editor.';
  }
  return 'Ask anything about brewing, or try one of the actions below.';
}

function sendingTextFor(mode: SidekickMode): string {
  if (mode === 'edit') {
    return 'Applying change…';
  }
  if (mode === 'generate') {
    return 'Drafting recipe…';
  }
  return 'Thinking…';
}

function placeholderFor(mode: SidekickMode): string {
  if (mode === 'edit') {
    return 'e.g. add more bitterness';
  }
  if (mode === 'generate') {
    return 'e.g. a hoppy citrus IPA around 6% ABV';
  }
  return 'Ask the AI Brewmaster anything…';
}

function sendButtonLabelFor(mode: SidekickMode): string {
  if (mode === 'edit') {
    return 'Apply change';
  }
  if (mode === 'generate') {
    return 'Generate recipe';
  }
  return 'Send';
}

export function AiBrewmasterSidekick() {
  const navigate = useNavigate();
  const { scope, scopeId, contextLabel } = useAiChatScope();
  const bridge = useAiSidekickBridge();
  let mode: SidekickMode = null;
  if (bridge) {
    mode = bridge.hasContent ? 'edit' : 'generate';
  }

  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[] | null>(null);
  // Messages typed while a reply is still on its way. They're sent one at a time, in order, as each
  // reply lands — so an edit request always goes out against the recipe the previous reply just changed.
  const [queue, setQueue] = useState<Array<{ id: number; text: string }>>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const nextQueueId = useRef(0);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const clearFetcher = useFetcher();

  const historyFetcher = useFetcher<HistoryResponse>();
  const actionFetcher = useFetcher<RecipeGenResponse | GeneralChatResponse>();
  const isSending = actionFetcher.state !== 'idle';

  // Reload this scope's persisted history on mount and whenever the route-detected scope changes
  // (navigating between a recipe, a session, and every other page) — the panel can stay open
  // across client-side navigation since MainLayout (and this component) never unmounts, so this is
  // what makes it "swap which thread's history is displayed" instead of carrying stale messages.
  const scopeKey = `${scope}:${scopeId ?? ''}`;
  useEffect(() => {
    historyFetcher.load(historyUrl(scope, scopeId));
    setDynamicSuggestions(null);
    setPrompt('');
    setQueue([]);
    setConfirmingClear(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    if (actionFetcher.state !== 'idle' || !actionFetcher.data) {
      return;
    }
    const result = actionFetcher.data;
    setPendingText(null);
    if ('error' in result) {
      // Whatever was queued was meant to follow a reply that never came — don't fire it blindly.
      setQueue([]);
      return;
    }
    if ('recipe' in result) {
      bridge?.onGenerated(result.recipe);
      setDynamicSuggestions(result.suggestions?.length ? result.suggestions : null);
    } else if (result.action) {
      const action = result.action;
      try {
        if ('draftRecipe' in action) {
          sessionStorage.setItem('ai-draft-recipe', JSON.stringify(action.draftRecipe));
        } else if ('draftSession' in action) {
          sessionStorage.setItem('ai-draft-session', JSON.stringify(action.draftSession));
        }
      } catch {
        // sessionStorage can throw in a locked-down/private context — the chat reply still stands,
        // the user just won't see the pre-filled form on the other end.
      }
      setQueue([]);
      navigate(action.to);
    }
    historyFetcher.load(historyUrl(scope, scopeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFetcher.state, actionFetcher.data]);

  const send = (trimmed: string) => {
    setPendingText(trimmed);
    if (bridge) {
      const body =
        mode === 'edit'
          ? {
              prompt: trimmed,
              packType: bridge.packType,
              mode: 'edit',
              currentRecipe: bridge.currentRecipe,
              threadScope: scope,
              threadScopeId: scopeId,
            }
          : {
              prompt: trimmed,
              packType: bridge.packType,
              mode: 'generate',
              threadScope: scope,
              threadScopeId: scopeId,
            };
      actionFetcher.submit(JSON.stringify(body), {
        method: 'post',
        action: '/api/ai-recipe',
        encType: 'application/json',
      });
    } else {
      actionFetcher.submit(JSON.stringify({ scope, scopeId, message: trimmed }), {
        method: 'post',
        action: '/api/ai-chat',
        encType: 'application/json',
      });
    }
  };
  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setPrompt('');
    if (isSending || queue.length > 0) {
      nextQueueId.current += 1;
      const id = nextQueueId.current;
      setQueue((q) => [...q, { id, text: trimmed }]);
      return;
    }
    send(trimmed);
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  // Send the next queued message once the current reply is fully handled. The short delay lets the
  // reply's effects (e.g. the editor applying a generated recipe) land first, so the next request
  // is built from up-to-date state rather than the pre-reply one.
  useEffect(() => {
    if (isSending || queue.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const [next, ...rest] = queue;
      setQueue(rest);
      sendRef.current(next.text);
    }, 150);
    return () => clearTimeout(timer);
  }, [isSending, queue]);

  const clearConversation = () => {
    setConfirmingClear(false);
    setQueue([]);
    setDynamicSuggestions(null);
    clearFetcher.submit(null, { method: 'delete', action: historyUrl(scope, scopeId) });
  };

  // Reload the (now empty) history once the delete has finished.
  useEffect(() => {
    if (clearFetcher.state === 'idle' && clearFetcher.data) {
      historyFetcher.load(historyUrl(scope, scopeId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearFetcher.state, clearFetcher.data]);

  const handleSubmit = () => submit(prompt);
  const handleChipClick = (example: string) => submit(example);

  const error = actionFetcher.data && 'error' in actionFetcher.data ? actionFetcher.data.error : null;
  const examples = useMemo(() => {
    if (bridge) {
      return dynamicSuggestions ?? (mode === 'edit' ? EDIT_EXAMPLES : GENERATE_EXAMPLES);
    }
    if (scope === 'session') {
      return SESSION_EXAMPLES;
    }
    if (scope === 'recipe') {
      return RECIPE_VIEW_EXAMPLES;
    }
    return GENERAL_EXAMPLES;
  }, [bridge, mode, dynamicSuggestions, scope]);

  const subtitle = subtitleFor(mode, scope);

  const messages = historyFetcher.data && 'messages' in historyFetcher.data ? historyFetcher.data.messages : [];
  const isLoadingHistory = historyFetcher.state === 'loading' && !historyFetcher.data;

  // Keep the newest message in view: on open, when history loads, as replies arrive, and as
  // messages are sent or queued.
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      endOfMessagesRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [open, messages.length, queue.length, pendingText, isSending, error]);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex max-h-[70vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-ink-card-border bg-ink-card shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)]">
          <div className="flex items-start gap-3 border-b border-ink-divider p-4">
            <span
              className="flex size-9 flex-none items-center justify-center rounded-lg"
              style={{ backgroundColor: ACCENT_SOFT, color: ACCENT }}
            >
              <GiHops className="size-5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[14px] font-bold text-ink-text">AI Brewmaster</p>
              <p className="text-[11px] text-ink-text-faint">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={messages.length === 0 || isSending || clearFetcher.state !== 'idle'}
              className="flex-none text-ink-text-faint transition-colors hover:text-ink-text disabled:pointer-events-none disabled:opacity-30"
              aria-label="Clear conversation"
              title="Clear conversation"
            >
              <MdDeleteSweep className="size-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-none text-ink-text-faint transition-colors hover:text-ink-text"
              aria-label="Close AI Brewmaster"
            >
              <MdClose className="size-4" />
            </button>
          </div>

          {confirmingClear && (
            <div className="flex items-center justify-between gap-2 border-b border-ink-divider bg-ink-bg px-4 py-2.5">
              <p className="text-[12px] text-ink-text-secondary">Clear this conversation?</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="rounded-md border border-ink-card-border px-2.5 py-1 text-[11.5px] text-ink-text-secondary hover:text-ink-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={clearConversation}
                  className="rounded-md bg-danger-500 px-2.5 py-1 text-[11.5px] font-semibold text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden p-4">
            {(bridge || contextLabel) && (
              <div
                className="flex w-fit max-w-full items-center gap-1.5 rounded-full border border-ink-divider bg-ink-bg px-2.5 py-1 text-[11px] text-ink-text-faint"
                title="What the AI Brewmaster currently has as context"
              >
                <MdMenuBook className="size-3 flex-none" />
                <span className="flex-none font-semibold text-ink-text-secondary">
                  {bridge || scope === 'recipe' ? 'Recipe:' : 'Session:'}
                </span>
                <span className="truncate">{bridge ? bridge.recipeLabel : contextLabel}</span>
              </div>
            )}

            {isLoadingHistory && <p className="text-[12px] text-ink-text-faint">Loading conversation…</p>}

            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'ml-6 min-w-0 max-w-[calc(100%-1.5rem)] self-end [overflow-wrap:anywhere] rounded-lg rounded-tr-sm bg-brand-500/15 px-3 py-2 text-[12.5px] text-ink-text'
                    : 'mr-6 flex min-w-0 items-start gap-2 [overflow-wrap:anywhere] rounded-lg rounded-tl-sm border border-ink-card-border bg-ink-bg px-3 py-2.5 text-[12.5px] text-ink-text-secondary'
                }
              >
                {m.role === 'assistant' && <GiHops className="mt-0.5 size-3.5 shrink-0" style={{ color: ACCENT }} />}
                {m.role === 'assistant' ? <ChatMarkdown>{m.content}</ChatMarkdown> : <p>{m.content}</p>}
              </div>
            ))}

            {pendingText && (
              <div className="ml-6 min-w-0 max-w-[calc(100%-1.5rem)] self-end [overflow-wrap:anywhere] rounded-lg rounded-tr-sm bg-brand-500/15 px-3 py-2 text-[12.5px] text-ink-text">
                <p>{pendingText}</p>
              </div>
            )}

            {queue.map((item) => (
              <div
                key={item.id}
                className="ml-6 flex min-w-0 max-w-[calc(100%-1.5rem)] items-start gap-2 self-end [overflow-wrap:anywhere] rounded-lg rounded-tr-sm border border-dashed border-ink-border-strong bg-ink-bg px-3 py-2 text-[12.5px] text-ink-text-secondary"
              >
                <div className="min-w-0">
                  <p>{item.text}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.4px] text-ink-text-faint">Queued</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQueue((q) => q.filter((x) => x.id !== item.id))}
                  aria-label="Remove queued message"
                  className="flex-none text-ink-text-faint transition-colors hover:text-ink-text"
                >
                  <MdClose className="size-3.5" />
                </button>
              </div>
            ))}

            {messages.length === 0 && !isLoadingHistory && !pendingText && (
              <p className="text-[12.5px] text-ink-text-secondary">{emptyStateTextFor(mode, scope)}</p>
            )}

            {!isSending && queue.length === 0 && (
              <div className="flex flex-col gap-1.5">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => handleChipClick(example)}
                    className="w-full rounded-lg border border-ink-card-border bg-ink-bg px-3 py-2 text-left text-[12.5px] text-ink-text-secondary transition-colors hover:border-ink-border-strong hover:text-ink-text"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}

            {isSending && (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-text-faint">
                <GiHops className="size-3.5 animate-pulse" style={{ color: ACCENT }} />
                {sendingTextFor(mode)}
              </p>
            )}

            {error && !isSending && (
              <p className="rounded-lg border border-danger-500 bg-danger-100 px-3 py-2 text-[12.5px] text-danger-500">
                {error}
              </p>
            )}
            <div ref={endOfMessagesRef} />
          </div>

          <div className="border-t border-ink-divider p-3">
            <div className="flex items-center gap-2 rounded-full border border-ink-input-border bg-ink-input-bg py-1 pl-4 pr-1.5">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={isSending ? 'Type another — it will be queued…' : placeholderFor(mode)}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-text placeholder:text-ink-text-faintest focus:outline-none"
              />
              <button
                type="button"
                disabled={!prompt.trim()}
                onClick={handleSubmit}
                aria-label={isSending ? 'Queue message' : sendButtonLabelFor(mode)}
                className="flex size-8 flex-none items-center justify-center rounded-full text-white transition-opacity disabled:pointer-events-none disabled:opacity-40"
                style={{ backgroundColor: ACCENT }}
              >
                <MdSend className="size-4" />
              </button>
            </div>
            {bridge && (
              <p className="mt-2 text-center text-[10px] text-ink-text-faintest">
                Scope: recipe generation &amp; tweaks only
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close AI Brewmaster' : 'Open AI Brewmaster'}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-[0_10px_25px_-5px_rgba(0,0,0,0.55)] transition-transform hover:scale-105"
        style={{ background: 'linear-gradient(135deg, oklch(0.85 0.15 88), oklch(0.66 0.17 55))' }}
      >
        {open ? <MdClose className="size-6" /> : <GiHops className="size-6" />}
      </button>
    </>
  );
}
