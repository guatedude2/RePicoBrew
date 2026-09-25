import { AiSettingsRepository } from '~/repositories/ai-settings.server';
import { DeviceRepository } from '~/repositories/device.server';
import { RecipeRepository } from '~/repositories/recipe.server';
import { streamAiProvider, describeAiError } from '~/services/ai-provider.server';
import {
  generatePicoPackRecipe,
  generateZPackRecipe,
  type PackKind,
  type PicoPackAiRecipe,
  type ZPackAiRecipe,
} from '~/services/ai-recipe-generator.server';
import { gatherReferences, referenceBlock, sourceLinesFor } from '~/services/ai-references.server';
import { PICOBREW_DOMAIN_KNOWLEDGE } from '~/services/picobrew-knowledge.server';
import { DeviceType } from '~/types';

// Powers the AI Brewmaster sidekick's open-ended chat on every page that ISN'T a specific recipe
// or session (see app/routes/api.ai-chat.ts) — general homebrewing conversation, plus two concrete
// actions the model can request when the user clearly asks for them: drafting a brand-new recipe,
// or starting a new brew session. Both actions follow the same "AI drafts, human confirms" pattern
// as the recipe editor's own sidekick — this never creates a Recipe or Session/Batch row itself,
// it only tells the client which pre-filled flow to navigate to.
//
// This is two chained single-shot prompts, not an agent loop: one small classification/reply call
// decides WHETHER the user wants a drafted recipe, and if so, hands the actual drafting off to the
// existing generatePicoPackRecipe/generateZPackRecipe calls (same prompts/few-shots/normalization
// the recipe editor's sidekick already uses) rather than re-deriving recipe-generation quality
// here. Keeping that concern separate avoids bloating every plain "how do I clean my machine"
// message with the recipe generator's large few-shot system prompt.

export type AiChatAction =
  | { type: 'navigate'; to: string; draftRecipe: { packType: PackKind; recipe: PicoPackAiRecipe | ZPackAiRecipe } }
  | { type: 'navigate'; to: string; draftSession: { deviceId: number; recipeId: number } }
  // Plain navigation, no draft payload — used when the user asks to edit/update the recipe
  // currently being viewed on a read-only recipe page or a session's detail page (see
  // EDIT_RECIPE_INSTRUCTIONS below). The client just navigates; there's nothing to pre-fill.
  | { type: 'navigate'; to: string };

export type AiChatResult =
  | { success: true; reply: string; action: AiChatAction | null }
  | { success: false; error: string };

const GENERAL_PERSONA =
  'You are "AI Brewmaster", a friendly, knowledgeable homebrewing assistant embedded in RePicoBrew, a home-brewing ' +
  'tracker/control app for PicoBrew machines (Pico, Zymatic, Z Series) plus Tilt/PicoFerm sensors. Chat naturally ' +
  'about brewing, troubleshooting, and using the app. Keep replies short and practical. Light markdown is fine and ' +
  'is rendered (**bold**, short bullet or numbered lists when listing several items) — no headers, no tables. You cannot browse the web, open links, or look anything up, ' +
  "and you have no access to any brand's or brewery's actual recipes: never say or imply that you checked, " +
  'verified, or matched something against a real source unless the text was given to you under "Reference material". ' +
  'If asked whether something is accurate or made up, be honest about what is general knowledge versus a guess. ' +
  'When a "Context" block contains live session data (current step, recent temperature readings, the recipe\'s targets), ' +
  "use it to answer directly — compare readings to the step's target — and only say you can't see something if it is " +
  'genuinely missing from that context.';

const ACTIONS_INSTRUCTIONS = `You can also trigger two concrete actions when the user clearly asks for them — never
volunteer them unprompted:

1. Drafting a brand-new recipe (e.g. "create me a new recipe", "draft a hoppy IPA"): set "action" to
   {"type":"draft_recipe","packType":"picopack"|"zpack","brief":"<short restatement of what beer to draft>"}.
   Default to "zpack" (the full brew-science format) unless the user asks for something simple/steps-only, which
   means "picopack". Do NOT invent the actual recipe yourself here — a separate step drafts it from your "brief".
   Your "reply" should just briefly acknowledge what you're about to draft (e.g. "Drafting a hoppy citrus IPA for
   you to review.").

2. Starting a new brew session (e.g. "start a new session on the kitchen Pico", "let's brew the Mosaic pale ale"):
   figure out which device and which recipe the user means from the lists below (match by name, loosely — "the
   kitchen Pico" can match a device just named "Kitchen"). If BOTH are clear, set "action" to
   {"type":"start_session","deviceId":<id>,"recipeId":<id>}. If either is missing or ambiguous, do NOT guess —
   set "action" to null and ask a specific clarifying question in "reply" naming the real options.

Known brewing devices (id: name (type)):
{{DEVICES}}

Known recipes (id: name (style)):
{{RECIPES}}`;

const NO_ACTIONS_INSTRUCTIONS =
  'You cannot draft brand-new recipes or start brew sessions from here — "action" must never be {"type":"draft_recipe",' +
  '...} or {"type":"start_session",...}. If the user asks for either, tell them to use the AI Brewmaster from the ' +
  'Dashboard or another general page instead.';

// Offered on a read-only recipe view and on a session's detail page (see api.ai-chat.ts, which only sets
// `editRecipeUrl` there) — lets the user ask to edit the recipe they're currently looking at without leaving chat.
const EDIT_RECIPE_INSTRUCTIONS =
  'You can also trigger one action when the user clearly asks to edit, update, or change the recipe currently ' +
  'being discussed (e.g. "update this recipe", "let\'s tweak the hops", "I want to change this") — never volunteer ' +
  'it unprompted: set "action" to {"type":"edit_recipe"}. Your "reply" should briefly acknowledge you\'re taking ' +
  'them to the editor (e.g. "Sure, taking you to the recipe editor.").';

function jsonOnlyInstruction(): string {
  return (
    'Respond with ONLY a single JSON object of the exact shape { "reply": "...", "action": null | {...} } — no ' +
    'markdown code fences, no text before or after the JSON.'
  );
}

function buildSystemPrompt(opts: {
  allowDraftAndSession: boolean;
  allowEditRecipeNavigate: boolean;
  deviceLines: string;
  recipeLines: string;
}): string {
  const blocks: string[] = [
    opts.allowDraftAndSession
      ? ACTIONS_INSTRUCTIONS.replace('{{DEVICES}}', opts.deviceLines || '(none registered yet)').replace(
          '{{RECIPES}}',
          opts.recipeLines || '(none saved yet)',
        )
      : NO_ACTIONS_INSTRUCTIONS,
  ];
  if (opts.allowEditRecipeNavigate) {
    blocks.push(EDIT_RECIPE_INSTRUCTIONS);
  }
  return `${GENERAL_PERSONA}\n\n${blocks.join('\n\n')}\n\n${jsonOnlyInstruction()}\n\n${PICOBREW_DOMAIN_KNOWLEDGE}`;
}

// Mirrors ai-recipe-generator.server.ts's own parseJsonResponse — models occasionally wrap JSON in
// a markdown fence or add a sentence of prose around it, so this is untrusted output that needs
// defensive extraction rather than a bare JSON.parse.
function parseJsonResponse(raw: string): Record<string, unknown> | null {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1].trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return null;
  }
  text = text.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// The model answers with a JSON envelope ({ "reply": "...", "action": ... }); this pulls the text of the
// "reply" field out of the partial JSON as it streams in, so the user reads it as it is written. A plain-prose
// answer (no envelope) is passed straight through.
const SIMPLE_ESCAPES: Record<string, string> = { n: '\n', t: '\t' };

function createReplyStreamer(onDelta: (text: string) => void) {
  let raw = '';
  let emitted = 0;
  return (chunk: string) => {
    raw += chunk;
    const head = raw.trimStart();
    if (!head) {
      return;
    }
    let text: string;
    if (head[0] === '{' || head[0] === '`') {
      const match = /"reply"\s*:\s*"/.exec(raw);
      if (!match) {
        return;
      }
      text = '';
      for (let i = match.index + match[0].length; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '"') {
          break;
        }
        if (ch !== '\\') {
          text += ch;
          continue;
        }
        const next = raw[i + 1];
        if (next === undefined) {
          break;
        }
        if (next === 'u') {
          const hex = raw.slice(i + 2, i + 6);
          if (hex.length < 4) {
            break;
          }
          text += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
        text += SIMPLE_ESCAPES[next] ?? next;
        i += 1;
      }
    } else {
      text = raw;
    }
    if (text.length > emitted) {
      onDelta(text.slice(emitted));
      emitted = text.length;
    }
  };
}

const FALLBACK_REPLY = "Sorry, I didn't quite catch that — could you rephrase?";

type RawAction = { type?: unknown; packType?: unknown; brief?: unknown; deviceId?: unknown; recipeId?: unknown };

export async function runGeneralChat(input: {
  message: string;
  allowActions: boolean;
  contextLine?: string;
  // The last few messages of this conversation (oldest first), so follow-up questions keep their thread.
  history?: Array<{ role: string; content: string }>;
  // Set only when the current scope is a specific, existing recipe (a read-only recipe view) or a
  // session with a known recipe — the URL to send the user to if they ask to edit/update it. See
  // api.ai-chat.ts for how each scope derives this.
  editRecipeUrl?: string;
  // Streaming hooks: coarse progress ("Looking up references…") and the reply text as it is written.
  onStatus?: (status: string) => void;
  onReplyDelta?: (text: string) => void;
}): Promise<AiChatResult> {
  const message = input.message.trim();
  if (!message) {
    return { success: false, error: 'Say something first.' };
  }
  if (message.length > 2000) {
    return { success: false, error: 'That message is too long — try to keep it under 2000 characters.' };
  }

  const provider = await AiSettingsRepository.getActiveProvider();
  if (!provider) {
    return { success: false, error: 'No AI provider is configured. Add one in Settings → AI.' };
  }

  // Only worth the extra queries when the model can actually act on the answer.
  const [devices, recipes] = input.allowActions
    ? await Promise.all([DeviceRepository.listDevices(), RecipeRepository.getAllRecipes()])
    : [[], []];
  const brewDevices = devices.filter((d) => d.deviceType !== DeviceType.TILT);
  const deviceLines = brewDevices
    .slice(0, 30)
    .map((d) => `${d.id}: ${d.name} (${d.deviceType})`)
    .join('\n');
  const recipeLines = recipes
    .slice(0, 30)
    .map((r) => `${r.id}: ${r.name} (${r.style || 'Unspecified style'})`)
    .join('\n');

  const system = buildSystemPrompt({
    allowDraftAndSession: input.allowActions,
    allowEditRecipeNavigate: Boolean(input.editRecipeUrl),
    deviceLines,
    recipeLines,
  });
  input.onStatus?.('Looking up references…');
  const gathered = await gatherReferences(provider, message);
  const historyBlock = input.history?.length
    ? `Recent conversation:\n${input.history
        .map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.content.slice(0, 600)}`)
        .join('\n')}\n\n`
    : '';
  const user = `${input.contextLine ? `Context: ${input.contextLine}\n\n` : ''}${historyBlock}${
    input.contextLine || historyBlock ? 'Current message: ' : ''
  }${message}${referenceBlock(gathered)}\n\n(Reply with the JSON object described in your instructions.)`;

  let raw: string;
  try {
    input.onStatus?.('Thinking…');
    const streamReply = input.onReplyDelta ? createReplyStreamer(input.onReplyDelta) : () => {};
    raw = await streamAiProvider(
      provider,
      {
        system,
        user,
        maxTokens: 600,
        // Reasoning models think before answering, and a linked page adds thousands of tokens of input.
        timeoutMs: 120000,
        sessionId: 'repicobrew-general-chat',
      },
      streamReply,
    );
  } catch (error) {
    console.error('[ai-chat-assistant] request failed', error);
    return { success: false, error: describeAiError(error) };
  }

  let parsed = parseJsonResponse(raw);
  // Models sometimes answer in plain prose instead of the JSON envelope (more often with conversation history in
  // the prompt). A plain-text answer is still a perfectly good reply — only text that looks like broken JSON isn't.
  const trimmedRaw = raw.trim();
  if (!parsed && trimmedRaw && !/^[{[`]/.test(trimmedRaw)) {
    parsed = { reply: trimmedRaw, action: null };
  }
  const replyText = parsed && typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : null;
  const rawAction = parsed && parsed.action && typeof parsed.action === 'object' ? (parsed.action as RawAction) : null;

  if (!parsed || (!replyText && !rawAction)) {
    console.error('[ai-chat-assistant] could not parse AI response as JSON', raw.slice(0, 500));
    return { success: false, error: 'The AI response could not be understood. Try rephrasing your message.' };
  }

  if (!rawAction) {
    const sourceLines = sourceLinesFor(gathered);
    const reply = replyText ?? FALLBACK_REPLY;
    const sources = sourceLines.length > 0 ? `\n\n**Sources**\n\n${sourceLines.map((l) => `- ${l}`).join('\n')}` : '';
    return { success: true, reply: reply + sources, action: null };
  }

  if (rawAction.type === 'edit_recipe' && input.editRecipeUrl) {
    return { success: true, reply: replyText ?? FALLBACK_REPLY, action: { type: 'navigate', to: input.editRecipeUrl } };
  }

  if (!input.allowActions) {
    return { success: true, reply: replyText ?? FALLBACK_REPLY, action: null };
  }

  if (rawAction.type === 'draft_recipe') {
    const packType: PackKind = rawAction.packType === 'picopack' ? 'picopack' : 'zpack';
    const brief = typeof rawAction.brief === 'string' && rawAction.brief.trim() ? rawAction.brief.trim() : message;
    input.onStatus?.('Drafting the recipe…');
    const genResult = packType === 'zpack' ? await generateZPackRecipe(brief) : await generatePicoPackRecipe(brief);
    if (!genResult.success) {
      return { success: true, reply: `${replyText ?? ''} ${genResult.error}`.trim(), action: null };
    }
    const to = packType === 'zpack' ? '/recipes/new' : '/recipes/new-picopack';
    return {
      success: true,
      reply: [replyText, genResult.explanation].filter(Boolean).join(' ').trim() || genResult.explanation,
      action: { type: 'navigate', to, draftRecipe: { packType, recipe: genResult.recipe } },
    };
  }

  if (rawAction.type === 'start_session') {
    const deviceId = Number(rawAction.deviceId);
    const recipeId = Number(rawAction.recipeId);
    const deviceValid = brewDevices.some((d) => d.id === deviceId);
    const recipeValid = recipes.some((r) => r.id === recipeId);
    if (!deviceValid || !recipeValid) {
      // The model claimed a match that doesn't actually exist in our lists — never trust that
      // enough to navigate the user into a broken pre-fill; fall back to asking again instead of
      // repeating a reply that implied the (invalid) action would happen.
      return {
        success: true,
        reply: 'I need a valid device and recipe to start a session — which of your devices and recipes did you mean?',
        action: null,
      };
    }
    return {
      success: true,
      reply: replyText ?? FALLBACK_REPLY,
      action: { type: 'navigate', to: '/sessions/new', draftSession: { deviceId, recipeId } },
    };
  }

  return { success: true, reply: replyText ?? FALLBACK_REPLY, action: null };
}
