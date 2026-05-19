// Minimal structured logger. One JSON line per call to stdout/stderr so logs
// are greppable in any host (Vercel/Neon/console) without a logging dependency.
// Safe in Node and Edge runtimes: only uses console.log / console.error.
//
// Shape: { level, ts: <ISO>, msg, ...fields }
// Usage:  log.info("step.timing", { step, ms })
//         log.error("generate.failed", { error })

type Fields = Record<string, unknown>;

function emit(
  level: "debug" | "info" | "warn" | "error",
  msg: string,
  fields?: Fields
): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    msg,
    ...fields,
  });
  // Errors/warnings to stderr, the rest to stdout — never throw from logging.
  try {
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
  } catch {
    /* logging must never break the caller */
  }
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
};
