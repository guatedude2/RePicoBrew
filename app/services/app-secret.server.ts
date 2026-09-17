import { ConfigRepository } from '~/repositories/config.server';
import { randomUUID } from '~/utils/encryption';

const APP_SECRET_KEY = 'APP_SECRET';

// Lazily generated and persisted once, so encrypting values (like the OpenAI API key) works
// without requiring a .env file — this app has none today and self-hosted Pi deployments
// shouldn't need to add one just for this.
export async function getAppSecret(): Promise<string> {
  const existing = await ConfigRepository.getConfig<string>(APP_SECRET_KEY);
  if (existing) {
    return existing;
  }
  const secret = randomUUID();
  await ConfigRepository.setConfig(APP_SECRET_KEY, secret);
  return secret;
}
