/** Plain player text for internal action ids. */

export function diaryLineForPlayerAction(actionId: string): string {
  switch (actionId) {
    case "night_guard":
      return "Jackal scare: night guard posted.";
    case "fix_fence":
      return "Jackal scare: fence gap patched.";
    case "repair_now":
      return "Pump fault: repaired on site.";
    case "defer_fix":
      return "Pump fault: left for later.";
    case "accept_offer":
      return "Buyer offer accepted.";
    case "decline":
      return "Buyer offer declined.";
    case "ignore":
      return "Predator risk taken.";
    default:
      return "Farm decision logged.";
  }
}
