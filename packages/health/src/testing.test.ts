import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { runProbes } from "./run.ts";
import {
  failingProbe,
  fakeFetch,
  hangFetch,
  hangingProbe,
  okProbe,
} from "./testing.ts";

test("probe fixtures produce the expected check statuses", async () => {
  const report = await runProbes([
    okProbe("a"),
    failingProbe("b"),
    hangingProbe("c", true, 10),
  ]);
  assert.deepEqual(
    report.checks.map((c) => [c.name, c.status, c.critical]),
    [
      ["a", "ok", false],
      ["b", "failed", false],
      ["c", "timeout", true],
    ],
  );
  assert.equal(report.status, "unhealthy");
});

test("fakeFetch() records the call and answers with the given status", async () => {
  const calls: string[] = [];
  const doFetch = fakeFetch({
    status: 204,
    onFetch: (call) => calls.push(`${call.method} ${call.url}`),
  });
  const res = await doFetch("https://example.com/x", { method: "HEAD" });
  assert.equal(res.status, 204);
  assert.deepEqual(calls, ["HEAD https://example.com/x"]);
});

test("hangFetch() never resolves and tracks the abort", async () => {
  const track = { aborted: false };
  const controller = new AbortController();
  const pending = hangFetch(track)("https://example.com", {
    signal: controller.signal,
  });
  controller.abort();
  assert.equal(track.aborted, true);
  const raced = await Promise.race([
    pending.then(() => "resolved"),
    Promise.resolve("still pending"),
  ]);
  assert.equal(raced, "still pending");
});
