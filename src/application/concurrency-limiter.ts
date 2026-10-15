import { TooManyAuditsError } from './errors.js';

export class ConcurrencyLimiter {
  private running = 0;

  constructor(private readonly max: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.running >= this.max) throw new TooManyAuditsError();
    this.running++;
    try {
      return await task();
    } finally {
      this.running--;
    }
  }
}