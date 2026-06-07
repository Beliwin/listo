import { afterEach, describe, expect, it, vi } from "vitest";
import { vibrate } from "@/composables/useHaptics";

function mockReducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce") }) as MediaQueryList);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("vibrate", () => {
  it("calls navigator.vibrate with the tick pattern by default", () => {
    mockReducedMotion(false);
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate();
    expect(spy).toHaveBeenCalledWith(12);
  });

  it("uses the success pattern when asked", () => {
    mockReducedMotion(false);
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate("success");
    expect(spy).toHaveBeenCalledWith([14, 40, 22]);
  });

  it("is a no-op under prefers-reduced-motion", () => {
    mockReducedMotion(true);
    const spy = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate: spy });
    vibrate();
    expect(spy).not.toHaveBeenCalled();
  });

  it("is a no-op when vibrate is unsupported", () => {
    mockReducedMotion(false);
    vi.stubGlobal("navigator", {});
    expect(() => vibrate()).not.toThrow();
  });

  it("swallows errors thrown by navigator.vibrate", () => {
    mockReducedMotion(false);
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("too many calls");
      },
    });
    expect(() => vibrate()).not.toThrow();
  });
});
