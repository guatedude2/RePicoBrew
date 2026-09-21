import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { AiChatRepository, type AiChatScope } from '~/repositories/ai-chat.server';
import { BatchRepository } from '~/repositories/batch.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { describeBatchForChat } from '~/services/ai-advisor.server';
import { runGeneralChat } from '~/services/ai-chat-assistant.server';

// -1 is this app's "not set" sentinel for ABV/IBU (see app/utils/brew-stats.ts) — skip rather than
// show a misleading "-1% ABV" to the AI.
function describeRecipe(recipe: {
  name: string;
  style: string | null;
  deviceType: string;
  abv: number;
  ibu: number;
  ingredients: Array<{ section: string; name: string }>;
}): string {
  const stats = [recipe.abv >= 0 ? `${recipe.abv}% ABV` : null, recipe.ibu >= 0 ? `${recipe.ibu} IBU` : null]
    .filter(Boolean)
    .join(', ');
  const fermentables = recipe.ingredients.filter((i) => i.section === 'FERMENTABLE').map((i) => i.name);
  const hops = recipe.ingredients.filter((i) => i.section === 'BOIL_HOP' || i.section === 'DRY_HOP').map((i) => i.name);
  const ingredientBits = [
    fermentables.length ? `fermentables: ${fermentables.slice(0, 6).join(', ')}` : null,
    hops.length ? `hops: ${hops.slice(0, 6).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');
  const styleBit = recipe.style ? ` (${recipe.style})` : '';
  const statsBit = stats ? `, ${stats}` : '';
  const ingredientsBit = ingredientBits ? `. Ingredients — ${ingredientBits}` : '';
  return `Recipe "${recipe.name}"${styleBit}, ${recipe.deviceType} device${statsBit}${ingredientsBit}.`;
}

// GET  /api/ai-chat?scope=general|recipe|session&scopeId=<number, omitted for general>
//      Returns { threadId, messages } for that scope — the AI Brewmaster sidekick (see
//      app/components/recipes/AiBrewmasterModal.tsx) loads this on mount and whenever the
//      route-detected scope changes, so the panel always shows that scope's persisted history
//      instead of resetting on navigation/reload.
// POST /api/ai-chat  Body: { scope, scopeId, message }
//      Free-form conversation for whichever scope the sidekick is currently showing. Recipe-mode
//      generate/edit (structured recipe JSON) stays on /api/ai-recipe as before — this route only
//      ever returns a plain reply (plus an optional navigate action, general scope only).

function parseScope(value: string | null): AiChatScope | null {
  return value === 'general' || value === 'recipe' || value === 'session' ? value : null;
}

function parseScopeId(scope: AiChatScope, raw: string | null): { ok: true; scopeId: number | null } | { ok: false } {
  if (scope === 'general') {
    return { ok: true, scopeId: null };
  }
  const scopeId = Number(raw);
  if (!raw || Number.isNaN(scopeId)) {
    return { ok: false };
  }
  return { ok: true, scopeId };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const scope = parseScope(url.searchParams.get('scope'));
  if (!scope) {
    return data({ error: 'Invalid scope' }, { status: 400 });
  }
  const parsedScopeId = parseScopeId(scope, url.searchParams.get('scopeId'));
  if (!parsedScopeId.ok) {
    return data({ error: 'Missing scopeId' }, { status: 400 });
  }

  const { thread, messages } = await AiChatRepository.getThreadWithMessages(scope, parsedScopeId.scopeId);
  return {
    threadId: thread.id,
    messages: messages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // DELETE /api/ai-chat?scope=...&scopeId=... — "Clear conversation": wipes that scope's messages.
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const clearScope = parseScope(url.searchParams.get('scope'));
    if (!clearScope) {
      return data({ error: 'Invalid scope' }, { status: 400 });
    }
    const parsed = parseScopeId(clearScope, url.searchParams.get('scopeId'));
    if (!parsed.ok) {
      return data({ error: 'Missing scopeId' }, { status: 400 });
    }
    await AiChatRepository.clearThread(clearScope, parsed.scopeId);
    return { success: true };
  }

  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return data({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    scope: scopeRaw,
    scopeId: scopeIdRaw,
    message,
  } = (body ?? {}) as {
    scope?: unknown;
    scopeId?: unknown;
    message?: unknown;
  };

  const scope = parseScope(typeof scopeRaw === 'string' ? scopeRaw : null);
  if (!scope) {
    return data({ error: 'Invalid scope' }, { status: 400 });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return data({ error: 'Say something first.' }, { status: 400 });
  }
  let scopeId: number | null = null;
  if (scope !== 'general') {
    scopeId = typeof scopeIdRaw === 'number' ? scopeIdRaw : Number(scopeIdRaw as string);
    if (Number.isNaN(scopeId)) {
      return data({ error: 'Missing scopeId' }, { status: 400 });
    }
  }

  try {
    const thread = await AiChatRepository.getOrCreateThread(scope, scopeId);
    const history = (await AiChatRepository.listMessages(thread.id)).slice(-6);
    await AiChatRepository.appendMessage(thread.id, 'user', message.trim());

    // A light conversational touch for session/recipe-scoped chat — what's currently being viewed
    // — not a re-implementation of ai-advisor.server.ts's own scheduled/on-demand telemetry advice
    // feature (AiAdviceBlock on the Session Detail page), which stays untouched. `editRecipeUrl`
    // lets the user ask to edit/update that recipe from chat instead of clicking into the editor
    // themselves (see EDIT_RECIPE_INSTRUCTIONS in ai-chat-assistant.server.ts).
    let contextLine: string | undefined;
    let editRecipeUrl: string | undefined;
    if (scope === 'session' && scopeId != null) {
      const batch = await BatchRepository.getBatch(scopeId);
      if (batch) {
        // The live session data (current step, recent readings, targets) — without it the AI can only guess.
        contextLine = (await describeBatchForChat(scopeId)) ?? `Batch "${batch.name}", phase ${batch.phase}.`;
        if (batch.recipe) {
          editRecipeUrl = `/recipes/${batch.recipe.id}`;
        }
      }
    } else if (scope === 'recipe' && scopeId != null) {
      const recipe = await RecipeRepository.getRecipe(scopeId);
      if (recipe) {
        contextLine = describeRecipe(recipe);
        editRecipeUrl = `/recipes/${recipe.id}`;
      }
    }

    const result = await runGeneralChat({
      message: message.trim(),
      allowActions: scope === 'general',
      contextLine,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      editRecipeUrl,
    });
    if (!result.success) {
      return data({ error: result.error }, { status: 422 });
    }

    await AiChatRepository.appendMessage(
      thread.id,
      'assistant',
      result.reply,
      result.action ? { action: result.action } : null,
    );

    return { success: true, reply: result.reply, action: result.action };
  } catch (error) {
    console.error('[api.ai-chat] chat failed', error);
    return data({ error: 'Chat failed. Try again in a moment.' }, { status: 500 });
  }
};
