import type { NotificationBus } from "../events";
import type { StoryEventsPort, StoryEventPayload } from "../interfaces";

export function stubStoryEvents(bus: NotificationBus): StoryEventsPort {
  return {
    publish(event: StoryEventPayload) {
      if (event.kind === "toast") {
        bus.toast(event.message, event.level ?? "info");
      } else if (event.kind === "monthEnd") {
        bus.publish({ type: "monthEnd", summary: event.summary });
        bus.toast(event.summary.headline, "info", 5000);
      } else {
        bus.publish({ type: "story", payload: event });
      }
    },
  };
}
