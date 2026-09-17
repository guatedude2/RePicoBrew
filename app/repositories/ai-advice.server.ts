import prisma from '~/services/prisma.server';

export type AiAdviceTrigger = 'scheduled' | 'manual' | 'phase-change';

export class AiAdviceRepository {
  public static async listForBatch(batchId: number, limit = 10) {
    return prisma.aiAdvice.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  public static async getLatestForBatchPhase(batchId: number, phase: string) {
    return prisma.aiAdvice.findFirst({
      where: { batchId, phase },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async getLatestForBatch(batchId: number) {
    return prisma.aiAdvice.findFirst({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public static async create(input: {
    batchId: number;
    phase: string;
    trigger: AiAdviceTrigger;
    content: string;
    model: string;
  }) {
    return prisma.aiAdvice.create({ data: input });
  }
}
