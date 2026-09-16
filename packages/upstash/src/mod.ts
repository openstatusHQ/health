import {
  expectOk,
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
  probeUrl,
} from "@openstatus/health";

export const upstashDefaultName = "redis";

export interface UpstashProbeOptions extends ProbeOverrides {
  readonly url: string | URL;
  readonly token: string;
  readonly fetch?: typeof fetch;
}

export function upstashProbe(options: UpstashProbeOptions): Probe {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = probeUrl({
    probe: "upstashProbe",
    field: "url",
    value: options.url,
    path: "/ping",
  });
  if (typeof options.token !== "string" || options.token.length === 0) {
    throw new ProbeConfigError(
      "upstashProbe",
      "token",
      typeof options.token !== "string"
        ? `must be a string, got ${String(options.token)}`
        : "must not be empty",
    );
  }
  const headers = { authorization: `Bearer ${options.token}` };
  return {
    name: options.name ?? upstashDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) => expectOk(doFetch(url, { method: "GET", headers, signal })),
  };
}
