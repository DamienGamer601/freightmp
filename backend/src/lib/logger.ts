type LogLevel = "debug" | "info" | "warn" | "error";

function write(level: LogLevel, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console[level](prefix, message, meta);
  } else {
    // eslint-disable-next-line no-console
    console[level](prefix, message);
  }
}

export const logger = {
  debug: (message: string, meta?: unknown): void => write("debug", message, meta),
  info: (message: string, meta?: unknown): void => write("info", message, meta),
  warn: (message: string, meta?: unknown): void => write("warn", message, meta),
  error: (message: string, meta?: unknown): void => write("error", message, meta),
};
