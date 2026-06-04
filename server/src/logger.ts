/**
 * Tiny structured logger. Keeps the mono-process image dependency-free; emits
 * one JSON object per line (or a pretty line in dev). It NEVER serializes the
 * config object, so instance password / session secret can't leak into logs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel = "info", pretty = process.stdout.isTTY): Logger {
  const threshold = LEVEL_ORDER[level];

  const log = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVEL_ORDER[lvl] < threshold) return;
    const time = new Date().toISOString();
    if (pretty) {
      const extra = fields && Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
      process.stdout.write(`${time} ${lvl.toUpperCase().padEnd(5)} ${msg}${extra}\n`);
    } else {
      process.stdout.write(`${JSON.stringify({ time, level: lvl, msg, ...fields })}\n`);
    }
  };

  return {
    debug: (m, f) => log("debug", m, f),
    info: (m, f) => log("info", m, f),
    warn: (m, f) => log("warn", m, f),
    error: (m, f) => log("error", m, f),
  };
}
