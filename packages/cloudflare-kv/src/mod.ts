/**
 * Cloudflare Workers KV probe for `@openstatus/health`: reads one key
 * through a `KVNamespace` binding.
 *
 * ```ts
 * import { kvProbe } from "@openstatus/health-cloudflare-kv";
 *
 * const probe = kvProbe({ namespace: env.CACHE });
 * ```
 *
 * @module
 */

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  type ProbeResult,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const kvDefaultName = "kv";
/** Key read when `key` is unset. */
export const kvDefaultKey = "health";

/** The subset of a `KVNamespace` binding the probe uses. */
export interface KVLikeNamespace {
  /** Read one key; resolves with `null` when it does not exist. */
  get(key: string): PromiseLike<ProbeResult>;
}

/** Options for `kvProbe()`. */
export interface KVProbeOptions extends ProbeOverrides {
  /** The `KVNamespace` binding from `env`. */
  readonly namespace: KVLikeNamespace;
  /** Key to read. Default `kvDefaultKey`; it does not need to exist. */
  readonly key?: string;
}

/** A probe that reads `key`; non-critical by default. Throws `ProbeConfigError` without `get()` or with an empty `key`. */
export function kvProbe(options: KVProbeOptions): Probe {
  const namespace = options.namespace;
  if (typeof namespace?.get !== "function") {
    throw new ProbeConfigError(
      "kvProbe",
      "namespace",
      `must expose get(), got ${describe(namespace)}`,
    );
  }
  const key = options.key ?? kvDefaultKey;
  if (typeof key !== "string" || key.length === 0) {
    throw new ProbeConfigError(
      "kvProbe",
      "key",
      typeof key !== "string"
        ? `must be a string, got ${String(key)}`
        : "must not be empty",
    );
  }
  return {
    name: options.name ?? kvDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await namespace.get(key);
    },
  };
}

function describe(namespace: KVLikeNamespace): string {
  if (namespace == null) return String(namespace);
  if (typeof namespace !== "object") return typeof namespace;
  const keys = Object.keys(namespace);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
