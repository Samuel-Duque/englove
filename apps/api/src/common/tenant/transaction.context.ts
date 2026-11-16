import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma } from '@prisma/client';

const transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export class TransactionContext {
  static getClient(): Prisma.TransactionClient | undefined {
    return transactionStorage.getStore();
  }

  static run<T>(tx: Prisma.TransactionClient, fn: () => Promise<T>): Promise<T> {
    return transactionStorage.run(tx, fn);
  }
}
