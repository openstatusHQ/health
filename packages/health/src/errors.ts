/**
 * Error classes thrown by the core and the probe factories, plus the built-in
 * `formatError` implementations.
 *
 * @module
 */

import type { FormatError, FormatErrorOption } from "./types.ts";

/** The `signal.reason` a probe receives when its timeout fires. */
export class ProbeTimeoutError extends Error {
  /** The timeout that elapsed, in milliseconds. */
  readonly timeoutMs: number;

  /** Build the error for a timeout of `timeoutMs` milliseconds. */
  constructor(timeoutMs: number) {
    super(`timed out after ${timeoutMs}ms`);
    this.name = "ProbeTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** Thrown by `createHealthCheck()` when two probes share a `name`. */
export class DuplicateProbeError extends Error {
  /** The name that appeared twice. */
  readonly probeName: string;

  /** Build the error for the repeated `probeName`. */
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

/** Thrown by a probe factory for an invalid option. */
export class ProbeConfigError extends Error {
  /** The factory that rejected the option, e.g. `"upstashProbe"`. */
  readonly probe: string;
  /** The option that was invalid. */
  readonly field: string;

  /** Build the error for `probe`'s `field`; `reason` is appended to the message. */
  constructor(probe: string, field: string, reason: string) {
    super(`${probe}: ${JSON.stringify(field)} ${reason}`);
    this.name = "ProbeConfigError";
    this.probe = probe;
    this.field = field;
  }
}

/** The `"generic"` formatter: `"failed"`, or the timeout message. */
export const genericFormatError: FormatError = (error): string =>
  error instanceof ProbeTimeoutError ? error.message : "failed";

/** The `"message"` formatter: `error.message` verbatim. */
export const messageFormatError: FormatError = (error): string => error.message;

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
