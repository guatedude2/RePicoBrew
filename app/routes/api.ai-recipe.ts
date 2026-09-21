import type { ActionFunctionArgs } from 'react-router';
import { data } from 'react-router';
import { AiChatRepository, type AiChatScope } from '~/repositories/ai-chat.server';
import {
  editPicoPackRecipe,
  editZPackRecipe,
  generatePicoPackRecipe,
  generateZPackRecipe,
  type PicoPackAiRecipe,
  type ZPackAiRecipe,
} from '~/services/ai-recipe-generator.server';
import { requireUser } from '~/services/auth.server';

// POST /api/ai-recipe
// Body (generate): { mode: 'generate', prompt: string, packType: 'picopack' | 'zpack', threadScope?, threadScopeId? }
// Body (edit):     { mode: 'edit', prompt: string, packType: 'picopack' | 'zpack', currentRecipe: {...}, threadScope?, threadScopeId? }
// Powers the "AI Brewmaster" sidekick's recipe generate/edit mode (now rendered globally from
// MainLayout, active whenever a recipe editor is mounted — see AiSidekickContext): either drafts a
// whole new recipe from a free-text description, or applies a targeted change ("add more
// bitterness") to the recipe currently in the editor's in-progress form. Either way it hands back
// structured JSON (plus a short natural-language explanation of what it did) for the client to
// pre-fill/update the form. Nothing is saved here — same "populate, let the user review, they hit
// Save" flow as importing from PicoBrew.
//
// `threadScope`/`threadScopeId` (optional, sent by the sidekick based on its route-detected scope)
// tell this action which persistent AiChatThread to log the exchange to — 'recipe' + a real recipe
// id when editing an already-saved recipe, 'general' (no id) when drafting on a blank/new-recipe
// page. Persistence is best-effort: a logging failure never fails the recipe generation itself.
export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUser(request);
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return data({ error: 'Invalid request body' }, { status: 400 });
  }

  const { prompt, packType, mode, currentRecipe, threadScope, threadScopeId } = (body ?? {}) as {
    prompt?: unknown;
    packType?: unknown;
    mode?: unknown;
    currentRecipe?: unknown;
    threadScope?: unknown;
    threadScopeId?: unknown;
  };

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return data({ error: 'Describe what you want first.' }, { status: 400 });
  }
  if (packType !== 'picopack' && packType !== 'zpack') {
    return data({ error: 'Invalid pack type' }, { status: 400 });
  }
  const isEdit = mode === 'edit';
  if (isEdit && (!currentRecipe || typeof currentRecipe !== 'object')) {
    return data({ error: 'Missing current recipe to edit' }, { status: 400 });
  }

  try {
    let result;
    if (isEdit) {
      result =
        packType === 'zpack'
          ? await editZPackRecipe(currentRecipe as ZPackAiRecipe, prompt)
          : await editPicoPackRecipe(currentRecipe as PicoPackAiRecipe, prompt);
    } else {
      result = packType === 'zpack' ? await generateZPackRecipe(prompt) : await generatePicoPackRecipe(prompt);
    }
    if (!result.success) {
      return data({ error: result.error }, { status: 422 });
    }

    try {
      const scope: AiChatScope = threadScope === 'recipe' ? 'recipe' : 'general';
      const scopeIdNum = scope === 'recipe' ? Number(threadScopeId) : null;
      if (scope === 'general' || (scopeIdNum != null && !Number.isNaN(scopeIdNum))) {
        const thread = await AiChatRepository.getOrCreateThread(scope, scopeIdNum);
        await AiChatRepository.appendMessage(thread.id, 'user', prompt.trim(), {
          mode: isEdit ? 'edit' : 'generate',
          packType,
        });
        await AiChatRepository.appendMessage(thread.id, 'assistant', result.explanation || 'Updated the recipe.', {
          suggestions: result.suggestions,
          recipe: result.recipe,
        });
      }
    } catch (error) {
      // The recipe generation itself already succeeded — never fail the user-facing response over
      // a logging problem, just note it for later investigation.
      console.error('[api.ai-recipe] chat persistence failed', error);
    }

    return { success: true, recipe: result.recipe, explanation: result.explanation, suggestions: result.suggestions };
  } catch (error) {
    console.error('[api.ai-recipe] generation failed', error);
    return data({ error: 'Recipe generation failed. Try again in a moment.' }, { status: 500 });
  }
};
