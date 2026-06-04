import type { Change } from "@listo/shared";

/**
 * A queue that lets a consumer await new items but wake up on a timeout too (for
 * heartbeats). Single-consumer per instance.
 */
export class SignalQueue<T> {
  private items: T[] = [];
  private waiter: (() => void) | null = null;

  push(item: T): void {
    this.items.push(item);
    const w = this.waiter;
    this.waiter = null;
    w?.();
  }

  /** Wait up to `timeoutMs`, then return (and clear) whatever has accumulated. */
  async drain(timeoutMs: number): Promise<T[]> {
    if (this.items.length === 0) {
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          this.waiter = null;
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        this.waiter = finish;
      });
    }
    const out = this.items;
    this.items = [];
    return out;
  }
}

export interface SseClient {
  enqueue(change: Change): void;
}

/**
 * Fan-out registry for live SSE connections. Changes are broadcast to EVERY
 * connected client (including the author) so the seq stream each client sees is
 * contiguous — that contiguity is what lets a client detect gaps. Self-authored
 * changes are no-ops on apply (LWW), so echoing them back is harmless.
 */
export interface SseHub {
  add(client: SseClient): () => void;
  broadcast(changes: Change[]): void;
  size(): number;
}

export function createSseHub(): SseHub {
  const clients = new Set<SseClient>();
  return {
    add(client) {
      clients.add(client);
      return () => clients.delete(client);
    },
    broadcast(changes) {
      for (const ch of changes) {
        for (const client of clients) client.enqueue(ch);
      }
    },
    size() {
      return clients.size;
    },
  };
}
