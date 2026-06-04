import { describe, expect, it } from "vitest";
import {
  HLC_INITIAL,
  type Hlc,
  compareHlc,
  exceedsDrift,
  formatHlc,
  hlcEquals,
  maxHlc,
  observe,
  parseHlc,
  receive,
  tick,
} from "../src/hlc.js";

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

describe("formatHlc / parseHlc", () => {
  it("round-trips", () => {
    const h: Hlc = { wall: 1_717_497_600_000, counter: 42, node: "client-1" };
    expect(parseHlc(formatHlc(h))).toEqual(h);
  });

  it("produces lexicographically sortable strings consistent with compareHlc", () => {
    const hlcs: Hlc[] = [
      { wall: 100, counter: 0, node: "B" },
      { wall: 100, counter: 0, node: "A" },
      { wall: 100, counter: 1, node: "A" },
      { wall: 90, counter: 9, node: "Z" },
      { wall: 101, counter: 0, node: "A" },
    ];
    const byCompare = [...hlcs].sort(compareHlc).map(formatHlc);
    const byString = [...hlcs].map(formatHlc).sort();
    expect(byString).toEqual(byCompare);
  });

  it("rejects malformed strings", () => {
    expect(() => parseHlc("nope")).toThrow();
    expect(() => parseHlc("100:0")).toThrow();
  });
});

describe("compareHlc", () => {
  it("orders by wall, then counter, then node", () => {
    expect(compareHlc({ wall: 1, counter: 0, node: "A" }, { wall: 2, counter: 0, node: "A" })).toBe(-1);
    expect(compareHlc({ wall: 2, counter: 5, node: "A" }, { wall: 2, counter: 0, node: "Z" })).toBe(1);
    expect(compareHlc({ wall: 2, counter: 0, node: "A" }, { wall: 2, counter: 0, node: "B" })).toBe(-1);
    expect(compareHlc({ wall: 2, counter: 0, node: "A" }, { wall: 2, counter: 0, node: "A" })).toBe(0);
  });

  it("maxHlc and hlcEquals agree with compareHlc", () => {
    const a: Hlc = { wall: 5, counter: 1, node: "A" };
    const b: Hlc = { wall: 5, counter: 2, node: "A" };
    expect(maxHlc(a, b)).toBe(b);
    expect(hlcEquals(a, { ...a })).toBe(true);
    expect(hlcEquals(a, b)).toBe(false);
  });
});

describe("tick (local send)", () => {
  it("is strictly monotonic even within the same millisecond", () => {
    let state = HLC_INITIAL;
    let prev: Hlc | null = null;
    for (let i = 0; i < 1000; i++) {
      const r = tick(state, "A", 1000);
      state = r.state;
      if (prev) expect(compareHlc(r.hlc, prev)).toBe(1);
      prev = r.hlc;
    }
  });

  it("tracks physical time forward and resets the counter on a new ms", () => {
    const first = tick(HLC_INITIAL, "A", 1000);
    expect(first.hlc).toMatchObject({ wall: 1000, counter: 0 });
    const second = tick(first.state, "A", 1005);
    expect(second.hlc).toMatchObject({ wall: 1005, counter: 0 });
  });

  it("does not move the wall backward when the physical clock regresses", () => {
    const ahead = tick({ wall: 5000, counter: 0 }, "A", 1000);
    expect(ahead.hlc.wall).toBe(5000);
    expect(ahead.hlc.counter).toBe(1);
  });
});

describe("receive (merge remote, emit local)", () => {
  it("advances past a remote that is ahead and stamps the local node", () => {
    const remote: Hlc = { wall: 5000, counter: 3, node: "B" };
    const r = receive(HLC_INITIAL, remote, "A", 1000);
    expect(r.hlc).toEqual({ wall: 5000, counter: 4, node: "A" });
    expect(compareHlc(r.hlc, remote)).toBe(1);
  });

  it("takes max counter + 1 when local, remote and physical share the wall", () => {
    const r = receive({ wall: 1000, counter: 7 }, { wall: 1000, counter: 4, node: "B" }, "A", 1000);
    expect(r.hlc).toEqual({ wall: 1000, counter: 8, node: "A" });
  });
});

describe("observe (advance without emitting)", () => {
  it("pulls the clock up to a remote without bumping the counter", () => {
    const s = observe(HLC_INITIAL, { wall: 5000, counter: 3, node: "B" }, 1000);
    expect(s).toEqual({ wall: 5000, counter: 3 });
  });
});

describe("exceedsDrift (server guard)", () => {
  it("flags an implausibly future wall and tolerates a reasonable one", () => {
    expect(exceedsDrift({ wall: 100_000, counter: 0, node: "A" }, 1000, 60_000)).toBe(true);
    expect(exceedsDrift({ wall: 50_000, counter: 0, node: "A" }, 1000, 60_000)).toBe(false);
    // The server never clamps; a behind-the-server wall is fine.
    expect(exceedsDrift({ wall: 10, counter: 0, node: "A" }, 1000, 60_000)).toBe(false);
  });
});

describe("counter rollover", () => {
  it("carries an overflowed counter into the next millisecond", () => {
    const MAX = 36 ** 5 - 1;
    const r = tick({ wall: 1000, counter: MAX }, "A", 1000);
    expect(r.state).toEqual({ wall: 1001, counter: 0 });
  });
});

describe("LWW convergence (order independence)", () => {
  it("picks the same winner regardless of application order", () => {
    const writes = [
      { value: "a", hlc: { wall: 100, counter: 0, node: "A" } as Hlc },
      { value: "b", hlc: { wall: 100, counter: 1, node: "B" } as Hlc },
      { value: "c", hlc: { wall: 90, counter: 5, node: "C" } as Hlc },
      { value: "d", hlc: { wall: 100, counter: 0, node: "B" } as Hlc },
    ];
    const winner = (ws: typeof writes) =>
      ws.reduce<(typeof writes)[number] | null>(
        (acc, w) => (acc === null || compareHlc(w.hlc, acc.hlc) > 0 ? w : acc),
        null,
      );
    const expected = winner(writes)?.value;
    expect(expected).toBe("b");
    for (const perm of permutations(writes)) {
      expect(winner(perm)?.value).toBe(expected);
    }
  });
});
