/**
 * TLS probe for `@openstatus/health`: completes a handshake with
 * `host:port`, requires a trusted certificate and fails when it expires
 * within `minDaysValid` days.
 *
 * ```ts
 * import { tlsProbe } from "@openstatus/health-tls";
 *
 * const probe = tlsProbe({ host: "api.example.com" });
 * ```
 *
 * Node.js, Deno and Bun only: it uses `node:tls`.
 *
 * @module
 */

import { connect as tlsConnect } from "node:tls";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const tlsDefaultName = "tls";
/** Port when `port` is unset. */
export const tlsDefaultPort = 443;
/** Minimum remaining validity when `minDaysValid` is unset. */
export const tlsDefaultMinDaysValid = 14;

/** The subset of a peer certificate the probe reads. */
export interface TlsPeerCertificate {
  /** Expiry, as the date string `getPeerCertificate()` returns. */
  readonly valid_to: string;
}

/** The subset of a `tls.TLSSocket` the probe uses. */
export interface TlsLikeSocket {
  /** Listen once for `secureConnect` (handshake done) or `error` (failed). */
  once(
    event: "secureConnect" | "error",
    listener: (error?: Error) => void,
  ): TlsLikeSocket;
  /** Whether the peer certificate chained to a trusted CA. */
  readonly authorized: boolean;
  /** Why it did not, when `authorized` is false. */
  readonly authorizationError?: Error | string | null;
  /** The peer certificate after the handshake. */
  getPeerCertificate(): TlsPeerCertificate;
  /** Close the socket. */
  destroy(): void;
}

/** What the probe connects with; `tls.connect` by default. */
export type TlsConnect = (
  options: {
    readonly host: string;
    readonly port: number;
    readonly servername: string;
  },
) => TlsLikeSocket;

/** Options for `tlsProbe()`. */
export interface TlsProbeOptions extends ProbeOverrides {
  /** Hostname; also sent as the SNI server name. */
  readonly host: string;
  /** Port. Default `tlsDefaultPort`. */
  readonly port?: number;
  /** Fail when the certificate expires in fewer days than this. Default `tlsDefaultMinDaysValid`. */
  readonly minDaysValid?: number;
  /** Replacement `connect`, for tests. */
  readonly connect?: TlsConnect;
}

/** Thrown by the probe when the certificate expires within `minDaysValid` days. */
export class TlsCertificateExpiryError extends Error {
  /** When the certificate expires. */
  readonly expiresAt: Date;
  /** Days left, rounded down; negative once expired. */
  readonly daysLeft: number;

  /** Build the error for a certificate expiring at `expiresAt` against `minDaysValid`. */
  constructor(expiresAt: Date, daysLeft: number, minDaysValid: number) {
    super(
      daysLeft < 0
        ? `certificate expired ${expiresAt.toISOString()}`
        : `certificate expires in ${daysLeft} days, fewer than ${minDaysValid}`,
    );
    this.name = "TlsCertificateExpiryError";
    this.expiresAt = expiresAt;
    this.daysLeft = daysLeft;
  }
}

/** A probe that completes a TLS handshake and checks certificate trust and expiry; non-critical by default. Throws `ProbeConfigError` for an empty `host`, an invalid `port` or a negative `minDaysValid`. */
export function tlsProbe(options: TlsProbeOptions): Probe {
  const host = options.host;
  if (typeof host !== "string" || host.length === 0) {
    throw new ProbeConfigError(
      "tlsProbe",
      "host",
      typeof host !== "string"
        ? `must be a string, got ${String(host)}`
        : "must not be empty",
    );
  }
  const port = options.port ?? tlsDefaultPort;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ProbeConfigError(
      "tlsProbe",
      "port",
      `must be an integer between 1 and 65535, got ${String(port)}`,
    );
  }
  const minDaysValid = options.minDaysValid ?? tlsDefaultMinDaysValid;
  if (!Number.isFinite(minDaysValid) || minDaysValid < 0) {
    throw new ProbeConfigError(
      "tlsProbe",
      "minDaysValid",
      `must be a non-negative number, got ${String(minDaysValid)}`,
    );
  }
  const connect = options.connect ?? tlsConnect;
  return {
    name: options.name ?? tlsDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) =>
      new Promise<{ expiresAt: string; daysLeft: number }>(
        (resolve, reject) => {
          signal.throwIfAborted();
          const socket = connect({ host, port, servername: host });
          const settle = (finish: () => void) => {
            signal.removeEventListener("abort", onAbort);
            socket.destroy();
            finish();
          };
          const onAbort = () => settle(() => reject(signal.reason));
          socket.once("secureConnect", () => {
            let result: { expiresAt: string; daysLeft: number };
            try {
              result = inspect(socket, minDaysValid);
            } catch (error) {
              settle(() => reject(error));
              return;
            }
            settle(() => resolve(result));
          });
          socket.once(
            "error",
            (error) => settle(() => reject(error ?? new Error("socket error"))),
          );
          signal.addEventListener("abort", onAbort, { once: true });
        },
      ),
  };
}

function inspect(
  socket: TlsLikeSocket,
  minDaysValid: number,
): { expiresAt: string; daysLeft: number } {
  if (!socket.authorized) {
    const reason = socket.authorizationError;
    throw reason instanceof Error
      ? reason
      : new Error(reason == null ? "certificate not trusted" : String(reason));
  }
  const expiresAt = new Date(socket.getPeerCertificate().valid_to);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("certificate has no readable expiry");
  }
  const msLeft = expiresAt.getTime() - Date.now();
  const daysLeft = Math.floor(msLeft / 86_400_000);
  if (msLeft < minDaysValid * 86_400_000) {
    throw new TlsCertificateExpiryError(expiresAt, daysLeft, minDaysValid);
  }
  return { expiresAt: expiresAt.toISOString(), daysLeft };
}
