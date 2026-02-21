/**
 * AsyncEventChannel enables interleaved streaming from parallel async producers.
 * Each producer pushes events into the channel, and the consumer iterates
 * with for-await-of, receiving events as they arrive.
 */
export class AsyncEventChannel<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private closed = false;
  private waitResolve: (() => void) | null = null;

  /** Push an event into the channel. Can be called from any async context. */
  push(event: T): void {
    if (this.closed) return;
    this.queue.push(event);
    if (this.waitResolve) {
      const resolve = this.waitResolve;
      this.waitResolve = null;
      resolve();
    }
  }

  /** Signal that no more events will be pushed. */
  close(): void {
    this.closed = true;
    if (this.waitResolve) {
      const resolve = this.waitResolve;
      this.waitResolve = null;
      resolve();
    }
  }

  /** Whether the channel has been closed and all events have been consumed. */
  get isDrained(): boolean {
    return this.closed && this.queue.length === 0;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      // Drain any queued events
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }

      // If closed and nothing left, we're done
      if (this.closed) {
        return;
      }

      // Wait for more events
      await new Promise<void>((resolve) => {
        this.waitResolve = resolve;
      });
    }
  }
}
