import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { mongodbProbe, type MongoLikeClient } from "./mod.ts";

interface Call {
  readonly db: string | undefined;
  readonly command: { readonly ping: 1 };
}

function fakeClient(
  calls: Call[],
  result: () => Promise<void> = () => Promise.resolve(),
): MongoLikeClient {
  return {
    db: (name) => ({
      command: (command) => {
        calls.push({ db: name, command });
        return result();
      },
    }),
  };
}

test("mongodbProbe() runs ping on the admin database", async () => {
  const calls: Call[] = [];
  const report = await runProbes([mongodbProbe({ client: fakeClient(calls) })]);
  assert.deepEqual(calls, [{ db: "admin", command: { ping: 1 } }]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "database");
  assert.equal(report.checks[0].critical, true);
});

test("mongodbProbe() honours the db option", async () => {
  const calls: Call[] = [];
  await runProbes([mongodbProbe({ client: fakeClient(calls), db: "app" })]);
  assert.equal(calls[0].db, "app");
});

test("mongodbProbe() reports unhealthy when the command rejects", async () => {
  const client = fakeClient(
    [],
    () => Promise.reject(new Error("MongoServerSelectionError")),
  );
  const report = await runProbes([mongodbProbe({ client })], {
    formatError: "message",
  });
  assert.equal(report.status, "unhealthy");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(report.checks[0].error, "MongoServerSelectionError");
});

test("mongodbProbe() times out on a hanging command", async () => {
  const client: MongoLikeClient = {
    db: () => ({ command: () => new Promise(() => {}) }),
  };
  const report = await runProbes([mongodbProbe({ client, timeoutMs: 20 })]);
  assert.equal(report.checks[0].status, "timeout");
});

test("mongodbProbe() throws at construction without db()", () => {
  assert.throws(
    () => mongodbProbe({ client: {} as MongoLikeClient }),
    /mongodbProbe: "client" must expose db\(\), got an object with no keys/,
  );
  assert.throws(
    () =>
      mongodbProbe({ client: { connect: 1 } as unknown as MongoLikeClient }),
    /got an object with keys connect/,
  );
  assert.throws(
    () => mongodbProbe({ client: undefined as unknown as MongoLikeClient }),
    /got undefined/,
  );
});

test("mongodbProbe() honours name, critical and skip overrides", async () => {
  const calls: Call[] = [];
  const report = await runProbes([
    mongodbProbe({
      client: fakeClient(calls),
      name: "mongo",
      critical: false,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "mongo");
  assert.equal(check.critical, false);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
