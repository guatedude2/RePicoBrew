import prisma from '~/services/prisma.server';

// Persists the AI Brewmaster sidekick's conversation history so it survives closing the panel,
// navigating away, and reloading the page — see app/components/recipes/AiBrewmasterModal.tsx.
// Exactly one thread exists per scope: a single 'general' thread (scopeId null) shared by every
// page that isn't a specific recipe or session, one thread per Recipe (scopeId = Recipe.id), and
// one per brew session (scopeId = Batch.id, not Session.id — a batch spans the Brewing/
// Fermentation/Carbonation legs the session detail page shows as one continuous flow).

export type AiChatScope = 'general' | 'recipe' | 'session';
export type AiChatRole = 'user' | 'assistant';

export class AiChatRepository {
  // SQLite's unique index treats every NULL as distinct, so `@@unique([scope, scopeId])` on
  // AiChatThread does NOT stop two 'general' (scopeId: null) rows from being created — it only
  // reliably de-dupes the recipe/session scopes, where scopeId is a real number. Find-then-create
  // (mirroring BatchRepository.getOrCreateBatchForSession's pattern) covers all three scopes; the
  // catch/re-query below only matters for a genuine create-create race on recipe/session scope.
  public static async getOrCreateThread(scope: AiChatScope, scopeId: number | null) {
    const existing = await prisma.aiChatThread.findFirst({ where: { scope, scopeId } });
    if (existing) {
      return existing;
    }
    try {
      return await prisma.aiChatThread.create({ data: { scope, scopeId } });
    } catch (error) {
      const raced = await prisma.aiChatThread.findFirst({ where: { scope, scopeId } });
      if (raced) {
        return raced;
      }
      throw error;
    }
  }

  public static async listMessages(threadId: number) {
    return prisma.aiChatMessage.findMany({ where: { threadId }, orderBy: { createdAt: 'asc' } });
  }

  // Resolves scope+scopeId straight to its full message history in one call — what the sidekick's
  // history loader (api.ai-chat.ts) uses whenever it mounts or the detected scope changes.
  public static async getThreadWithMessages(scope: AiChatScope, scopeId: number | null) {
    const thread = await this.getOrCreateThread(scope, scopeId);
    const messages = await this.listMessages(thread.id);
    return { thread, messages };
  }

  public static async appendMessage(
    threadId: number,
    role: AiChatRole,
    content: string,
    metadata?: Record<string, unknown> | null,
  ) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.aiChatMessage.create({
        data: { threadId, role, content, metadata: metadata ? JSON.stringify(metadata) : null },
      });
      // Bumps updatedAt so a future "most recently chatted about" view (not built yet) has
      // something meaningful to sort on.
      await tx.aiChatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
      return message;
    });
  }
}
