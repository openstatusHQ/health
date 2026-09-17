/**
 * Kafka probe for `@openstatus/health`: describes the cluster through a
 * connected KafkaJS-style `Admin` client and fails when no broker answers.
 *
 * ```ts
 * import { Kafka } from "kafkajs";
 * import { kafkaProbe } from "@openstatus/health-kafka";
 *
 * const admin = new Kafka({ brokers }).admin();
 * await admin.connect();
 * const probe = kafkaProbe({ admin });
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
export const kafkaDefaultName = "kafka";

/** What `describeCluster()` resolves to. */
export interface KafkaClusterDescription {
  /** The brokers currently in the cluster. */
  readonly brokers: readonly { readonly nodeId: number }[];
}

/** The subset of a KafkaJS `Admin` client the probe uses. */
export interface KafkaLikeAdmin {
  /** Fetch cluster metadata from the connected broker. */
  describeCluster(): PromiseLike<KafkaClusterDescription>;
}

/** Options for `kafkaProbe()`. */
export interface KafkaProbeOptions extends ProbeOverrides {
  /** A connected `kafkajs` `Admin` client. */
  readonly admin: KafkaLikeAdmin;
}

/** A probe that describes the cluster and expects at least one broker; non-critical by default. Throws `ProbeConfigError` without `describeCluster()`. */
export function kafkaProbe(options: KafkaProbeOptions): Probe {
  const admin = options.admin;
  if (typeof admin?.describeCluster !== "function") {
    throw new ProbeConfigError(
      "kafkaProbe",
      "admin",
      `must expose describeCluster(), got ${describe(admin)}`,
    );
  }
  return {
    name: options.name ?? kafkaDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      const cluster = await admin.describeCluster();
      const brokers = cluster?.brokers;
      if (!Array.isArray(brokers)) throw new Error("unexpected response shape");
      if (brokers.length === 0) throw new Error("no brokers in cluster");
      return { brokers: brokers.length };
    },
  };
}

function describe(admin: KafkaLikeAdmin): string {
  if (admin == null) return String(admin);
  if (typeof admin !== "object") return typeof admin;
  const keys = Object.keys(admin);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
