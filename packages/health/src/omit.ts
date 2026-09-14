export function omitFields<T extends object>(
  value: T,
  keys: readonly (keyof T)[] | undefined,
): T {
  if (keys == null || keys.length === 0) return value;
  const blocked: ReadonlySet<keyof T> = new Set(keys);
  const result: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (blocked.has(key)) continue;
    result[key] = value[key];
  }
  return result as T;
}
