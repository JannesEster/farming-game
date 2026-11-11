import type { StoryEventPayload } from "./interfaces";
import type { MonthEndSummary } from "./types";

export type NotificationLevel = "info" | "warn" | "urgent";

export type IntegrationEvent =
  | { type: "toast"; message: string; level: NotificationLevel; ttlMs?: number }
  | { type: "monthEnd"; summary: MonthEndSummary }
  | { type: "story"; payload: StoryEventPayload };

export type IntegrationListener = (event: IntegrationEvent) => void;

export class NotificationBus {
  private listeners = new Set<IntegrationListener>();

  subscribe(listener: IntegrationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(event: IntegrationEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  toast(message: string, level: NotificationLevel = "info", ttlMs?: number): void {
    this.publish({ type: "toast", message, level, ttlMs });
  }
}
