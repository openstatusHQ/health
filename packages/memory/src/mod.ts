/**
 * Memory probe for `@openstatus/health`: compares the process's heap usage
 * with the V8 heap limit, and its resident set size with a byte budget,
 * and fails above either threshold.
 *
 * ```ts
 * import { memoryProbe } from "@openstatus/health-memory";
 *
 * const probe = memoryProbe({ maxHeapUsedPercent: 90 });
 * ```
 *
 * Node.js, Deno and Bun only: it uses `node:process` and `node:v8`.
 *
 * @module
 */

import process from "node:process";
import { getHeapStatistics } from "node:v8";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const memoryDefaultName = "memory";
/** Threshold when neither `maxHeapUsedPercent` nor `maxRssBytes` is set. */
export const memoryDefaultMaxHeapUsedPercent = 90;

/** The subset of `process.memoryUsage()` the probe reads. */
export interface MemoryUsageSample {
  /** Bytes of V8 heap in use. */
  readonly heapUsed: number;
  /** Resident set size in bytes. */
  readonly rss: number;
}

/** The subset of `v8.getHeapStatistics()` the probe reads. */
export interface HeapStatisticsSample {
  /** The maximum heap size V8 will grow to. */
  readonly heap_size_limit: number;
}

/** Options for `memoryProbe()`. */
export interface MemoryProbeOptions extends ProbeOverrides {
  /** Fail when the heap in use exceeds this percentage of the heap limit. Default `memoryDefaultMaxHeapUsedPercent` unless `maxRssBytes` is set. */
  readonly maxHeapUsedPercent?: number;
  /** Fail when the resident set size exceeds this many bytes. */
  readonly maxRssBytes?: number;
  /** Replacement `process.memoryUsage`, for tests. */
  readonly memoryUsage?: () => MemoryUsageSample;
  /** Replacement `v8.getHeapStatistics`, for tests. */
  readonly heapStatistics?: () => HeapStatisticsSample;
}

/** What a healthy check resolves with. */
export interface MemoryReading {
  /** Bytes of heap in use. */
  readonly heapUsedBytes: number;
  /** The heap limit in bytes. */
  readonly heapLimitBytes: number;
  /** `heapUsedBytes` as a percentage of `heapLimitBytes`, rounded to one decimal. */
  readonly heapUsedPercent: number;
  /** Resident set size in bytes. */
  readonly rssBytes: number;
}

/** Thrown by the probe when usage is above a threshold. */
export class MemoryPressureError extends Error {
  /** The reading that crossed the threshold. */
  readonly reading: MemoryReading;

  /** Build the error for `reading` against the threshold described by `reason`. */
  constructor(reading: MemoryReading, reason: string) {
    super(reason);
    this.name = "MemoryPressureError";
    this.reading = reading;
  }
}

/** A probe that fails above `maxHeapUsedPercent` or `maxRssBytes`; non-critical by default. Throws `ProbeConfigError` for a negative threshold. */
export function memoryProbe(options: MemoryProbeOptions = {}): Probe {
  const maxRssBytes = options.maxRssBytes;
  const maxHeapUsedPercent = options.maxHeapUsedPercent ??
    (maxRssBytes == null ? memoryDefaultMaxHeapUsedPercent : undefined);
  for (
    const [field, value] of [
      ["maxHeapUsedPercent", maxHeapUsedPercent],
      ["maxRssBytes", maxRssBytes],
    ] as const
  ) {
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      throw new ProbeConfigError(
        "memoryProbe",
        field,
        `must be a non-negative number, got ${String(value)}`,
      );
    }
  }
  const memoryUsage = options.memoryUsage ?? (() => process.memoryUsage());
  const heapStatistics = options.heapStatistics ?? getHeapStatistics;
  return {
    name: options.name ?? memoryDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: () => {
      const reading = read(memoryUsage(), heapStatistics());
      if (maxRssBytes != null && reading.rssBytes > maxRssBytes) {
        throw new MemoryPressureError(
          reading,
          `rss ${reading.rssBytes} bytes exceeds ${maxRssBytes}`,
        );
      }
      if (
        maxHeapUsedPercent != null &&
        reading.heapUsedPercent > maxHeapUsedPercent
      ) {
        throw new MemoryPressureError(
          reading,
          `heap ${reading.heapUsedPercent}% used exceeds ${maxHeapUsedPercent}%`,
        );
      }
      return reading;
    },
  };
}

function read(
  usage: MemoryUsageSample,
  heap: HeapStatisticsSample,
): MemoryReading {
  const heapUsedBytes = usage.heapUsed;
  const heapLimitBytes = heap.heap_size_limit;
  const rssBytes = usage.rss;
  if (
    ![heapUsedBytes, heapLimitBytes, rssBytes].every((n) =>
      typeof n === "number" && n >= 0
    ) || heapLimitBytes === 0
  ) {
    throw new Error("unexpected memory statistics");
  }
  return {
    heapUsedBytes,
    heapLimitBytes,
    heapUsedPercent: Math.round((heapUsedBytes / heapLimitBytes) * 1000) / 10,
    rssBytes,
  };
}
