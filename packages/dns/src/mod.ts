/**
 * DNS probe for `@openstatus/health`: resolves a hostname through the
 * runtime's resolver and fails when it does not resolve.
 *
 * ```ts
 * import { dnsProbe } from "@openstatus/health-dns";
 *
 * const probe = dnsProbe({ hostname: "api.example.com" });
 * ```
 *
 * Node.js, Deno and Bun only: it uses `node:dns`.
 *
 * @module
 */

import { lookup as dnsLookup } from "node:dns/promises";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const dnsDefaultName = "dns";

/** One resolved address. */
export interface DnsAddress {
  /** The IPv4 or IPv6 address. */
  readonly address: string;
}

/** What the probe resolves with; `dns.promises.lookup` by default. */
export type DnsLookup = (
  hostname: string,
) => PromiseLike<DnsAddress | readonly DnsAddress[]>;

/** Options for `dnsProbe()`. */
export interface DnsProbeOptions extends ProbeOverrides {
  /** The name to resolve. */
  readonly hostname: string;
  /** Replacement `lookup`, for tests or a custom resolver. */
  readonly lookup?: DnsLookup;
}

/** A probe that resolves `hostname` to at least one address; non-critical by default. Throws `ProbeConfigError` for an empty `hostname`. */
export function dnsProbe(options: DnsProbeOptions): Probe {
  const hostname = options.hostname;
  if (typeof hostname !== "string" || hostname.length === 0) {
    throw new ProbeConfigError(
      "dnsProbe",
      "hostname",
      typeof hostname !== "string"
        ? `must be a string, got ${String(hostname)}`
        : "must not be empty",
    );
  }
  const lookup = options.lookup ?? dnsLookup;
  return {
    name: options.name ?? dnsDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: async () => {
      const result = await lookup(hostname);
      const addresses = Array.isArray(result) ? result : [result];
      const address = addresses[0]?.address;
      if (typeof address !== "string" || address.length === 0) {
        throw new Error(`no address for ${hostname}`);
      }
      return { address };
    },
  };
}
