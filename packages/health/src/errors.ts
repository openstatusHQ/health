import type { FormatError, FormatErrorOption } from "./types.ts";

export class ProbeTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`timed out after ${timeoutMs}ms`);
    this.name = "ProbeTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class DuplicateProbeError extends Error {
  readonly probeName: string;

  constructor(probeName: string) {
    super(
      `duplicate probe name ${
        JSON.stringify(probeName)
      }: pass a different \`name\` to one of the probes`,
    );
    this.name = "DuplicateProbeError";
    this.probeName = probeName;
  }
}

export class ProbeConfigError extends Error {
  readonly probe: string;
  readonly field: string;

  constructor(probe: string, field: string, reason: string) {
    super(`${probe}: ${JSON.stringify(field)} ${reason}`);
    this.name = "ProbeConfigError";
    this.probe = probe;
    this.field = field;
  }
}

export const genericFormatError: FormatError = (error) =>
  error instanceof ProbeTimeoutError ? error.message : "failed";

export const messageFormatError: FormatError = (error) => error.message;

export function resolveFormatError(
  option: FormatErrorOption | undefined,
): FormatError {
  if (option == null || option === "generic") return genericFormatError;
  if (option === "message") return messageFormatError;
  return option;
}

export function toError<T>(value: T): Error {
  try {
    if (value instanceof Error) return value;
    return new Error(String(value));
  } catch {
    return new Error("failed");
  }
}
