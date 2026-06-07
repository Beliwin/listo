/**
 * Tiny haptic feedback helper. A no-op when the device has no vibration motor
 * (most desktops, iOS Safari) or when the user asked for reduced motion — so
 * callers can fire it unconditionally. Purely local, no permissions.
 */

type Pattern = "tick" | "success";

const PATTERNS: Record<Pattern, number | number[]> = {
  tick: 12,
  success: [14, 40, 22],
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Fire a short vibration. Safe to call anywhere; silently does nothing when unsupported. */
export function vibrate(pattern: Pattern = "tick"): void {
  if (prefersReducedMotion()) return;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (!nav || typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(PATTERNS[pattern]);
  } catch {
    /* ignore — some browsers throw on rapid calls */
  }
}

export function useHaptics(): { vibrate: typeof vibrate } {
  return { vibrate };
}
