import assert from "node:assert/strict";
import { type AddressInfo, createServer, type Server } from "node:net";
import test from "node:test";
import { runProbes } from "@openstatus/health";
import { type TcpConnect, type TcpLikeSocket, tcpProbe } from "./mod.ts";

function listen(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((socket) => socket.end());
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function hangingConnect(track: { destroyed: number }): TcpConnect {
  return () => {
    const socket: TcpLikeSocket = {
      once() {
        return socket;
      },
      destroy() {
        track.destroyed += 1;
      },
    };
    return socket;
  };
}

test("tcpProbe() reports ok when the port accepts connections", async () => {
  const { server, port } = await listen();
  try {
    const report = await runProbes([tcpProbe({ host: "127.0.0.1", port })]);
    assert.equal(report.status, "ok");
    assert.equal(report.checks[0].name, "tcp");
    assert.equal(report.checks[0].critical, false);
  } finally {
    await close(server);
  }
});

test("tcpProbe() reports degraded when the connection is refused", async () => {
  const { server, port } = await listen();
  await close(server);
  const report = await runProbes(
    [tcpProbe({ host: "127.0.0.1", port })],
    { formatError: "message" },
  );
  assert.equal(report.status, "degraded");
  assert.equal(report.checks[0].status, "failed");
  assert.match(report.checks[0].error ?? "", /ECONNREFUSED/);
});

test("tcpProbe() makes the report unhealthy when critical", async () => {
  const { server, port } = await listen();
  await close(server);
  const report = await runProbes([
    tcpProbe({ host: "127.0.0.1", port, critical: true }),
  ]);
  assert.equal(report.status, "unhealthy");
});

test("tcpProbe() passes host and port to connect()", async () => {
  const calls: string[] = [];
  const connect: TcpConnect = (options) => {
    calls.push(`${options.host}:${options.port}`);
    const socket: TcpLikeSocket = {
      once(event, listener) {
        if (event === "connect") queueMicrotask(() => listener());
        return socket;
      },
      destroy() {},
    };
    return socket;
  };
  const report = await runProbes([
    tcpProbe({ host: "db.internal", port: 5432, connect }),
  ]);
  assert.deepEqual(calls, ["db.internal:5432"]);
  assert.equal(report.status, "ok");
});

test("tcpProbe() times out and destroys a hanging socket", async () => {
  const track = { destroyed: 0 };
  const report = await runProbes([
    tcpProbe({
      host: "10.255.255.1",
      port: 9,
      connect: hangingConnect(track),
      timeoutMs: 20,
    }),
  ]);
  assert.equal(report.checks[0].status, "timeout");
  assert.equal(track.destroyed, 1);
});

test("tcpProbe() names the invalid option at construction", () => {
  assert.throws(
    () => tcpProbe({ host: "", port: 80 }),
    /tcpProbe: "host" must not be empty/,
  );
  assert.throws(
    () => tcpProbe({ host: undefined as unknown as string, port: 80 }),
    /tcpProbe: "host" must be a string, got undefined/,
  );
  for (const port of [0, 65536, 1.5, NaN, "80" as unknown as number]) {
    assert.throws(
      () => tcpProbe({ host: "localhost", port }),
      /tcpProbe: "port" must be an integer between 1 and 65535/,
    );
  }
});

test("tcpProbe() honours name, critical and skip overrides", async () => {
  const track = { destroyed: 0 };
  const report = await runProbes([
    tcpProbe({
      host: "localhost",
      port: 25,
      connect: hangingConnect(track),
      name: "smtp",
      critical: true,
      skip: () => true,
    }),
  ]);
  const check = report.checks[0];
  assert.equal(check.name, "smtp");
  assert.equal(check.critical, true);
  assert.equal(check.status, "skipped");
  assert.equal(track.destroyed, 0);
});
