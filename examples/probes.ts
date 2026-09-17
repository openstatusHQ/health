import { S3Client } from "@aws-sdk/client-s3";
import { createClient as createLibsqlClient } from "@libsql/client";
import { neon } from "@neondatabase/serverless";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createClickHouseClient } from "@clickhouse/client";
import { connect as connectPlanetScale } from "@planetscale/database";
import { connect as connectTursoServerless } from "@tursodatabase/serverless";
import { drizzle } from "drizzle-orm/libsql/http";
import { createPool as createMysqlPool } from "mysql2/promise";
import { Pool } from "pg";
import postgres from "postgres";
import { Redis as IORedis } from "ioredis";
import { createClient as createRedisClient } from "redis";
import { MongoClient } from "mongodb";
import type { Probe } from "@openstatus/health";
import { clerkProbe } from "@openstatus/health-clerk";
import { clickhouseProbe } from "@openstatus/health-clickhouse";
import { drizzleProbe } from "@openstatus/health-drizzle";
import { mysqlProbe } from "@openstatus/health-mysql";
import { postgresProbe } from "@openstatus/health-postgres";
import { neonProbe } from "@openstatus/health-neon";
import { planetscaleProbe } from "@openstatus/health-planetscale";
import { redisProbe } from "@openstatus/health-redis";
import { mongodbProbe } from "@openstatus/health-mongodb";
import { s3Probe } from "@openstatus/health-s3";
import { qstashProbe } from "@openstatus/health-qstash";
import { inngestProbe } from "@openstatus/health-inngest";
import { stripeProbe } from "@openstatus/health-stripe";
import { resendProbe } from "@openstatus/health-resend";
import { sentryProbe } from "@openstatus/health-sentry";
import { supabaseProbe } from "@openstatus/health-supabase";
import { tinybirdProbe } from "@openstatus/health-tinybird";
import { triggerDevProbe } from "@openstatus/health-trigger-dev";
import { tursoProbe } from "@openstatus/health-turso";
import { tursoServerlessProbe } from "@openstatus/health-turso-serverless";
import { unkeyProbe } from "@openstatus/health-unkey";
import { upstashProbe } from "@openstatus/health-upstash";
import { workosProbe } from "@openstatus/health-workos";

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

  const pg = new Pool({
    connectionString: env("DATABASE_URL") ?? "postgres://localhost:5432/app",
  });
  const sql = postgres(env("DATABASE_URL") ?? "postgres://localhost:5432/app");

  const neonSql = neon(
    env("NEON_DATABASE_URL") || "postgres://user:pass@localhost:5432/app",
  );

  const planetscale = connectPlanetScale({
    url: env("PLANETSCALE_URL") ||
      "mysql://user:pass@aws.connect.psdb.cloud/app",
  });

  const ioredis = new IORedis(env("REDIS_URL") || "redis://localhost:6379", {
    lazyConnect: true,
  });
  // node-redis only connects on connect(); open it on the first probe so
  // this factory stays synchronous. Reconnects are off so a down server
  // rejects connect() instead of retrying forever, and the error listener
  // keeps the client's `error` events from crashing the process.
  const nodeRedis = createRedisClient({
    url: env("REDIS_URL") || "redis://localhost:6379",
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  });
  nodeRedis.on("error", () => {});
  const nodeRedisOnDemand = {
    ping: async (): Promise<string> => {
      if (!nodeRedis.isOpen) await nodeRedis.connect();
      return await nodeRedis.ping();
    },
  };

  const mongo = new MongoClient(
    env("MONGODB_URI") ?? "mongodb://localhost:27017",
  );

  const s3Endpoint = env("S3_ENDPOINT");
  const s3 = new S3Client({
    region: env("AWS_REGION") ?? "us-east-1",
    endpoint: s3Endpoint,
    forcePathStyle: s3Endpoint != null,
  });

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
    postgresProbe({
      client: pg,
      name: "postgres",
      skip: () => env("DATABASE_URL") == null,
    }),
    postgresProbe({
      client: sql,
      name: "postgres-js",
      skip: () => env("DATABASE_URL") == null,
    }),
    neonProbe({
      client: neonSql,
      name: "neon",
      skip: () => !env("NEON_DATABASE_URL"),
    }),
    planetscaleProbe({
      connection: planetscale,
      name: "planetscale",
      skip: () => !env("PLANETSCALE_URL"),
    }),
    redisProbe({
      client: ioredis,
      name: "ioredis",
      skip: () => !env("REDIS_URL"),
    }),
    redisProbe({
      client: nodeRedisOnDemand,
      name: "node-redis",
      skip: () => !env("REDIS_URL"),
    }),
    mongodbProbe({
      client: mongo,
      name: "mongodb",
      skip: () => env("MONGODB_URI") == null,
    }),
    s3Probe({
      client: s3,
      bucket: env("S3_BUCKET") || "unconfigured",
      skip: () => !env("S3_BUCKET"),
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
    qstashProbe({
      token: env("QSTASH_TOKEN") || "unconfigured",
      baseUrl: env("QSTASH_URL"),
      skip: () => !env("QSTASH_TOKEN"),
    }),
    inngestProbe({
      signingKey: env("INNGEST_SIGNING_KEY") || "unconfigured",
      baseUrl: env("INNGEST_API_URL"),
      skip: () => !env("INNGEST_SIGNING_KEY"),
    }),
    triggerDevProbe({
      secretKey: env("TRIGGER_SECRET_KEY") || "unconfigured",
      baseUrl: env("TRIGGER_API_URL"),
      skip: () => !env("TRIGGER_SECRET_KEY"),
    }),
    stripeProbe({
      secretKey: env("STRIPE_SECRET_KEY") || "unconfigured",
      skip: () => !env("STRIPE_SECRET_KEY"),
    }),
    resendProbe({
      apiKey: env("RESEND_API_KEY") || "unconfigured",
      skip: () => !env("RESEND_API_KEY"),
    }),
    clerkProbe({
      secretKey: env("CLERK_SECRET_KEY") || "unconfigured",
      skip: () => !env("CLERK_SECRET_KEY"),
    }),
    workosProbe({
      apiKey: env("WORKOS_API_KEY") || "unconfigured",
      skip: () => !env("WORKOS_API_KEY"),
    }),
    sentryProbe({
      token: env("SENTRY_AUTH_TOKEN") || undefined,
      skip: () => env("SENTRY_NOOP") === "true",
    }),
    upstashProbe({
      url: env("UPSTASH_REDIS_REST_URL") ?? "http://localhost:8079",
      token: env("UPSTASH_REDIS_REST_TOKEN") ?? "unconfigured",
      skip: () => env("UPSTASH_REDIS_REST_URL") == null,
    }),
  ];
}
