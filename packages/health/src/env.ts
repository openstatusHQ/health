/**
 * Portable environment lookup.
 *
 * @module
 */

/** A record of environment variables, as `process.env` or a test double. */
export type ServerEnv = Readonly<Record<string, string | undefined>>;

type ProcessLike = { env?: ServerEnv };

type DenoLike = { env?: { get(name: string): string | undefined } };

/**
 * Read one environment variable through `process.env` or `Deno.env`, or from
 * `source` when given. Returns `undefined` instead of throwing where access is
 * denied.
 */
export function readEnv(
  name: string,
  source?: ServerEnv,
): string | undefined {
  if (source != null) return source[name];
  const runtime = globalThis as { process?: ProcessLike; Deno?: DenoLike };
  return readProcessEnv(runtime, name) ?? readDenoEnv(runtime, name);
}

/**
 * Read one environment variable as non-empty text: `undefined` when the
 * variable is missing or set to `""`.
 */
export function readEnvText(
  name: string,
  source?: ServerEnv,
): string | undefined {
  const value = readEnv(name, source);
  return value == null || value === "" ? undefined : value;
}

/**
 * Read one environment variable as a finite number: `undefined` when the
 * variable is missing, empty, or not a number.
 */
export function readEnvCount(
  name: string,
  source?: ServerEnv,
): number | undefined {
  const value = readEnvText(name, source);
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readProcessEnv(
  runtime: { process?: ProcessLike },
  name: string,
): string | undefined {
  try {
    return runtime.process?.env?.[name];
  } catch {
    return undefined;
  }
}

function readDenoEnv(
  runtime: { Deno?: DenoLike },
  name: string,
): string | undefined {
  try {
    return runtime.Deno?.env?.get(name);
  } catch {
    return undefined;
  }
}
