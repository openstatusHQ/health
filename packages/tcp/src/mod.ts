/**
 * TCP probe for `@openstatus/health`: opens a socket to `host:port` and
 * closes it again, for any dependency without a client library.
 *
 * ```ts
 * import { tcpProbe } from "@openstatus/health-tcp";
 *
 * const probe = tcpProbe({ host: "smtp.example.com", port: 587 });
 * ```
 *
 * Node.js, Deno and Bun only: it uses `node:net`.
 *
 * @module
 */

import { connect as netConnect } from "node:net";
import {
  type Probe,
  ProbeConfigError,
  type ProbeOverrides,
} from "@openstatus/health";

/** Probe name when `name` is unset. */
export const tcpDefaultName = "tcp";

/** The subset of a `net.Socket` the probe uses. */
export interface TcpLikeSocket {
  /** Listen once for `connect` (established) or `error` (failed). */
  once(
    event: "connect" | "error",
    listener: (error?: Error) => void,
  ): TcpLikeSocket;
  /** Close the socket. */
  destroy(): void;
}

/** What the probe connects with; `net.connect` by default. */
export type TcpConnect = (
  options: { readonly host: string; readonly port: number },
) => TcpLikeSocket;

/** Options for `tcpProbe()`. */
export interface TcpProbeOptions extends ProbeOverrides {
  /** Hostname or IP address. */
  readonly host: string;
  /** Port, 1–65535. */
  readonly port: number;
  /** Replacement `connect`, for tests. */
  readonly connect?: TcpConnect;
}

/** A probe that connects to `host:port`; non-critical by default. Throws `ProbeConfigError` for an empty `host` or an invalid `port`. */
export function tcpProbe(options: TcpProbeOptions): Probe {
  const { host, port } = options;
  if (typeof host !== "string" || host.length === 0) {
    throw new ProbeConfigError(
      "tcpProbe",
      "host",
      typeof host !== "string"
        ? `must be a string, got ${String(host)}`
        : "must not be empty",
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ProbeConfigError(
      "tcpProbe",
      "port",
      `must be an integer between 1 and 65535, got ${String(port)}`,
    );
  }
  const connect = options.connect ?? netConnect;
  return {
    name: options.name ?? tcpDefaultName,
    critical: options.critical ?? false,
    timeoutMs: options.timeoutMs,
    skip: options.skip,
    run: (signal) =>
      new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const socket = connect({ host, port });
        const settle = (finish: () => void) => {
          signal.removeEventListener("abort", onAbort);
          socket.destroy();
          finish();
        };
        const onAbort = () => settle(() => reject(signal.reason));
        socket.once("connect", () => settle(resolve));
        socket.once(
          "error",
          (error) => settle(() => reject(error ?? new Error("socket error"))),
        );
        signal.addEventListener("abort", onAbort, { once: true });
      }),
  };
}
