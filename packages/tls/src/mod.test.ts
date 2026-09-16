import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type TlsConnect, type TlsLikeSocket, tlsProbe } from "./mod.ts";

interface FakeOptions {
  readonly authorized?: boolean;
  readonly authorizationError?: Error | string | null;
  readonly validTo?: string;
  readonly error?: Error;
  readonly hang?: boolean;
}

function inDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toUTCString();
}

function fakeConnect(
  fake: FakeOptions = {},
  track: { calls: string[]; destroyed: number } = { calls: [], destroyed: 0 },
): TlsConnect {
  return (options) => {
    track.calls.push(
      `${options.host}:${options.port} sni=${options.servername}`,
    );
    const socket: TlsLikeSocket = {
      authorized: fake.authorized ?? true,
      authorizationError: fake.authorizationError ?? null,
      getPeerCertificate: () => ({ valid_to: fake.validTo ?? inDays(60) }),
      destroy() {
        track.destroyed += 1;
      },
      once(event, listener) {
        if (fake.hang) return socket;
        if (event === "error" && fake.error != null) {
          queueMicrotask(() => listener(fake.error));
        }
        if (event === "secureConnect" && fake.error == null) {
          queueMicrotask(() => listener());
        }
        return socket;
      },
    };
    return socket;
  };
}

test("tlsProbe() reports ok on a trusted certificate with enough validity", async () => {
  const track = { calls: [] as string[], destroyed: 0 };
  const report = await runProbes([
    tlsProbe({ host: "api.example.com", connect: fakeConnect({}, track) }),
  ]);
  assert.deepEqual(track.calls, ["api.example.com:443 sni=api.example.com"]);
  assert.equal(track.destroyed, 1);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "tls");
  assert.equal(report.checks[0].critical, false);
});

test("tlsProbe() honours port and minDaysValid", async () => {
  const track = { calls: [] as string[], destroyed: 0 };
  const report = await runProbes([
    tlsProbe({
      host: "db.example.com",
      port: 5432,
      minDaysValid: 1,
      connect: fakeConnect({ validTo: inDays(2) }, track),
    }),
  ]);
  assert.deepEqual(track.calls, ["db.example.com:5432 sni=db.example.com"]);
  assert.equal(report.status, "ok");
});

test("tlsProbe() fails when the certificate expires too soon", async () => {
  const report = await runProbes(
    [tlsProbe({ host: "h", connect: fakeConnect({ validTo: inDays(3) }) })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.equal(
    report.checks[0].error,
    "certificate expires in 2 days, fewer than 14",
  );
});

test("tlsProbe() fails when the certificate has expired", async () => {
  const report = await runProbes(
    [tlsProbe({ host: "h", connect: fakeConnect({ validTo: inDays(-1) }) })],
    { formatError: "message" },
  );
  assert.match(report.checks[0].error ?? "", /^certificate expired /);
});

test("tlsProbe() fails when the certificate is not trusted", async () => {
  const cases: [FakeOptions, string][] = [
    [
      { authorized: false, authorizationError: new Error("SELF_SIGNED_CERT") },
      "SELF_SIGNED_CERT",
    ],
    [
      { authorized: false, authorizationError: "CERT_HAS_EXPIRED" },
      "CERT_HAS_EXPIRED",
    ],
    [{ authorized: false }, "certificate not trusted"],
  ];
  for (const [fake, message] of cases) {
    const report = await runProbes(
      [tlsProbe({ host: "h", connect: fakeConnect(fake) })],
      { formatError: "message" },
    );
    assert.equal(report.checks[0].error, message);
  }
});

test("tlsProbe() fails on an unreadable expiry", async () => {
  const report = await runProbes(
    [tlsProbe({ host: "h", connect: fakeConnect({ validTo: "soon" }) })],
    { formatError: "message" },
  );
  assert.equal(report.checks[0].error, "certificate has no readable expiry");
});

test("tlsProbe() reports the socket error when the handshake fails", async () => {
  const report = await runProbes(
    [
      tlsProbe({
        host: "h",
        connect: fakeConnect({ error: new Error("ECONNRESET") }),
      }),
    ],
    { formatError: "message" },
  );
  assert.equal(report.checks[0].error, "ECONNRESET");
});

test("tlsProbe() makes the report unhealthy when critical", async () => {
  const report = await runProbes([
    tlsProbe({
      host: "h",
      critical: true,
      connect: fakeConnect({ error: new Error("down") }),
    }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("tlsProbe() times out and destroys a hanging socket", async () => {
  const track = { calls: [] as string[], destroyed: 0 };
  const report = await runProbes([
    tlsProbe({
      host: "h",
      connect: fakeConnect({ hang: true }, track),
      timeoutMs: 20,
    }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.destroyed, 1);
});

test("tlsProbe() names the invalid option at construction", () => {
  assert.throws(
    () => tlsProbe({ host: "" }),
    /tlsProbe: "host" must not be empty/,
  );
  assert.throws(
    () => tlsProbe({ host: "h", port: 0 }),
    /tlsProbe: "port" must be an integer between 1 and 65535, got 0/,
  );
  assert.throws(
    () => tlsProbe({ host: "h", minDaysValid: -1 }),
    /tlsProbe: "minDaysValid" must be a non-negative number, got -1/,
  );
});

test("tlsProbe() honours name, critical and skip overrides", async () => {
  const track = { calls: [] as string[], destroyed: 0 };
  const report = await runProbes([
    tlsProbe({
      host: "h",
      connect: fakeConnect({}, track),
      name: "certificate",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "certificate");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(track.calls, []);
});
