/**
 * BullMQ probe for `@openstatus/health`: counts the waiting jobs of a
 * `Queue`, which round-trips to Redis, and optionally fails above a backlog
 * threshold.
 *
 * ```ts
 * import { Queue } from "bullmq";
 * import { bullmqProbe } from "@openstatus/health-bullmq";
 *
 * const probe = bullmqProbe({ queue: new Queue("emails"), maxWaiting: 10_000 });
 * ```
 *
 * @module
 */

import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const bullmqDefaultName = "queue";

/** The subset of a BullMQ `Queue` the probe uses. */
export interface BullmqLikeQueue {
  /** Count the jobs in the `waiting` state. */
  getWaitingCount(): PromiseLike<number>;
}

/** Options for `bullmqProbe()`. */
export interface BullmqProbeOptions extends ProbeOverrides {
  /** A BullMQ `Queue`. */
  readonly queue: BullmqLikeQueue;
  /** Fail when more jobs than this are waiting. Unlimited by default. */
  readonly maxWaiting?: number;
}

/** Thrown by the probe when the waiting count exceeds `maxWaiting`. */
export class BullmqBacklogError extends Error {
  /** The number of waiting jobs. */
  readonly waiting: number;

  /** Build the error for `waiting` jobs against the `max` threshold. */
  constructor(waiting: number, max: number) {
    super(`${waiting} jobs waiting exceeds ${max}`);
    this.name = "BullmqBacklogError";
    this.waiting = waiting;
  }
}

/** A probe that counts waiting jobs and fails above `maxWaiting`; non-critical by default. Throws `ProbeConfigError` without `getWaitingCount()` or when `maxWaiting` is not a finite number of zero or more. */
export function bullmqProbe(options: BullmqProbeOptions): Probe {
  const queue = options.queue;
  if (typeof queue?.getWaitingCount !== "function") {
    throw new ProbeConfigError(
      "bullmqProbe",
      "queue",
      `must expose getWaitingCount(), got ${describe(queue)}`,
    );
  }
  const maxWaiting = options.maxWaiting;
  if (
    maxWaiting != null &&
    (typeof maxWaiting !== "number" || !Number.isFinite(maxWaiting) ||
      maxWaiting < 0)
  ) {
    throw new ProbeConfigError(
      "bullmqProbe",
      "maxWaiting",
      `must be a non-negative number, got ${String(maxWaiting)}`,
    );
  }
  return {
    name: options.name ?? bullmqDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      const waiting = await queue.getWaitingCount();
      if (typeof waiting !== "number" || !Number.isFinite(waiting)) {
        throw new Error("unexpected waiting count");
      }
      if (maxWaiting != null && waiting > maxWaiting) {
        throw new BullmqBacklogError(waiting, maxWaiting);
      }
      return { waiting };
    },
  };
}

function describe(queue: BullmqLikeQueue): string {
  if (queue == null) return String(queue);
  if (typeof queue !== "object") return typeof queue;
  const keys = Object.keys(queue);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
