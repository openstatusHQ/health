import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type DnsLookup, dnsProbe } from "./mod.ts";

function fakeLookup(
  calls: string[],
  result: () => Promise<{ address: string } | { address: string }[]> = () =>
    Promise.resolve({ address: "93.184.216.34" }),
): DnsLookup {
  return (hostname) => {
    calls.push(hostname);
    return result();
  };
}

test("dnsProbe() resolves the hostname with lookup()", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    dnsProbe({ hostname: "api.example.com", lookup: fakeLookup(calls) }),
  ]);
  assert.deepEqual(calls, ["api.example.com"]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "dns");
  assert.equal(report.checks[0].critical, false);
});

test("dnsProbe() accepts an array of addresses", async () => {
  const lookup = fakeLookup(
    [],
    () => Promise.resolve([{ address: "::1" }, { address: "127.0.0.1" }]),
  );
  const report = await runProbes([dnsProbe({ hostname: "localhost", lookup })]);
  assert.equal(report.status, "ok");
});

test("dnsProbe() fails when no address comes back", async () => {
  for (
    const result of [
      () => Promise.resolve([]),
      () => Promise.resolve({ address: "" }),
    ]
  ) {
    const report = await runProbes(
      [dnsProbe({
        hostname: "empty.example.com",
        lookup: fakeLookup([], result),
      })],
      { formatError: "message" },
    );
    assert.equal(report.checks[0].status, "failed");
    assert.equal(report.checks[0].error, "no address for empty.example.com");
  }
});

test("dnsProbe() reports degraded when lookup() rejects", async () => {
  const lookup = fakeLookup(
    [],
    () => Promise.reject(new Error("getaddrinfo ENOTFOUND nope.invalid")),
  );
  const report = await runProbes([
    dnsProbe({ hostname: "nope.invalid", lookup }),
  ], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].error, "getaddrinfo ENOTFOUND nope.invalid");
});

test("dnsProbe() makes the report unhealthy when critical", async () => {
  const lookup = fakeLookup([], () => Promise.reject(new Error("ENOTFOUND")));
  const report = await runProbes([
    dnsProbe({ hostname: "nope.invalid", lookup, critical: true }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("dnsProbe() times out on a hanging lookup", async () => {
  const report = await runProbes([
    dnsProbe({
      hostname: "slow.example.com",
      lookup: () => new Promise(() => {}),
      timeoutMs: 20,
    }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
});

test("dnsProbe() resolves localhost with the real resolver", async () => {
  const report = await runProbes([dnsProbe({ hostname: "localhost" })]);
  assert.equal(report.status, "ok");
});

test("dnsProbe() names the invalid option at construction", () => {
  assert.throws(
    () => dnsProbe({ hostname: "" }),
    /dnsProbe: "hostname" must not be empty/,
  );
  assert.throws(
    () => dnsProbe({ hostname: undefined as unknown as string }),
    /dnsProbe: "hostname" must be a string, got undefined/,
  );
});

test("dnsProbe() honours name, critical and skip overrides", async () => {
  const calls: string[] = [];
  const report = await runProbes([
    dnsProbe({
      hostname: "api.example.com",
      lookup: fakeLookup(calls),
      name: "upstream-dns",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "upstream-dns");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(calls, []);
});
