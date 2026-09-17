import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type PrismaLikeClient, prismaProbe } from "./mod.ts";

function sqlClient(
  calls: string[],
  result: () => Promise<void> = () => Promise.resolve(),
): PrismaLikeClient {
  return {
    $queryRawUnsafe: (query) => {
      calls.push(`sql ${query}`);
      return result();
    },
  };
}

function mongoClient(calls: string[]): PrismaLikeClient {
  return {
    $runCommandRaw: (command) => {
      calls.push(`command ${JSON.stringify(command)}`);
      return Promise.resolve({ ok: 1 });
    },
  };
}

test("prismaProbe() runs select 1 through $queryRawUnsafe()", async () => {
  const calls: string[] = [];
  const report = await runProbes([prismaProbe({ client: sqlClient(calls) })]);
  assert.deepEqual(calls, ["sql select 1"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("prismaProbe() runs $runCommandRaw() when connector is mongodb", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    prismaProbe({ client: mongoClient(calls), connector: "mongodb" }),
  ]);
  assert.deepEqual(calls, ['command {"ping":1}']);
  assert.equal(report.status, "ok");
});

test("prismaProbe() picks the method from connector, not from what the client exposes", async () => {
  const calls: string[] = [];
  const client: PrismaLikeClient = {
    ...sqlClient(calls),
    ...mongoClient(calls),
  };
  await runProbes([prismaProbe({ client })]);
  await runProbes([prismaProbe({ client, connector: "mongodb" })]);
  assert.deepEqual(calls, ["sql select 1", 'command {"ping":1}']);
});

test("prismaProbe() reports unhealthy when the query rejects", async () => {
  const client = sqlClient(
    [],
    () => Promise.reject(new Error("Can't reach database server")),
  );
  const report = await runProbes([prismaProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "Can't reach database server");
});

test("prismaProbe() times out on a hanging query", async () => {
  const client: PrismaLikeClient = {
    $queryRawUnsafe: () => new Promise(() => {}),
  };
  const report = await runProbes([prismaProbe({ client, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("prismaProbe() throws at construction without the connector's method", () => {
  assert.throws(
    () => prismaProbe({ client: {} }),
    /prismaProbe: "client" must expose \$queryRawUnsafe\(\) for the sql connector, got an object with no keys/,
  );
  assert.throws(
    () => prismaProbe({ client: sqlClient([]), connector: "mongodb" }),
    /must expose \$runCommandRaw\(\) for the mongodb connector, got an object with keys \$queryRawUnsafe/,
  );
  assert.throws(
    () =>
      prismaProbe({
        client: sqlClient([]),
        connector: "postgres" as unknown as "sql",
      }),
    /prismaProbe: "connector" must be "sql" or "mongodb", got "postgres"/,
  );
  assert.throws(
    () =>
      prismaProbe({
        client: { $connect: 1 } as unknown as PrismaLikeClient,
      }),
    /got an object with keys \$connect/,
  );
  assert.throws(
    () => prismaProbe({ client: undefined as unknown as PrismaLikeClient }),
    /got undefined/,
  );
});

test("prismaProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    prismaProbe({
      client: sqlClient(calls),
      name: "prisma",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "prisma");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
