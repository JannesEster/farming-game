import { describe, expect, it } from "vitest";
import { diaryLineForPlayerAction } from "./playCopy";

describe("playCopy", () => {
  it("never exposes raw action ids in diary lines", () => {
    expect(diaryLineForPlayerAction("night_guard")).not.toMatch(/night_guard/);
    expect(diaryLineForPlayerAction("night_guard")).toContain("night guard");
  });
});
