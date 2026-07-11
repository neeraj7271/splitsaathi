import { randomUUID } from 'crypto';

type FindOptions<T> = {
  where?: Partial<Record<keyof T, unknown>>;
  order?: Partial<Record<keyof T, 'ASC' | 'DESC'>>;
};

type FindOperatorLike<T> = {
  _type?: string;
  _value?: T[];
};

type EntityLike = Record<string, any> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export class InMemoryRepository<T extends EntityLike> {
  private rows: T[];

  constructor(initialRows: T[] = []) {
    this.rows = [...initialRows];
  }

  create(input: Partial<T> | Partial<T>[]): T | T[] {
    if (Array.isArray(input)) {
      return input.map((item) => this.createOne(item));
    }
    return this.createOne(input);
  }

  async save(input: T | T[]): Promise<T | T[]> {
    if (Array.isArray(input)) {
      return Promise.all(input.map((item) => this.saveOne(item)));
    }
    return this.saveOne(input);
  }

  async find(options?: FindOptions<T>): Promise<T[]> {
    const where = options?.where;
    let results = where ? this.rows.filter((row) => this.matches(row, where)) : [...this.rows];
    const [orderKey, direction] = Object.entries(options?.order ?? {})[0] ?? [];
    if (orderKey && direction) {
      results = [...results].sort((a, b) => {
        const left = a[orderKey];
        const right = b[orderKey];
        const comparison = left > right ? 1 : left < right ? -1 : 0;
        return direction === 'DESC' ? comparison * -1 : comparison;
      });
    }
    return results;
  }

  async findOne(options: FindOptions<T>): Promise<T | null> {
    const results = await this.find(options);
    return results[0] ?? null;
  }

  all(): T[] {
    return [...this.rows];
  }

  private createOne(input: Partial<T>): T {
    const now = new Date();
    return {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input
    } as unknown as T;
  }

  private async saveOne(input: T): Promise<T> {
    const now = new Date();
    if (!input.id) {
      input.id = randomUUID();
    }
    if (!input.createdAt) {
      input.createdAt = now;
    }
    input.updatedAt = now;

    const index = this.rows.findIndex((row) => row.id === input.id);
    if (index >= 0) {
      this.rows[index] = input;
    } else {
      this.rows.push(input);
    }
    return input;
  }

  private matches(row: T, where: Partial<Record<keyof T, unknown>>): boolean {
    return Object.entries(where).every(([key, expected]) => {
      if (this.isInOperator(expected)) {
        return expected._value?.includes(row[key]);
      }
      return row[key] === expected;
    });
  }

  private isInOperator(value: unknown): value is FindOperatorLike<unknown> {
    return Boolean(value && typeof value === 'object' && (value as FindOperatorLike<unknown>)._type === 'in');
  }
}
