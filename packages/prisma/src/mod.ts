/**
 * Prisma probe for `@openstatus/health`: runs `select 1` through
 * `$queryRawUnsafe()` on SQL databases, or the `ping` command through
 * `$runCommandRaw()` when `connector` is `"mongodb"`.
 *
 * ```ts
 * import { PrismaClient } from "@prisma/client";
 * import { prismaProbe } from "@openstatus/health-prisma";
 *
 * const probe = prismaProbe({ client: new PrismaClient() });
 * const mongo = prismaProbe({ client: new PrismaClient(), connector: "mongodb" });
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
export const prismaDefaultName = "database";
/** Connector when `connector` is unset. */
export const prismaDefaultConnector = "sql";

/** Which raw entry point the probe calls. */
export type PrismaConnector = "sql" | "mongodb";

/** The subset of a `PrismaClient` the probe uses; the method for the chosen `connector` must exist. */
export interface PrismaLikeClient {
  /** SQL connectors. */
  $queryRawUnsafe?(query: string): PromiseLike<ProbeResult>;
  /** The MongoDB connector. */
  $runCommandRaw?(command: { readonly ping: 1 }): PromiseLike<ProbeResult>;
}

/** Options for `prismaProbe()`. */
export interface PrismaProbeOptions extends ProbeOverrides {
  /** A generated `PrismaClient`. */
  readonly client: PrismaLikeClient;
  /** `"mongodb"` calls `$runCommandRaw()`; anything else calls `$queryRawUnsafe()`. Default `prismaDefaultConnector`. */
  readonly connector?: PrismaConnector;
}

/** A probe that runs `select 1` or, on MongoDB, `{ ping: 1 }`; critical by default. Throws `ProbeConfigError` when the client lacks the method for `connector`. */
export function prismaProbe(options: PrismaProbeOptions): Probe {
  const client = options.client;
  const connector = options.connector ?? prismaDefaultConnector;
  if (connector !== "sql" && connector !== "mongodb") {
    throw new ProbeConfigError(
      "prismaProbe",
      "connector",
      `must be "sql" or "mongodb", got ${JSON.stringify(connector)}`,
    );
  }
  const method = connector === "mongodb" ? "$runCommandRaw" : "$queryRawUnsafe";
  if (typeof client?.[method] !== "function") {
    throw new ProbeConfigError(
      "prismaProbe",
      "client",
      `must expose ${method}() for the ${connector} connector, got ${
        describe(client)
      }`,
    );
  }
  const run: () => PromiseLike<ProbeResult> = connector === "mongodb"
    ? () => client.$runCommandRaw!({ ping: 1 })
    : () => client.$queryRawUnsafe!("select 1");
  return {
    name: options.name ?? prismaDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await run();
    },
  };
}

function describe(client: PrismaLikeClient): string {
  if (client == null) return String(client);
  if (typeof client !== "object") return typeof client;
  const keys = Object.keys(client);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
