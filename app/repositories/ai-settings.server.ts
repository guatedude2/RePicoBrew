import { ConfigRepository } from '~/repositories/config.server';
import { getAppSecret } from '~/services/app-secret.server';
import { decrypt, encrypt } from '~/utils/encryption';

export type AiProvider = 'openai' | 'claude' | 'opencode-zen' | 'custom';

const AI_PROVIDER_CONFIG = 'AI_PROVIDER';
const OPENAI_API_KEY_CONFIG = 'OPENAI_API_KEY';
const OPENAI_MODEL_CONFIG = 'OPENAI_MODEL';
const CLAUDE_API_KEY_CONFIG = 'CLAUDE_API_KEY';
const CLAUDE_MODEL_CONFIG = 'CLAUDE_MODEL';
const ZEN_API_KEY_CONFIG = 'OPENCODE_ZEN_API_KEY';
const ZEN_MODEL_CONFIG = 'OPENCODE_ZEN_MODEL';
const ZEN_PLAN_CONFIG = 'OPENCODE_ZEN_PLAN';
const SEARCH_URL_CONFIG = 'SEARXNG_URL';
const CUSTOM_BASE_URL_CONFIG = 'CUSTOM_AI_BASE_URL';
const CUSTOM_MODEL_CONFIG = 'CUSTOM_AI_MODEL';
const CUSTOM_API_KEY_CONFIG = 'CUSTOM_AI_API_KEY';

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
// Anthropic's fast/cheap model — same "keep costs down" role gpt-4o-mini plays for OpenAI.
export const CLAUDE_DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
// OpenCode's two subscription tiers, both under the same account/API key but different base paths
// and model catalogs — Zen is the pay-as-you-go gateway, Go is the flat $10/mo plan.
export type ZenPlan = 'zen' | 'go';
export const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';
export const ZEN_DEFAULT_MODEL = 'opencode/big-pickle';
export const ZEN_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';
// Model ids on Go's /models list have no provider prefix (confirmed against the live API) — e.g.
// "kimi-k3", not "opencode-go/kimi-k3" (that prefix is only used in OpenCode's own CLI config).
export const ZEN_GO_DEFAULT_MODEL = 'kimi-k3';

type EncryptedValue = { salt: string; encryptedData: string };

async function encryptValue(plainText: string): Promise<EncryptedValue> {
  const secret = await getAppSecret();
  return encrypt(plainText, secret);
}

async function decryptValue(value: EncryptedValue | null): Promise<string | null> {
  if (!value?.encryptedData) {
    return null;
  }
  try {
    const secret = await getAppSecret();
    return decrypt(value.encryptedData, secret, value.salt);
  } catch {
    return null;
  }
}

// OpenAI, OpenCode Zen, and any self-hosted OpenAI-compatible server share one wire format
// ("chat-completions"); Claude's Messages API is a different shape entirely (see
// ai-advisor.server.ts's callClaude), so callers branch on `kind`.
export type ResolvedProvider =
  | { kind: 'chat-completions'; baseUrl: string; apiKey: string | null; model: string }
  | { kind: 'claude'; apiKey: string; model: string };

export class AiSettingsRepository {
  // ---- Web search (self-hosted SearXNG instance) ----
  public static async getSearchUrl(): Promise<string | null> {
    return ConfigRepository.getConfig<string>(SEARCH_URL_CONFIG);
  }

  public static async setSearchUrl(url: string): Promise<void> {
    await ConfigRepository.setConfig(SEARCH_URL_CONFIG, url);
  }

  public static async clearSearchUrl(): Promise<void> {
    await ConfigRepository.deleteConfig(SEARCH_URL_CONFIG);
  }

  // ---- OpenAI slot ----
  public static async hasOpenAiKey(): Promise<boolean> {
    const value = await ConfigRepository.getConfig<EncryptedValue>(OPENAI_API_KEY_CONFIG);
    return !!value?.encryptedData;
  }

  public static async getOpenAiSettings(): Promise<{ configured: boolean; model: string }> {
    const configured = await this.hasOpenAiKey();
    const model = await ConfigRepository.getConfig<string>(OPENAI_MODEL_CONFIG);
    return { configured, model: model ?? OPENAI_DEFAULT_MODEL };
  }

  public static async setOpenAiApiKey(plainKey: string, model?: string): Promise<void> {
    await ConfigRepository.setConfig<EncryptedValue>(OPENAI_API_KEY_CONFIG, await encryptValue(plainKey));
    await ConfigRepository.setConfig(OPENAI_MODEL_CONFIG, model || OPENAI_DEFAULT_MODEL);
    await this.activateProvider('openai');
  }

  public static async clearOpenAiApiKey(): Promise<void> {
    await ConfigRepository.deleteConfig(OPENAI_API_KEY_CONFIG);
    await ConfigRepository.deleteConfig(OPENAI_MODEL_CONFIG);
    await this.reconcileActiveProvider('openai');
  }

  // Only for the "list available models" action — the key never reaches the client, just the
  // resulting model-id list does.
  public static async getOpenAiApiKeyPlain(): Promise<string | null> {
    const value = await ConfigRepository.getConfig<EncryptedValue>(OPENAI_API_KEY_CONFIG);
    return decryptValue(value);
  }

  // ---- Claude slot ----
  public static async hasClaudeKey(): Promise<boolean> {
    const value = await ConfigRepository.getConfig<EncryptedValue>(CLAUDE_API_KEY_CONFIG);
    return !!value?.encryptedData;
  }

  public static async getClaudeSettings(): Promise<{ configured: boolean; model: string }> {
    const configured = await this.hasClaudeKey();
    const model = await ConfigRepository.getConfig<string>(CLAUDE_MODEL_CONFIG);
    return { configured, model: model ?? CLAUDE_DEFAULT_MODEL };
  }

  public static async setClaudeApiKey(plainKey: string, model?: string): Promise<void> {
    await ConfigRepository.setConfig<EncryptedValue>(CLAUDE_API_KEY_CONFIG, await encryptValue(plainKey));
    await ConfigRepository.setConfig(CLAUDE_MODEL_CONFIG, model || CLAUDE_DEFAULT_MODEL);
    await this.activateProvider('claude');
  }

  public static async clearClaudeApiKey(): Promise<void> {
    await ConfigRepository.deleteConfig(CLAUDE_API_KEY_CONFIG);
    await ConfigRepository.deleteConfig(CLAUDE_MODEL_CONFIG);
    await this.reconcileActiveProvider('claude');
  }

  public static async getClaudeApiKeyPlain(): Promise<string | null> {
    const value = await ConfigRepository.getConfig<EncryptedValue>(CLAUDE_API_KEY_CONFIG);
    return decryptValue(value);
  }

  // ---- OpenCode (Zen or Go plan) slot ----
  public static async getZenSettings(): Promise<{ configured: boolean; model: string; plan: ZenPlan }> {
    const value = await ConfigRepository.getConfig<EncryptedValue>(ZEN_API_KEY_CONFIG);
    const plan = (await ConfigRepository.getConfig<ZenPlan>(ZEN_PLAN_CONFIG)) ?? 'zen';
    const model = await ConfigRepository.getConfig<string>(ZEN_MODEL_CONFIG);
    return { configured: !!value?.encryptedData, model: model ?? this.zenDefaultModel(plan), plan };
  }

  private static zenDefaultModel(plan: ZenPlan): string {
    return plan === 'go' ? ZEN_GO_DEFAULT_MODEL : ZEN_DEFAULT_MODEL;
  }

  public static async setZenSettings(input: { apiKey: string; model: string; plan: ZenPlan }): Promise<void> {
    await ConfigRepository.setConfig<EncryptedValue>(ZEN_API_KEY_CONFIG, await encryptValue(input.apiKey));
    await ConfigRepository.setConfig(ZEN_PLAN_CONFIG, input.plan);
    await ConfigRepository.setConfig(ZEN_MODEL_CONFIG, input.model || this.zenDefaultModel(input.plan));
    await this.activateProvider('opencode-zen');
  }

  public static async clearZenSettings(): Promise<void> {
    await ConfigRepository.deleteConfig(ZEN_API_KEY_CONFIG);
    await ConfigRepository.deleteConfig(ZEN_MODEL_CONFIG);
    await ConfigRepository.deleteConfig(ZEN_PLAN_CONFIG);
    await this.reconcileActiveProvider('opencode-zen');
  }

  public static async getZenApiKeyPlain(): Promise<string | null> {
    const value = await ConfigRepository.getConfig<EncryptedValue>(ZEN_API_KEY_CONFIG);
    return decryptValue(value);
  }

  // Lets an already-configured slot's model be corrected without re-entering the API key.
  public static async updateZenModel(model: string): Promise<void> {
    await ConfigRepository.setConfig(ZEN_MODEL_CONFIG, model);
  }

  public static zenBaseUrlForPlan(plan: ZenPlan): string {
    return plan === 'go' ? ZEN_GO_BASE_URL : ZEN_BASE_URL;
  }

  // ---- Custom (local/self-hosted) slot ----
  public static async getCustomSettings(): Promise<{ configured: boolean; baseUrl: string; model: string }> {
    const baseUrl = await ConfigRepository.getConfig<string>(CUSTOM_BASE_URL_CONFIG);
    const model = await ConfigRepository.getConfig<string>(CUSTOM_MODEL_CONFIG);
    return { configured: !!baseUrl, baseUrl: baseUrl ?? '', model: model ?? '' };
  }

  public static async setCustomSettings(input: { baseUrl: string; apiKey?: string; model: string }): Promise<void> {
    await ConfigRepository.setConfig(CUSTOM_BASE_URL_CONFIG, input.baseUrl);
    await ConfigRepository.setConfig(CUSTOM_MODEL_CONFIG, input.model);
    if (input.apiKey) {
      await ConfigRepository.setConfig<EncryptedValue>(CUSTOM_API_KEY_CONFIG, await encryptValue(input.apiKey));
    } else {
      await ConfigRepository.deleteConfig(CUSTOM_API_KEY_CONFIG);
    }
    await this.activateProvider('custom');
  }

  public static async clearCustomSettings(): Promise<void> {
    await ConfigRepository.deleteConfig(CUSTOM_BASE_URL_CONFIG);
    await ConfigRepository.deleteConfig(CUSTOM_MODEL_CONFIG);
    await ConfigRepository.deleteConfig(CUSTOM_API_KEY_CONFIG);
    await this.reconcileActiveProvider('custom');
  }

  // ---- Active-provider bookkeeping ----
  private static async activateProvider(provider: AiProvider): Promise<void> {
    await ConfigRepository.setConfig(AI_PROVIDER_CONFIG, provider);
  }

  // Called after clearing a slot: if that slot was the active one, fall back to whichever other
  // slot (if any) still has settings, so removing a key doesn't silently keep pointing at it.
  private static async reconcileActiveProvider(justCleared: AiProvider): Promise<void> {
    const current = await ConfigRepository.getConfig<AiProvider>(AI_PROVIDER_CONFIG);
    if (current !== justCleared) {
      return;
    }
    const [hasOpenAi, hasClaude, zen, custom] = await Promise.all([
      this.hasOpenAiKey(),
      this.hasClaudeKey(),
      this.getZenSettings(),
      this.getCustomSettings(),
    ]);
    if (justCleared !== 'openai' && hasOpenAi) {
      await this.activateProvider('openai');
    } else if (justCleared !== 'claude' && hasClaude) {
      await this.activateProvider('claude');
    } else if (justCleared !== 'opencode-zen' && zen.configured) {
      await this.activateProvider('opencode-zen');
    } else if (justCleared !== 'custom' && custom.configured) {
      await this.activateProvider('custom');
    } else {
      await ConfigRepository.deleteConfig(AI_PROVIDER_CONFIG);
    }
  }

  public static async getActiveProviderName(): Promise<AiProvider | null> {
    return ConfigRepository.getConfig<AiProvider>(AI_PROVIDER_CONFIG);
  }

  public static async hasActiveKey(): Promise<boolean> {
    return (await this.getActiveProvider()) !== null;
  }

  public static async getActiveProvider(): Promise<ResolvedProvider | null> {
    const provider = await this.getActiveProviderName();
    if (provider === 'openai') {
      const value = await ConfigRepository.getConfig<EncryptedValue>(OPENAI_API_KEY_CONFIG);
      const apiKey = await decryptValue(value);
      if (!apiKey) {
        return null;
      }
      const model = (await ConfigRepository.getConfig<string>(OPENAI_MODEL_CONFIG)) ?? OPENAI_DEFAULT_MODEL;
      return { kind: 'chat-completions', baseUrl: OPENAI_BASE_URL, apiKey, model };
    }
    if (provider === 'claude') {
      const value = await ConfigRepository.getConfig<EncryptedValue>(CLAUDE_API_KEY_CONFIG);
      const apiKey = await decryptValue(value);
      if (!apiKey) {
        return null;
      }
      const model = (await ConfigRepository.getConfig<string>(CLAUDE_MODEL_CONFIG)) ?? CLAUDE_DEFAULT_MODEL;
      return { kind: 'claude', apiKey, model };
    }
    if (provider === 'opencode-zen') {
      const value = await ConfigRepository.getConfig<EncryptedValue>(ZEN_API_KEY_CONFIG);
      const apiKey = await decryptValue(value);
      if (!apiKey) {
        return null;
      }
      const plan = (await ConfigRepository.getConfig<ZenPlan>(ZEN_PLAN_CONFIG)) ?? 'zen';
      const model = (await ConfigRepository.getConfig<string>(ZEN_MODEL_CONFIG)) ?? this.zenDefaultModel(plan);
      return { kind: 'chat-completions', baseUrl: this.zenBaseUrlForPlan(plan), apiKey, model };
    }
    if (provider === 'custom') {
      const baseUrl = await ConfigRepository.getConfig<string>(CUSTOM_BASE_URL_CONFIG);
      if (!baseUrl) {
        return null;
      }
      const model = (await ConfigRepository.getConfig<string>(CUSTOM_MODEL_CONFIG)) ?? '';
      const value = await ConfigRepository.getConfig<EncryptedValue>(CUSTOM_API_KEY_CONFIG);
      const apiKey = await decryptValue(value);
      return { kind: 'chat-completions', baseUrl, apiKey, model };
    }
    return null;
  }
}
