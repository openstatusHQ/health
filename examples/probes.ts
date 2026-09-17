import { createClient as createLibsqlClient } from "@libsql/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createClickHouseClient } from "@clickhouse/client";
import { connect as connectTursoServerless } from "@tursodatabase/serverless";
import { drizzle } from "drizzle-orm/libsql/http";
import { createPool as createMysqlPool } from "mysql2/promise";
import type { Probe } from "@openstatus/health";
import { clickhouseProbe } from "@openstatus/health-clickhouse";
import { drizzleProbe } from "@openstatus/health-drizzle";
import { mysqlProbe } from "@openstatus/health-mysql";
import { supabaseProbe } from "@openstatus/health-supabase";
import { tinybirdProbe } from "@openstatus/health-tinybird";
import { tursoProbe } from "@openstatus/health-turso";
import { tursoServerlessProbe } from "@openstatus/health-turso-serverless";
import { unkeyProbe } from "@openstatus/health-unkey";
import { upstashProbe } from "@openstatus/health-upstash";

const env = (name: string): string | undefined => Deno.env.get(name);

export function exampleProbes(): Probe[] {
  const libsql = createLibsqlClient({
    url: env("TURSO_URL") ?? "file::memory:",
    authToken: env("TURSO_TOKEN"),
  });
  const db = drizzle(libsql);
  const supabase = createSupabaseClient(
    env("SUPABASE_URL") ?? "http://localhost:54321",
    env("SUPABASE_SERVICE_ROLE_KEY") ?? "service-role-key",
  );

  const clickhouse = createClickHouseClient({
    url: env("CLICKHOUSE_URL") ?? "http://localhost:8123",
    username: env("CLICKHOUSE_USER"),
    password: env("CLICKHOUSE_PASSWORD"),
  });

  const mysql = createMysqlPool(
    env("MYSQL_URL") ?? "mysql://root@localhost:3306/app",
  );

  const tursoServerless = connectTursoServerless({
    url: env("TURSO_DATABASE_URL") ?? "http://localhost:8080",
    authToken: env("TURSO_AUTH_TOKEN"),
  });

  return [
    tursoProbe({
      client: libsql,
      name: "turso",
      skip: () => env("TURSO_NOOP") === "true",
    }),
    tursoServerlessProbe({
      connection: tursoServerless,
      name: "turso-serverless",
      skip: () => env("TURSO_SERVERLESS_NOOP") === "true",
    }),
    drizzleProbe({
      db,
      name: "drizzle",
      skip: () => env("DRIZZLE_NOOP") === "true",
    }),
    clickhouseProbe({
      client: clickhouse,
      skip: () => env("CLICKHOUSE_NOOP") === "true",
    }),
    mysqlProbe({
      client: mysql,
      name: "mysql",
      skip: () => env("MYSQL_URL") == null,
    }),
    tinybirdProbe({
      baseUrl: env("TINYBIRD_URL"),
      skip: () => env("TINYBIRD_NOOP") === "true",
    }),
    unkeyProbe({
      baseUrl: env("UNKEY_URL"),
      skip: () => env("UNKEY_NOOP") === "true",
    }),
    supabaseProbe({
      client: supabase,
      skip: () => env("SUPABASE_NOOP") === "true",
    }),
    upstashProbe({
      url: env("UPSTASH_REDIS_REST_URL") ?? "http://localhost:8079",
      token: env("UPSTASH_REDIS_REST_TOKEN") ?? "unconfigured",
      skip: () => env("UPSTASH_REDIS_REST_URL") == null,
    }),
  ];
}
