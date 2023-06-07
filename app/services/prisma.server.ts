/* eslint-disable no-var */
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import kebabCase from 'lodash/kebabCase';
import pubsub from './pubsub.server';

const HARD_DELETE_MODELS: Prisma.ModelName[] = ['Config'];

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      // log: ['query']
    });
  }
  prisma = global.__prisma;
}

/***********************************/
/* SOFT DELETE MIDDLEWARE */
/***********************************/

prisma.$use(async (params, next) => {
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

prisma.$use(async (params, next) => {
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

export default prisma;
