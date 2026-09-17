/**
 * S3 probe for `@openstatus/health`: sends `HeadBucket` through an
 * `@aws-sdk/client-s3` client, so it covers AWS S3, Cloudflare R2, Tigris,
 * MinIO and every other S3-compatible store.
 *
 * ```ts
 * import { S3Client } from "@aws-sdk/client-s3";
 * import { s3Probe } from "@openstatus/health-s3";
 *
 * const probe = s3Probe({ client: new S3Client({}), bucket: "uploads" });
 * ```
 *
 * @module
 */

import { HeadBucketCommand } from "@aws-sdk/client-s3";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  type ProbeResult,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const s3DefaultName = "storage";

/** What the probe passes to `send()` after the command. */
export interface S3SendOptions {
  /** Aborts when the probe times out. */
  readonly abortSignal?: AbortSignal;
}

/** The subset of an `S3Client` the probe uses. */
export interface S3LikeClient {
  /** Send one command. */
  send(
    command: HeadBucketCommand,
    options?: S3SendOptions,
  ): PromiseLike<ProbeResult>;
}

/** Options for `s3Probe()`. */
export interface S3ProbeOptions extends ProbeOverrides {
  /** An `S3Client`. */
  readonly client: S3LikeClient;
  /** Bucket to `HeadBucket`. */
  readonly bucket: string;
}

/** A probe that sends `HeadBucket`; non-critical by default. Throws `ProbeConfigError` without `send()` or with an empty `bucket`. */
export function s3Probe(options: S3ProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.send !== "function") {
    throw new ProbeConfigError(
      "s3Probe",
      "client",
      `must expose send(), got ${describe(client)}`,
    );
  }
  const bucket = options.bucket;
  if (typeof bucket !== "string" || bucket.length === 0) {
    throw new ProbeConfigError(
      "s3Probe",
      "bucket",
      typeof bucket !== "string"
        ? `must be a string, got ${String(bucket)}`
        : "must not be empty",
    );
  }
  return {
    name: options.name ?? s3DefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      await client.send(new HeadBucketCommand({ Bucket: bucket }), {
        abortSignal: signal,
      });
    },
  };
}

function describe(client: S3LikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
