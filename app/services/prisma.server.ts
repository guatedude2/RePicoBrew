/* eslint-disable no-var */
import { join } from 'node:path';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import kebabCase from 'lodash/kebabCase';
import pubsub from './pubsub.server';

const HARD_DELETE_MODELS: Prisma.ModelName[] = [
  'Config',
  'Session',
  'SessionLog',
  'Batch',
  'DiscoveredDevice',
  'AiAdvice',
  // Child rows recreated wholesale on every recipe save (see updateRecipe) — no `deletedAt`
  // column exists on either model.
  'RecipeStep',
  'RecipeIngredient',
];
// Bumped for the Prisma 6 + driver-adapter migration (no more native query-engine binary — see
// pi-image/README.md, which is why this changed): forces the dev singleton below to rebuild.
// Bump again whenever HARD_DELETE_MODELS changes, since the extension closes over it.
const PRISMA_CLIENT_GEN = 6;
const sqliteUrl = `file:${join(process.cwd(), 'prisma', 'picobrew.db')}`;

function isStaleSqliteError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /readonly database|SQLITE_READONLY|extended_code: 1032/i.test(text);
}

async function applySqlitePragmas(client: PrismaClient) {
  await client.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  await client.$queryRawUnsafe('PRAGMA busy_timeout=5000');
}

const uncapitalize = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

// Rewrites a query for models not in HARD_DELETE_MODELS: reads filter out soft-deleted rows,
// and delete/deleteMany become update/updateMany that set `deletedAt` instead of removing the row.
function rewriteForSoftDelete(
  model: string,
  operation: string,
  args: Record<string, unknown> | undefined,
): { operation: string; args: Record<string, unknown> } {
  if (HARD_DELETE_MODELS.includes(model as Prisma.ModelName)) {
    return { operation, args: args ?? {} };
  }
  const safeArgs = args ?? {};
  switch (operation) {
    case 'findFirst': {
      const where = (safeArgs.where as Record<string, unknown>) ?? {};
      return { operation, args: { ...safeArgs, where: { ...where, deletedAt: null } } };
    }
    case 'count':
    case 'findMany': {
      const where = safeArgs.where as Record<string, unknown> | undefined;
      if (where === undefined) {
        return { operation, args: { ...safeArgs, where: { deletedAt: null } } };
      }
      if (where.deletedAt === undefined) {
        return { operation, args: { ...safeArgs, where: { ...where, deletedAt: null } } };
      }
      return { operation, args: safeArgs };
    }
    case 'delete': {
      return { operation: 'update', args: { where: safeArgs.where, data: { deletedAt: new Date() } } };
    }
    case 'deleteMany': {
      return { operation: 'updateMany', args: { where: safeArgs.where, data: { deletedAt: new Date() } } };
    }
    default:
      return { operation, args: safeArgs };
  }
}

const PUBLISHED_OPERATIONS = new Set(['create', 'update', 'upsert', 'delete']);

function extendClient(base: PrismaClient) {
  let recovering = false;

  return base.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          const rewritten = rewriteForSoftDelete(model, operation, args);

          const run = () =>
            rewritten.operation === operation
              ? query(rewritten.args)
              : // delete/deleteMany got rewritten to update/updateMany — `query` is bound to the
                // original operation, so the rewritten one is run directly against the base
                // (unextended) client instead.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (base as any)[uncapitalize(model)][rewritten.operation](rewritten.args);

          let result;
          try {
            result = await run();
          } catch (error) {
            if (recovering || !isStaleSqliteError(error)) {
              throw error;
            }
            recovering = true;
            console.warn('[prisma] SQLite handle went stale; reconnecting');
            try {
              await base.$disconnect();
              await base.$connect();
              await applySqlitePragmas(base);
              result = await run();
            } finally {
              recovering = false;
            }
          }

          if (PUBLISHED_OPERATIONS.has(rewritten.operation)) {
            pubsub.publish(`${kebabCase(model)}-update`, { action: rewritten.operation, data: result });
          }

          return result;
        },
      },
    },
  });
}

function createPrismaClient() {
  const base = new PrismaClient({ adapter: new PrismaBetterSQLite3({ url: sqliteUrl }) });
  void applySqlitePragmas(base).catch((error) => {
    console.warn('[prisma] Failed to apply SQLite pragmas', error);
  });
  return extendClient(base);
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

let prisma: ExtendedPrismaClient;

declare global {
  var __prisma: ExtendedPrismaClient | undefined;
  var __prismaGen: number | undefined;
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prisma || global.__prismaGen !== PRISMA_CLIENT_GEN) {
    void global.__prisma?.$disconnect();
    global.__prisma = createPrismaClient();
    global.__prismaGen = PRISMA_CLIENT_GEN;
  }
  prisma = global.__prisma;
}

export default prisma;
