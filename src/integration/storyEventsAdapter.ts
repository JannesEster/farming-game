import type { NotificationBus } from "./events";
import type { StoryEventsPort, StoryEventPayload } from "./interfaces";
import type { GameFlowService } from "./GameFlowService";

export function createStoryEventsAdapter(
  bus: NotificationBus,
  flow: GameFlowService,
): StoryEventsPort {
  return {
    publish(event: StoryEventPayload) {
      if (event.kind === "toast") {
        bus.toast(event.message, event.level ?? "info");
      } else if (event.kind === "monthEnd") {
        bus.publish({ type: "monthEnd", summary: event.summary });
        flow.showStoryCard("Month in review", event.summary.headline);
      } else {
        bus.publish({ type: "story", payload: event });
      }
    },
  };
}
