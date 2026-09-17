/**
 * Disk space probe for `@openstatus/health`: reads the free space of the
 * filesystem holding `path` and fails below a threshold.
 *
 * ```ts
 * import { diskProbe } from "@openstatus/health-disk";
 *
 * const probe = diskProbe({ path: "/data", minFreePercent: 10 });
 * ```
 *
 * Node.js, Deno and Bun only: it uses `node:fs`.
 *
 * @module
 */

import { statfs as fsStatfs } from "node:fs/promises";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const diskDefaultName = "disk";
/** Path when `path` is unset. */
export const diskDefaultPath = ".";
/** Threshold when neither `minFreePercent` nor `minFreeBytes` is set. */
export const diskDefaultMinFreePercent = 10;

/** The subset of `fs.StatsFs` the probe reads. */
export interface DiskStats {
  /** Block size in bytes. */
  readonly bsize: number;
  /** Total blocks. */
  readonly blocks: number;
  /** Blocks available to unprivileged users. */
  readonly bavail: number;
}

/** What the probe reads the filesystem with; `fs.promises.statfs` by default. */
export type DiskStatfs = (path: string) => PromiseLike<DiskStats>;

/** Options for `diskProbe()`. */
export interface DiskProbeOptions extends ProbeOverrides {
  /** Any path on the filesystem to check. Default `diskDefaultPath`. */
  readonly path?: string;
  /** Fail when free space drops below this percentage of the total. Default `diskDefaultMinFreePercent` unless `minFreeBytes` is set. */
  readonly minFreePercent?: number;
  /** Fail when fewer bytes than this are free. */
  readonly minFreeBytes?: number;
  /** Replacement `statfs`, for tests. */
  readonly statfs?: DiskStatfs;
}

/** What a healthy check resolves with. */
export interface DiskUsage {
  /** Bytes available. */
  readonly freeBytes: number;
  /** Bytes in total. */
  readonly totalBytes: number;
  /** `freeBytes` as a percentage of `totalBytes`, rounded to one decimal. */
  readonly freePercent: number;
}

/** Thrown by the probe when free space is below the threshold. */
export class DiskSpaceError extends Error {
  /** The usage that crossed the threshold. */
  readonly usage: DiskUsage;

  /** Build the error for `usage` against the threshold described by `reason`. */
  constructor(usage: DiskUsage, reason: string) {
    super(reason);
    this.name = "DiskSpaceError";
    this.usage = usage;
  }
}

/** A probe that fails when free space is below `minFreePercent` or `minFreeBytes`; non-critical by default. Throws `ProbeConfigError` for an empty `path` or a negative threshold. */
export function diskProbe(options: DiskProbeOptions = {}): Probe {
  const path = options.path ?? diskDefaultPath;
  if (typeof path !== "string" || path.length === 0) {
    throw new ProbeConfigError(
      "diskProbe",
      "path",
      typeof path !== "string"
        ? `must be a string, got ${String(path)}`
        : "must not be empty",
    );
  }
  const minFreeBytes = options.minFreeBytes;
  const minFreePercent = options.minFreePercent ??
    (minFreeBytes == null ? diskDefaultMinFreePercent : undefined);
  for (
    const [field, value] of [
      ["minFreePercent", minFreePercent],
      ["minFreeBytes", minFreeBytes],
    ] as const
  ) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      throw new ProbeConfigError(
        "diskProbe",
        field,
        `must be a non-negative number, got ${String(value)}`,
      );
    }
  }
  const statfs = options.statfs ?? fsStatfs;
  return {
    name: options.name ?? diskDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      const stats = await statfs(path);
      const usage = toUsage(stats);
      if (minFreeBytes != null && usage.freeBytes < minFreeBytes) {
        throw new DiskSpaceError(
          usage,
          `${usage.freeBytes} bytes free, fewer than ${minFreeBytes}`,
        );
      }
      if (
        minFreePercent != null &&
        (usage.freeBytes / usage.totalBytes) * 100 < minFreePercent
      ) {
        throw new DiskSpaceError(
          usage,
          `${usage.freePercent}% free, less than ${minFreePercent}%`,
        );
      }
      return usage;
    },
  };
}

function toUsage(stats: DiskStats): DiskUsage {
  const { bsize, blocks, bavail } = stats;
  if (
    ![bsize, blocks, bavail].every((n) => Number.isFinite(n) && n >= 0) ||
    bsize === 0 || blocks === 0
  ) {
    throw new Error("unexpected statfs result");
  }
  const totalBytes = blocks * bsize;
  const freeBytes = bavail * bsize;
  return {
    freeBytes,
    totalBytes,
    freePercent: Math.round((freeBytes / totalBytes) * 1000) / 10,
  };
}
