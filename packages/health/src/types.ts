/**
 * Public types shared by every function in `@openstatus/health`: the probe
 * contract, the report and response shapes, and the layered option objects.
 *
 * @module
 */

/** Aggregate outcome of one round of probes. */
export type HealthStatus = "ok" | "degraded" | "unhealthy";

/** Outcome of a single probe within a round. */
export type CheckStatus = "ok" | "failed" | "timeout" | "skipped";

/** Whatever a probe's `run` may resolve to; the value is ignored. */
export type ProbeResult =
  | void
  | null
  | boolean
  | number
  | bigint
  | string
  | object;

/** What a probe learns about itself when it runs. */
export interface ProbeContext {
  /** The probe's `name`. */
  readonly name: string;
  /** Whether the probe is critical for this run. */
  readonly critical: boolean;
  /** The effective timeout for this run, after defaults and `deadlineMs`. */
  readonly timeoutMs: number;
}

/**
 * One dependency check. Healthy when `run` resolves, failed when it throws or
 * rejects, `timeout` when `timeoutMs` elapses first.
 */
export interface Probe {
  /** Unique name within one endpoint; reported in `checks`. */
  readonly name: string;
  /** A failure marks the report `unhealthy` instead of `degraded`. Default `false`. */
  readonly critical?: boolean;
  /** Per-probe timeout in milliseconds. Default `defaultTimeoutMs`. */
  readonly timeoutMs?: number;
  /** Return `true` to report the check as `skipped` without calling `run`. */
  readonly skip?: () => boolean | Promise<boolean>;
  /** The check itself; `signal` aborts when the timeout fires. */
  readonly run: (
    signal: AbortSignal,
    ctx: ProbeContext,
  ) => ProbeResult | Promise<ProbeResult>;
}

/** The `Probe` fields every probe factory lets the caller override. */
export type ProbeOverrides = Partial<
  Pick<Probe, "name" | "critical" | "timeoutMs" | "skip">
>;

/** The reported outcome of one probe. */
export type CheckResult = {
  /** The probe's `name`. */
  readonly name: string;
  /** How the probe ended. */
  readonly status: CheckStatus;
  /** Whether the probe was critical. */
  readonly critical: boolean;
  /** Wall-clock time the probe took, `0` when skipped. */
  readonly latencyMs: number;
  /** The formatted error for `failed` and `timeout` checks. */
  readonly error?: string;
};

/** The outcome of one round of probes. */
export type HealthReport = {
  /** Aggregate status across all checks. */
  readonly status: HealthStatus;
  /** ISO 8601 timestamp of when the round finished. */
  readonly checkedAt: string;
  /** Wall-clock time of the whole round. */
  readonly latencyMs: number;
  /** One entry per probe, in the order they were given. */
  readonly checks: readonly CheckResult[];
};

/** A JSON scalar. */
export type JsonPrimitive = string | number | boolean | null;

/** Any JSON value. */
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

/** A JSON object; `undefined` values are dropped by `JSON.stringify`. */
export type JsonObject = { readonly [key: string]: JsonValue | undefined };

/** Turns a probe error into the string reported in a check's `error` field. */
export type FormatError = (error: Error) => string;

/**
 * `"generic"` masks messages (`"failed"` / `"timed out after Nms"`),
 * `"message"` reports `error.message`, or supply your own formatter.
 */
export type FormatErrorOption = FormatError | "generic" | "message";

/**
 * Extra fields merged into the response body when checks are exposed. `ctx`
 * is the framework's request context.
 */
export type Extend<Ctx> = (
  report: HealthReport,
  ctx: Ctx,
) => object | Promise<object>;

/** Called once per uncached round after the probes finish. */
export type OnReport = (report: HealthReport) => void | Promise<void>;

/** Called when `extend` or a function-form `exposeChecks` throws. */
export type OnError<Ctx> = (error: Error, ctx: Ctx) => void;

/** Whether to include `latencyMs`, `checks` and `extend` output; may decide per request. */
export type ExposeChecks<Ctx> =
  | boolean
  | ((ctx: Ctx) => boolean | Promise<boolean>);

/** Options for `runProbes()`. */
export interface RunProbesOptions {
  /** Default per-probe timeout in milliseconds. Default `defaultTimeoutMs`. */
  readonly timeoutMs?: number;
  /** Upper bound for the whole round; every probe's timeout is capped to it. */
  readonly deadlineMs?: number;
  /** How probe errors are rendered. Default `"generic"`. */
  readonly formatError?: FormatErrorOption;
}

/** Options for `createHealthCheck()`. */
export interface HealthCheckOptions extends RunProbesOptions {
  /** Probes to run concurrently on every uncached request. */
  readonly probes: readonly Probe[];
  /** How long an `ok` report is reused. Default `defaultCacheMs`; `0` disables. */
  readonly cacheMs?: number;
  /** How long a `degraded` or `unhealthy` report is reused. Default `cacheMs`. */
  readonly cacheFailuresMs?: number;
  /** Stale-while-revalidate window after the cache expires. Default `0`. */
  readonly staleMs?: number;
  /** Observer for every uncached round. */
  readonly onReport?: OnReport;
}

/** Options for `renderHealthResponse()`. */
export interface HealthResponseOptions {
  /** Include `latencyMs` and `checks` in the body. Default `true`. */
  readonly exposeChecks?: boolean;
  /** HTTP status for `unhealthy`. Default `defaultUnhealthyStatusCode`. */
  readonly unhealthyStatusCode?: number;
  /** HTTP status for `degraded`. Default `defaultDegradedStatusCode`. */
  readonly degradedStatusCode?: number;
}

/** Build the check from `probes`. */
export interface HealthProbesSource extends HealthCheckOptions {
  /** Must be absent when `probes` is given. */
  readonly check?: undefined;
}

/** Reuse a prebuilt `HealthCheck`, for example one shared between routes. */
export interface HealthCheckSource {
  /** The check to serve. */
  readonly check: HealthCheck;
  /** Must be absent when `check` is given. */
  readonly probes?: undefined;
}

/** Either `probes` or a prebuilt `check`, never both. */
export type HealthSource = HealthProbesSource | HealthCheckSource;

/** Response-shaping options for `createHealthResponder()` and the adapters. */
export interface HealthResponderOptions<Ctx = Request> {
  /** Include details in the body, globally or per request. Default `true`. */
  readonly exposeChecks?: ExposeChecks<Ctx>;
  /** HTTP status for `unhealthy`. Default `defaultUnhealthyStatusCode`. */
  readonly unhealthyStatusCode?: number;
  /** HTTP status for `degraded`. Default `defaultDegradedStatusCode`. */
  readonly degradedStatusCode?: number;
  /** Extra fields merged into the body when checks are exposed. */
  readonly extend?: Extend<Ctx>;
  /** Error sink for `extend` and `exposeChecks`. Default `console.error`. */
  readonly onError?: OnError<Ctx>;
}

/** Options for `createHealthResponder()` and adapter `healthHandler()`s. */
export type HealthHandlerOptions<Ctx = Request> =
  & HealthSource
  & HealthResponderOptions<Ctx>;

/** Options for `createHealthHandler()` and adapter `healthRoute()`s. */
export type HealthRouteOptions<Ctx = Request> = HealthHandlerOptions<Ctx> & {
  /** Route to answer on. Adapters default to `"/health"`; the core handler answers everywhere when unset. */
  readonly path?: string;
};

/** The JSON body of a health response. */
export type HealthResponseBody = {
  /** Aggregate status. */
  readonly status: HealthStatus;
  /** When the underlying report was produced. */
  readonly checkedAt: string;
  /** Round latency; absent when checks are hidden. */
  readonly latencyMs?: number;
  /** Per-probe results; absent when checks are hidden. */
  readonly checks?: readonly CheckResult[];
  /** Anything `extend` added. */
  readonly [key: string]: JsonValue | object | undefined;
};

/** A rendered health response, before it becomes a framework response. */
export type HealthHttpResponse = {
  /** HTTP status code. */
  readonly status: number;
  /** Headers to send. */
  readonly headers: Readonly<Record<string, string>>;
  /** Body to serialize. */
  readonly body: HealthResponseBody;
};

/** A cached, de-duplicated probe runner from `createHealthCheck()`. */
export interface HealthCheck {
  /** The current report, from cache or a fresh round. */
  report(): Promise<HealthReport>;
  /** Drop the cache so the next `report()` runs the probes. */
  invalidate(): void;
}

/** Everything between "a request arrived" and "here is the response". */
export interface HealthResponder<Ctx = Request> {
  /** The check being served. */
  readonly check: HealthCheck;
  /** Render `{ status, headers, body }` for a request context. */
  respond(ctx: Ctx): Promise<HealthHttpResponse>;
  /** Build a Fetch `Response`; `HEAD` drops the body. */
  toResponse(ctx: Ctx, method?: string): Promise<Response>;
}
