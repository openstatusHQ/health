/**
 * Portable environment lookup.
 *
 * @module
 */

type EnvSource = Readonly<Record<string, string | undefined>>;

type ProcessLike = { env?: EnvSource };

type DenoLike = { env?: { get(name: string): string | undefined } };

/**
 * Read one environment variable through `process.env` or `Deno.env`, or from
 * `source` when given. Returns `undefined` instead of throwing where access is
 * denied.
 */
export function readEnv(
  name: string,
  source?: Readonly<Record<string, string | undefined>>,
): string | undefined {
  if (source != null) return source[name];
  const runtime = globalThis as { process?: ProcessLike; Deno?: DenoLike };
  return readProcessEnv(runtime, name) ?? readDenoEnv(runtime, name);
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
