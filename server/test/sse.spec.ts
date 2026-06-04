import { type Change, type SSEEvent, newId } from "@listo/shared";
import { describe, expect, it } from "vitest";
import { SignalQueue, createSseHub } from "../src/sync/sse-hub.js";
import { makeTestApp } from "./helpers.js";

const change = (seq: number): Change => ({ seq, entity: "item", entityId: "i", fields: [], origin: "X" });

describe("SseHub", () => {
  it("broadcasts to all clients and stops after unsubscribe", () => {
    const hub = createSseHub();
    const a: Change[] = [];
    const b: Change[] = [];
    const unsubA = hub.add({ enqueue: (ch) => a.push(ch) });
    hub.add({ enqueue: (ch) => b.push(ch) });

    hub.broadcast([change(1), change(2)]);
    expect(a.length).toBe(2);
    expect(b.length).toBe(2);

    unsubA();
    hub.broadcast([change(3)]);
    expect(a.length).toBe(2);
    expect(b.length).toBe(3);
  });
});

describe("SignalQueue", () => {
  it("drains accumulated items immediately", async () => {
    const q = new SignalQueue<number>();
    q.push(1);
    q.push(2);
    expect(await q.drain(1_000)).toEqual([1, 2]);
  });

  it("wakes when an item is pushed before the timeout", async () => {
    const q = new SignalQueue<number>();
    const pending = q.drain(5_000);
    q.push(9);
    expect(await pending).toEqual([9]);
  });

  it("returns empty on timeout", async () => {
    const q = new SignalQueue<number>();
    expect(await q.drain(10)).toEqual([]);
  });
});

async function loginCookie(app: ReturnType<typeof makeTestApp>["app"]): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "correct horse battery" }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

async function readSseEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  count: number,
  timeoutMs: number,
): Promise<SSEEvent[]> {
  const decoder = new TextDecoder();
  const events: SSEEvent[] = [];
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  while (events.length < count && Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const result = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: true }>((r) =>
        setTimeout(() => r({ value: undefined, done: true }), Math.max(1, remaining)),
      ),
    ]);
    if (result.done) break;
    buf += decoder.decode(result.value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (data) {
        try {
          events.push(JSON.parse(data) as SSEEvent);
        } catch {
          // ignore non-JSON (heartbeat comments etc.)
        }
      }
    }
  }
  return events;
}

describe("GET /api/sync/stream", () => {
  it("greets with hello and pushes live changes to connected clients", async () => {
    const { app } = makeTestApp();
    const cookie = await loginCookie(app);

    const streamRes = await app.request("/api/sync/stream?since=0", { headers: { cookie } });
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("content-type")).toContain("text/event-stream");
    expect(streamRes.headers.get("x-accel-buffering")).toBe("no");

    const reader = (streamRes.body as ReadableStream<Uint8Array>).getReader();
    try {
      const hello = await readSseEvents(reader, 1, 2_000);
      expect(hello[0]).toMatchObject({ type: "hello", epoch: 1 });

      // Push a mutation from another client; the open stream should receive it live.
      await app.request("/api/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          clientId: "device-B",
          mutations: [
            {
              mutationId: newId(),
              entity: "item",
              entityId: "i-live",
              fields: [{ field: "name", value: "Pain", hlc: { wall: 1_000_000, counter: 0, node: "B" } }],
            },
          ],
        }),
      });

      const live = await readSseEvents(reader, 1, 3_000);
      const changeEvent = live.find((e) => e.type === "change");
      expect(changeEvent).toBeDefined();
      if (changeEvent?.type === "change") {
        expect(changeEvent.change.entityId).toBe("i-live");
        expect(changeEvent.change.origin).toBe("device-B");
      }
    } finally {
      await reader.cancel();
    }
  }, 10_000);
});
