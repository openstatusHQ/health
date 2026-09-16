/**
 * Redis probe for `@openstatus/health`: sends `PING` through `redis`
 * (node-redis), `ioredis`, `@upstash/redis` or any client with `ping()`.
 *
 * ```ts
 * import { Redis } from "ioredis";
 * import { redisProbe } from "@openstatus/health-redis";
 *
 * const probe = redisProbe({ client: new Redis(env.REDIS_URL) });
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
export const redisDefaultName = "redis";

/** The subset of a Redis client the probe uses. */
export interface RedisLikeClient {
  /** Send `PING`; resolves with the server's reply, normally `"PONG"`. */
  ping(): PromiseLike<ProbeResult>;
}

/** Options for `redisProbe()`. */
export interface RedisProbeOptions extends ProbeOverrides {
  /** A node-redis, ioredis or Upstash client. */
  readonly client: RedisLikeClient;
}

/** A probe that sends `PING` and expects `PONG`; non-critical by default. Throws `ProbeConfigError` without `ping()`. */
export function redisProbe(options: RedisProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.ping !== "function") {
    throw new ProbeConfigError(
      "redisProbe",
      "client",
      `must expose ping(), got ${describe(client)}`,
    );
  }
  return {
    name: options.name ?? redisDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      const reply = await client.ping();
      if (typeof reply === "string" && reply.toUpperCase() !== "PONG") {
        throw new Error(`unexpected reply ${JSON.stringify(reply)}`);
      }
    },
  };
}

function describe(client: RedisLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
