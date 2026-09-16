import assert from "node:assert/strict";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import {
  type GrpcHealthCheckResponse,
  type GrpcLikeHealthClient,
  grpcProbe,
} from "./mod.ts";

type Callback = (
  error: Error | null,
  response?: GrpcHealthCheckResponse,
) => void;
type Answer = (callback: Callback) => void;

function fakeClient(
  answer: Answer = (cb) => cb(null, { status: 1 }),
  track: { services: string[]; cancelled: number } = {
    services: [],
    cancelled: 0,
  },
): GrpcLikeHealthClient {
  return {
    check: (request, callback) => {
      track.services.push(request.service);
      queueMicrotask(() => answer(callback));
      return {
        cancel: () => {
          track.cancelled += 1;
        },
      };
    },
  };
}

test("grpcProbe() checks the whole server by default and passes on SERVING", async () => {
  const track = { services: [] as string[], cancelled: 0 };
  const report = await runProbes([
    grpcProbe({ client: fakeClient(undefined, track) }),
  ]);
  assert.deepEqual(track.services, [""]);
  assert.equal(report.status, "ok");
  assert.equal(report.checks[0].name, "grpc");
  assert.equal(report.checks[0].critical, false);
});

test("grpcProbe() honours the service option and string enums", async () => {
  const track = { services: [] as string[], cancelled: 0 };
  const answer: Answer = (cb) => cb(null, { status: "SERVING" });
  const report = await runProbes([
    grpcProbe({ client: fakeClient(answer, track), service: "orders.Orders" }),
  ]);
  assert.deepEqual(track.services, ["orders.Orders"]);
  assert.equal(report.status, "ok");
});

test("grpcProbe() fails on a non-serving status", async () => {
  const cases: [GrpcHealthCheckResponse | undefined, string][] = [
    [{ status: 2 }, "serving status NOT_SERVING"],
    [{ status: "NOT_SERVING" }, "serving status NOT_SERVING"],
    [{ status: 3 }, "serving status SERVICE_UNKNOWN"],
    [{ status: 0 }, "serving status UNKNOWN"],
    [{}, "serving status undefined"],
    [undefined, "serving status undefined"],
  ];
  for (const [response, message] of cases) {
    const answer: Answer = (cb) => cb(null, response);
    const report = await runProbes(
      [grpcProbe({ client: fakeClient(answer) })],
      {
        formatError: "message",
      },
    );
    assert.equal(report.checks[0].status, "failed");
    assert.equal(report.checks[0].error, message);
  }
});

test("grpcProbe() reports the call error", async () => {
  const answer: Answer = (cb) => cb(new Error("14 UNAVAILABLE: No connection"));
  const report = await runProbes([grpcProbe({ client: fakeClient(answer) })], {
    formatError: "message",
  });
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].error, "14 UNAVAILABLE: No connection");
});

test("grpcProbe() makes the report unhealthy when critical", async () => {
  const answer: Answer = (cb) => cb(new Error("down"));
  const report = await runProbes([
    grpcProbe({ client: fakeClient(answer), critical: true }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("grpcProbe() times out and cancels a hanging call", async () => {
  const track = { services: [] as string[], cancelled: 0 };
  const report = await runProbes([
    grpcProbe({ client: fakeClient(() => {}, track), timeoutMs: 20 }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.cancelled, 1);
});

test("grpcProbe() throws at construction on an invalid client or service", () => {
  assert.throws(
    () => grpcProbe({ client: {} as GrpcLikeHealthClient }),
    /grpcProbe: "client" must expose check\(\), got an object with no keys/,
  );
  assert.throws(
    () => grpcProbe({ client: undefined as unknown as GrpcLikeHealthClient }),
    /got undefined/,
  );
  assert.throws(
    () => grpcProbe({ client: fakeClient(), service: 1 as unknown as string }),
    /grpcProbe: "service" must be a string, got 1/,
  );
});

test("grpcProbe() honours name, critical and skip overrides", async () => {
  const track = { services: [] as string[], cancelled: 0 };
  const report = await runProbes([
    grpcProbe({
      client: fakeClient(undefined, track),
      name: "orders",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "orders");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.deepEqual(track.services, []);
});
