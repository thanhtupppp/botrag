type LogLevel = "info" | "warn" | "error";

type BaseEvent = {
  level: LogLevel;
  name: string;
  ts: string;
};

export function logEvent<T extends Record<string, unknown>>(
  name: string,
  payload: T,
  level: LogLevel = "info",
) {
  const evt: BaseEvent & T = {
    level,
    name,
    ts: new Date().toISOString(),
    ...payload,
  };

  // eslint-disable-next-line no-console
  console[level]?.(JSON.stringify(evt));
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  meta: Record<string, unknown> = {},
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    logEvent(`${name}.success`, { durationMs, ...meta }, "info");
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    logEvent(
      `${name}.error`,
      {
        durationMs,
        error: String(err instanceof Error ? err.message : err),
        ...meta,
      },
      "error",
    );
    throw err;
  }
}
