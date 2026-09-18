/**
 * Shallow field removal, used by the hosting packages' `omit` option.
 *
 * @module
 */

/**
 * A shallow copy of `value` without `keys`, typed without them too. Returns
 * `value` itself when there is nothing to omit. A non-empty tuple of keys
 * narrows the result to `Omit<T, K>`; an array that may be empty at runtime
 * keeps `T` in the result type, since nothing is dropped then.
 */
export function omitFields<T extends object, K extends keyof T>(
  value: T,
  keys: readonly [K, ...K[]],
): Omit<T, K>;
/**
 * A shallow copy of `value` without `keys`, or `value` itself when `keys` is
 * missing or empty. `K` defaults to `never`, so omitting nothing keeps the
 * original type.
 */
export function omitFields<T extends object, K extends keyof T = never>(
  value: T,
  keys?: readonly K[],
): T | Omit<T, K>;
export function omitFields<T extends object, K extends keyof T>(
  value: T,
  keys?: readonly K[],
): T | Omit<T, K> {
  if (keys == null || keys.length === 0) return value;
  const result: Partial<T> = { ...value };
  for (const key of keys) delete result[key];
  return result as Omit<T, K>;
}
