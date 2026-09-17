import assert from "node:assert/strict";
import test from "node:test";
import { omitFields } from "./omit.ts";

test("omitFields() returns the same object when nothing is omitted", () => {
  const value = { a: 1, b: 2 };
  assert.equal(omitFields(value, undefined), value);
  assert.equal(omitFields(value, []), value);
});

test("omitFields() drops the named keys", () => {
  assert.deepEqual(omitFields({ a: 1, b: 2, c: 3 }, ["b"]), { a: 1, c: 3 });
});

test("omitFields() skips optional keys that are absent", () => {
  const value: { a: number; b?: number } = { a: 1 };
  assert.deepEqual(omitFields(value, ["b"]), { a: 1 });
});

test("omitFields() does not mutate the original", () => {
  const value = { a: 1, b: 2 };
  omitFields(value, ["a"]);
  assert.deepEqual(value, { a: 1, b: 2 });
});

test("omitFields() types the result without the omitted keys", () => {
  const value: { a: number; b?: number } = { a: 1, b: 2 };
  const omitted = omitFields(value, ["a"]);
  // @ts-expect-error `a` was omitted, so it is gone from the result type
  omitted.a;
  assert.deepEqual(omitted, { b: 2 });
});

test("omitFields() keeps the original type when nothing is omitted", () => {
  const value: { a: number; b?: number } = { a: 1 };
  const kept = omitFields(value, undefined);
  assert.equal(kept.a, 1);
});
