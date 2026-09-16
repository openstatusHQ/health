/**
 * Probe list validation.
 *
 * @module
 */

import { DuplicateProbeError } from "./errors.ts";
import type { Probe } from "./types.ts";

/** Throw `DuplicateProbeError` when two probes share a name. */
export function assertUniqueProbeNames(probes: readonly Probe[]): void {
  const seen = new Set<string>();
  for (const probe of probes) {
    if (seen.has(probe.name)) throw new DuplicateProbeError(probe.name);
    seen.add(probe.name);
  }
}
