import type { Reference } from "@/components/CaseAgent/types/reference-types";

type Subscriber = (reference: Reference) => void;

class ChatSelectionBus {
  private subscribers: Subscriber[] = [];
  private queue: Reference[] = [];

  subscribe(callback: Subscriber): () => void {
    this.subscribers.push(callback);

    // Flush any queued references to the new subscriber
    if (this.queue.length > 0) {
      for (const ref of this.queue) {
        try {
          callback(ref);
        } catch {
          // ignore callback errors to avoid breaking the flush
        }
      }
      this.queue = [];
    }

    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== callback);
    };
  }

  publish(reference: Reference): void {
    if (this.subscribers.length === 0) {
      // No active subscribers – buffer until someone subscribes
      this.queue.push(reference);
      return;
    }
    this.subscribers.forEach((sub) => sub(reference));
  }
}

export const chatSelectionBus = new ChatSelectionBus();

