/**
 * Shared option shapes and the memoised `extend` factory behind the
 * environment-based hosting packages' `*Extend()`.
 *
 * @module
 */

import type { ServerEnv } from "./env.ts";
import type { JsonObject } from "./types.ts";

/**
 * The `omit` half of a hosting package's options, generic over the omitted
 * keys so a required field you drop is no longer promised by the result.
 */
export type OmitOptions<TInfo, K extends keyof TInfo = never> = {
  /** Fields to leave out of the rendered object. */
  readonly omit?: readonly K[];
};

/**
 * Options for hosting packages that read the environment: an optional `env`
 * source and the keys to omit.
 */
export type ServerEnvOptions<TInfo, K extends keyof TInfo = never> =
  & OmitOptions<TInfo, K>
  & {
    /** Environment to read instead of the process environment; for tests. */
    readonly env?: ServerEnv;
  };

/**
 * Wrap a memoised server-info reader into an `extend` hook that renders
 * `{ server }`, computed once on the first call and `{}` when off-platform.
 */
export function serverExtend<TInfo extends JsonObject>(
  read: () => TInfo | undefined,
): () => JsonObject {
  let cached: JsonObject | undefined;
  return (): JsonObject => {
    if (cached == null) {
      const server = read();
      cached = server == null ? {} : { server };
    }
    return cached;
  };
}
