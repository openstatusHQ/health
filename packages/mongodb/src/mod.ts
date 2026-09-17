/**
 * MongoDB probe for `@openstatus/health`: runs the `ping` command through the
 * official `mongodb` driver.
 *
 * ```ts
 * import { MongoClient } from "mongodb";
 * import { mongodbProbe } from "@openstatus/health-mongodb";
 *
 * const probe = mongodbProbe({ client: new MongoClient(env.MONGODB_URI) });
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
export const mongodbDefaultName = "database";
/** Database the `ping` command runs against when `db` is unset. */
export const mongodbDefaultDb = "admin";

/** What the probe passes to `command()`. */
export interface MongoCommandOptions {
  /** Aborts when the probe times out. */
  readonly signal?: AbortSignal;
}

/** The subset of a `mongodb` `Db` the probe uses. */
export interface MongoLikeDb {
  /** Run a database command. */
  command(
    command: { readonly ping: 1 },
    options?: MongoCommandOptions,
  ): PromiseLike<ProbeResult>;
}

/** The subset of a `MongoClient` the probe uses. */
export interface MongoLikeClient {
  /** Select a database. */
  db(name?: string): MongoLikeDb;
}

/** Options for `mongodbProbe()`. */
export interface MongodbProbeOptions extends ProbeOverrides {
  /** A `MongoClient`. */
  readonly client: MongoLikeClient;
  /** Database to run `ping` on. Default `mongodbDefaultDb`. */
  readonly db?: string;
}

/** A probe that runs `{ ping: 1 }`; critical by default. Throws `ProbeConfigError` without `db()`. */
export function mongodbProbe(options: MongodbProbeOptions): Probe {
  const client = options.client;
  if (typeof client?.db !== "function") {
    throw new ProbeConfigError(
      "mongodbProbe",
      "client",
      `must expose db(), got ${describe(client)}`,
    );
  }
  const dbName = options.db ?? mongodbDefaultDb;
  return {
    name: options.name ?? mongodbDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async (signal) => {
      await client.db(dbName).command({ ping: 1 }, { signal });
    },
  };
}

function describe(client: MongoLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
