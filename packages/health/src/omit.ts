/**
 * Shallow field removal, used by the hosting packages' `omit` option.
 *
 * @module
 */

/**
 * A shallow copy of `value` without `keys`, typed without them too. Returns
 * `value` itself when there is nothing to omit. `K` defaults to `never`, so
 * omitting nothing keeps the original type.
 */
export function omitFields<T extends object, K extends keyof T = never>(
  value: T,
  keys?: readonly K[],
): Omit<T, K> {
  if (keys == null || keys.length === 0) return value;
  const blocked: ReadonlySet<keyof T> = new Set(keys);
  const result: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (blocked.has(key)) continue;
    result[key] = value[key];
  }
  return result as Omit<T, K>;
}
