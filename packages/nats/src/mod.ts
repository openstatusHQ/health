/**
 * NATS probe for `@openstatus/health`: flushes a `NatsConnection`, which
 * round-trips a `PING` / `PONG` with the server.
 *
 * ```ts
 * import { connect } from "@nats-io/transport-node";
 * import { natsProbe } from "@openstatus/health-nats";
 *
 * const nc = await connect({ servers: env.NATS_URL });
 * const probe = natsProbe({ connection: nc });
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
export const natsDefaultName = "nats";

/** The subset of a `NatsConnection` the probe uses. */
export interface NatsLikeConnection {
  /** Resolve once the server has acknowledged everything sent so far. */
  flush(): PromiseLike<void>;
  /** Whether the connection has been closed. */
  isClosed?(): boolean;
}

/** Options for `natsProbe()`. */
export interface NatsProbeOptions extends ProbeOverrides {
  /** An open `NatsConnection`. */
  readonly connection: NatsLikeConnection;
}

/** A probe that flushes the connection; non-critical by default. Throws `ProbeConfigError` without `flush()`. */
export function natsProbe(options: NatsProbeOptions): Probe {
  const connection = options.connection;
  if (typeof connection?.flush !== "function") {
    throw new ProbeConfigError(
      "natsProbe",
      "connection",
      `must expose flush(), got ${describe(connection)}`,
    );
  }
  return {
    name: options.name ?? natsDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      if (typeof connection.isClosed === "function" && connection.isClosed()) {
        throw new Error("connection closed");
      }
      await connection.flush();
    },
  };
}

function describe(connection: NatsLikeConnection): string {
  if (connection == null) return String(connection);
  if (typeof connection !== "object") return typeof connection;
  const keys = Object.keys(connection);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
