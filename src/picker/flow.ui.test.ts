// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  closePickerScreen,
  openOfferPicker,
  openStartScreen,
  setPickerFlowHost,
  type PickerSlotSummary,
} from "./flow";

describe("picker screen remount", () => {
  let active = 0;
  const slots: PickerSlotSummary[] = [
    { id: 0, occupied: false, label: "Empty" },
    { id: 1, occupied: true, label: "1/9/2026" },
    { id: 2, occupied: false, label: "Empty" },
  ];

  beforeEach(() => {
    document.body.innerHTML = "";
    active = 0;
    setPickerFlowHost({
      hasSavedGame: () => slots[active]?.occupied ?? false,
      onContinue: () => {},
      onRequestOffers: () => {},
      onPurchased: () => {},
      slots: () => slots,
      activeSlot: () => active,
      onSelectSlot: (id) => {
        active = id;
        openStartScreen();
      },
    });
  });

  it("remounts the offer list after the start screen is destroyed", () => {
    openStartScreen();
    expect(document.querySelector("[data-test=start-screen]")).toBeTruthy();
    closePickerScreen();
    openOfferPicker();
    const picker = document.querySelector("[data-test=farm-picker]");
    expect(picker).toBeTruthy();
    expect(picker?.isConnected).toBe(true);
    expect(document.getElementById("picker-root")?.isConnected).toBe(true);
  });

  it("switches the highlighted save slot and enables continue", () => {
    openStartScreen();
    const continueBtn = document.querySelector<HTMLButtonElement>('[data-action="continue"]');
    expect(continueBtn?.disabled).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-slot="1"]')?.click();
    expect(document.querySelector('[data-slot="1"]')?.classList.contains("active")).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-action="continue"]')?.disabled).toBe(false);
    expect(active).toBe(1);
  });
});
