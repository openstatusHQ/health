/**
 * Cloudflare R2 probe for `@openstatus/health`: sends a `HEAD` for one
 * object through an `R2Bucket` binding.
 *
 * ```ts
 * import { r2Probe } from "@openstatus/health-cloudflare-r2";
 *
 * const probe = r2Probe({ bucket: env.UPLOADS });
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
export const r2DefaultName = "storage";
/** Object key checked when `key` is unset. */
export const r2DefaultKey = "health";

/** The subset of an `R2Bucket` binding the probe uses. */
export interface R2LikeBucket {
  /** Fetch one object's metadata; resolves with `null` when it does not exist. */
  head(key: string): PromiseLike<ProbeResult>;
}

/** Options for `r2Probe()`. */
export interface R2ProbeOptions extends ProbeOverrides {
  /** The `R2Bucket` binding from `env`. */
  readonly bucket: R2LikeBucket;
  /** Object key to `HEAD`. Default `r2DefaultKey`; it does not need to exist. */
  readonly key?: string;
}

/** A probe that heads `key`; non-critical by default. Throws `ProbeConfigError` without `head()` or with an empty `key`. */
export function r2Probe(options: R2ProbeOptions): Probe {
  const bucket = options.bucket;
  if (typeof bucket?.head !== "function") {
    throw new ProbeConfigError(
      "r2Probe",
      "bucket",
      `must expose head(), got ${describe(bucket)}`,
    );
  }
  const key = options.key ?? r2DefaultKey;
  if (typeof key !== "string" || key.length === 0) {
    throw new ProbeConfigError(
      "r2Probe",
      "key",
      typeof key !== "string"
        ? `must be a string, got ${String(key)}`
        : "must not be empty",
    );
  }
  return {
    name: options.name ?? r2DefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await bucket.head(key);
    },
  };
}

function describe(bucket: R2LikeBucket): string {
  if (bucket == null) return String(bucket);
  if (typeof bucket !== "object") return typeof bucket;
  const keys = Object.keys(bucket);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
