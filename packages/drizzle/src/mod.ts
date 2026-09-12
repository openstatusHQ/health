import { type SQL, sql } from "drizzle-orm";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  type ProbeResult,
} from "@openstatus/health";

export const drizzleDefaultName = "database";

export interface DrizzleLikeDb {
  execute?(query: SQL): PromiseLike<ProbeResult>;
  run?(query: SQL): PromiseLike<ProbeResult>;
}

export interface DrizzleProbeOptions extends ProbeOverrides {
  readonly db: DrizzleLikeDb;
}

export function drizzleProbe(options: DrizzleProbeOptions): Probe {
  const db = options.db;
  const query = sql`select 1`;
  let run: () => PromiseLike<ProbeResult>;
  if (typeof db.execute === "function") {
    run = () => db.execute!(query);
  } else if (typeof db.run === "function") {
    run = () => db.run!(query);
  } else {
    throw new ProbeConfigError(
      "drizzleProbe",
      "db",
      `must expose execute() or run(), got ${describe(db)}`,
    );
  }
  return {
    name: options.name ?? drizzleDefaultName,
    critical: options.critical ?? true,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      await run();
    },
  };
}

function describe(db: DrizzleLikeDb): string {
  if (db == null) return String(db);
  if (typeof db !== "object") return typeof db;
  const keys = Object.keys(db);
  return keys.length === 0
    ? "an object with no keys"
    : `an object with keys ${keys.slice(0, 8).join(", ")}`;
}
