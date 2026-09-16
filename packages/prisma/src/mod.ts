/**
 * Prisma probe for `@openstatus/health`: runs `select 1` through
 * `$queryRawUnsafe()` on SQL databases, or the `ping` command through
 * `$runCommandRaw()` on MongoDB.
 *
 * ```ts
 * import { PrismaClient } from "@prisma/client";
 * import { prismaProbe } from "@openstatus/health-prisma";
 *
 * const probe = prismaProbe({ client: new PrismaClient() });
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

/** The subset of a `PrismaClient` the probe uses; one of the two methods must exist. */
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
}

/** A probe that runs `select 1` or `{ ping: 1 }`; critical by default. Throws `ProbeConfigError` without `$queryRawUnsafe()` or `$runCommandRaw()`. */
export function prismaProbe(options: PrismaProbeOptions): Probe {
  const client = options.client;
  let run: () => PromiseLike<ProbeResult>;
  if (typeof client?.$queryRawUnsafe === "function") {
    run = () => client.$queryRawUnsafe!("select 1");
  } else if (typeof client?.$runCommandRaw === "function") {
    run = () => client.$runCommandRaw!({ ping: 1 });
  } else {
    throw new ProbeConfigError(
      "prismaProbe",
      "client",
      `must expose $queryRawUnsafe() or $runCommandRaw(), got ${
        describe(client)
      }`,
    );
  }
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
