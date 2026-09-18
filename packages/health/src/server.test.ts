import assert from "node:assert/strict";
import test from "node:test";
import { serverExtend } from "./server.ts";

test("serverExtend() wraps the info under server", () => {
  const extend = serverExtend(() => ({ platform: "fly", region: "ams" }));
  assert.deepEqual(extend(), { server: { platform: "fly", region: "ams" } });
});

test("serverExtend() renders nothing when the reader is undefined", () => {
  const extend = serverExtend(() => undefined);
  assert.deepEqual(extend(), {});
});

test("serverExtend() reads once and returns the same object", () => {
  let calls = 0;
  const extend = serverExtend(() => {
    calls += 1;
    return { platform: "fly", calls };
  });
  const first = extend();
  const second = extend();
  assert.equal(calls, 1);
  assert.equal(first, second);
});
