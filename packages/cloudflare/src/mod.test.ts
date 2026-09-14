import assert from "node:assert/strict";
import test from "node:test";
import { createHealthHandler } from "@openstatus/health";
import {
  cloudflareExtend,
  type CloudflareRequestLike,
  cloudflareServer,
} from "./mod.ts";

const version = { id: "45f6ad3c-8f1e", tag: "v3" };

function requestWithCf(
  cf: Record<string, string | number> = { colo: "DFW" },
): CloudflareRequestLike {
  const request = new Request("https://example.com/health");
  Object.defineProperty(request, "cf", { value: cf });
  return request as CloudflareRequestLike;
}

function plainRequest(): CloudflareRequestLike {
  return new Request("https://example.com/health") as CloudflareRequestLike;
}

test("cloudflareServer() reads the colo as the region", () => {
  assert.deepEqual(cloudflareServer(requestWithCf()), {
    platform: "cloudflare",
    region: "DFW",
  });
});

test("cloudflareServer() keeps the colo exactly as Cloudflare spells it", () => {
  assert.equal(cloudflareServer(requestWithCf({ colo: "cdg" }))?.region, "cdg");
  assert.equal(cloudflareServer(requestWithCf({ colo: "CDG" }))?.region, "CDG");
});

test("cloudflareServer() adds the version metadata when supplied", () => {
  assert.deepEqual(cloudflareServer(requestWithCf(), { version }), {
    platform: "cloudflare",
    region: "DFW",
    version: "45f6ad3c-8f1e",
    versionTag: "v3",
  });
});

test("cloudflareServer() omits version fields when the binding is absent", () => {
  const server = cloudflareServer(requestWithCf()) ?? {};
  assert.equal("version" in server, false);
  assert.equal("versionTag" in server, false);
});

test("cloudflareServer() omits the requested fields", () => {
  const server = cloudflareServer(requestWithCf(), {
    version,
    omit: ["version"],
  });
  assert.equal("version" in (server ?? {}), false);
  assert.equal(server?.versionTag, "v3");
});

test("cloudflareExtend() keeps the omitted fields out of the report", () => {
  const extend = cloudflareExtend<CloudflareRequestLike>({
    version,
    omit: ["version"],
  });
  assert.deepEqual(extend(report(), requestWithCf()), {
    server: cloudflareServer(requestWithCf(), { version, omit: ["version"] }),
  });
});

test("cloudflareServer() never renders client geolocation", () => {
  const server = cloudflareServer(
    requestWithCf({
      colo: "DFW",
      country: "US",
      city: "Austin",
      region: "Texas",
      regionCode: "TX",
      continent: "NA",
      latitude: "30.27130",
      longitude: "-97.74260",
      postalCode: "78701",
      timezone: "America/Chicago",
      asOrganization: "Example ISP",
    }),
  );
  assert.deepEqual(server, { platform: "cloudflare", region: "DFW" });
  for (
    const key of [
      "country",
      "city",
      "regionCode",
      "continent",
      "latitude",
      "longitude",
      "postalCode",
      "timezone",
      "asOrganization",
    ]
  ) {
    assert.equal(key in (server ?? {}), false, `${key} must never be rendered`);
  }
  assert.equal(server?.region, "DFW");
});

test("cloudflareServer() returns undefined without a cf object", () => {
  assert.equal(cloudflareServer(plainRequest()), undefined);
});

test("cloudflareExtend() treats the context as the request by default", () => {
  const extend = cloudflareExtend<CloudflareRequestLike>();
  assert.deepEqual(extend(report(), requestWithCf()), {
    server: { platform: "cloudflare", region: "DFW" },
  });
});

test("cloudflareExtend() reaches the request through a hono-style accessor", () => {
  const extend = cloudflareExtend<{ req: { raw: CloudflareRequestLike } }>({
    request: (c) => c.req.raw,
  });
  assert.deepEqual(extend(report(), { req: { raw: requestWithCf() } }), {
    server: { platform: "cloudflare", region: "DFW" },
  });
});

test("cloudflareExtend() reaches the request through an elysia-style accessor", () => {
  const extend = cloudflareExtend<{ request: CloudflareRequestLike }>({
    request: (c) => c.request,
  });
  assert.deepEqual(extend(report(), { request: requestWithCf() }), {
    server: { platform: "cloudflare", region: "DFW" },
  });
});

test("cloudflareExtend() renders nothing off Workers", () => {
  const extend = cloudflareExtend<CloudflareRequestLike>();
  assert.deepEqual(extend(report(), plainRequest()), {});
});

test("cloudflareExtend() re-reads the colo on every request", () => {
  const extend = cloudflareExtend<CloudflareRequestLike>();
  const first = extend(report(), requestWithCf({ colo: "DFW" }));
  const second = extend(report(), requestWithCf({ colo: "CDG" }));
  assert.deepEqual(first, {
    server: { platform: "cloudflare", region: "DFW" },
  });
  assert.deepEqual(second, {
    server: { platform: "cloudflare", region: "CDG" },
  });
});

test("the report carries server alongside status and checks", async () => {
  const handler = createHealthHandler<Request>({
    probes: [{ name: "noop", run: () => true }],
    extend: cloudflareExtend<Request>({ version }),
  });
  const response = await handler(requestWithCf());
  const body: {
    status: string;
    checks: readonly { name: string }[];
    server?: { region?: string; versionTag?: string };
  } = await response.json();
  assert.equal(body.status, "ok");
  assert.equal(body.checks[0].name, "noop");
  assert.equal(body.server?.region, "DFW");
  assert.equal(body.server?.versionTag, "v3");
});

function report() {
  return {
    status: "ok",
    checkedAt: "2026-09-11T12:00:00.000Z",
    latencyMs: 1,
    checks: [],
  } as const;
}
