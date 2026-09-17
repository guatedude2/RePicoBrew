/* eslint-disable no-var */
import { join } from 'node:path';
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
];
const PRISMA_CLIENT_GEN = 4;
const sqliteUrl = `file:${join(process.cwd(), 'prisma', 'picobrew.db')}`;

function isStaleSqliteError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return /readonly database|SQLITE_READONLY|extended_code: 1032/i.test(text);
}

async function applySqlitePragmas(client: PrismaClient) {
  await client.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  await client.$queryRawUnsafe('PRAGMA busy_timeout=5000');
}

function attachMiddleware(client: PrismaClient) {
  let recovering = false;

  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error) {
      if (recovering || !isStaleSqliteError(error)) {
        throw error;
      }
      recovering = true;
      console.warn('[prisma] SQLite handle went stale; reconnecting');
      try {
        await client.$disconnect();
        await client.$connect();
        await applySqlitePragmas(client);
        return await next(params);
      } finally {
        recovering = false;
      }
    }
  });

  client.$use(async (params, next) => {
    params.args = params.args || { where: {} };
    // ignore models that are in the hard delete array
    if (params.model && HARD_DELETE_MODELS.includes(params.model)) {
      return next(params);
    }

    switch (params.action) {
      // filter out deleted records
      case 'findFirst': {
        params.action = 'findFirst';
        params.args.where.deletedAt = null;
        break;
      }
      case 'count':
      case 'findMany': {
        if (params.args.where === undefined) {
          params.args.where = { deletedAt: null };
        } else if (params.args.where && params.args.where.deletedAt === undefined) {
          params.args.where.deletedAt = null;
        }
        break;
      }
      // Soft delete a records
      case 'delete': {
        params.action = 'update';
        params.args.data = { deletedAt: new Date(), ...params.args.data };
        break;
      }
      case 'deleteMany': {
        params.action = 'updateMany';
        if (params.args.data !== undefined) {
          params.args.data.deletedAt = new Date();
        } else {
          params.args.data = { deletedAt: new Date(), ...params.args.data };
        }
        break;
      }
    }
    return next(params);
  });

  client.$use(async (params, next) => {
    const data = await next(params);
    const modelName = kebabCase(params.model);
    const action = params.action;
    switch (action) {
      case 'create':
      case 'update':
      case 'upsert':
      case 'delete': {
        pubsub.publish(`${modelName}-update`, { action, data });
        break;
      }
    }
    return data;
  });
}

function createPrismaClient() {
  const client = new PrismaClient({
    datasources: { db: { url: sqliteUrl } },
  });
  attachMiddleware(client);
  void applySqlitePragmas(client).catch((error) => {
    console.warn('[prisma] Failed to apply SQLite pragmas', error);
  });
  return client;
}

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
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
