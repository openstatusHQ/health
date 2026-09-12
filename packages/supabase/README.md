# @openstatus/health-supabase

Postgres connection-pressure probe for
[Supabase](https://supabase.com/) for
[`@openstatus/health`](https://jsr.io/@openstatus/health), implementing the
"Check Postgres connection pressure" health check from Supabase's
[Detecting issues](https://supabase.com/docs/guides/observability/detecting#health)
guide.

supabase-js cannot run raw SQL, so the probe calls an RPC function you create
once. Run this migration in the SQL editor:

```sql
create or replace function public.health_connection_pressure()
returns table (
  current_connections int,
  active_connections int,
  waiting_connections int,
  max_connections int,
  connection_percent numeric
)
language sql security definer set search_path = public as $$
  select
    count(*)::int,
    count(*) filter (where state = 'active')::int,
    count(*) filter (where wait_event_type is not null)::int,
    current_setting('max_connections')::int,
    round(100.0 * count(*) / nullif(current_setting('max_connections')::int, 0), 2)
  from pg_stat_activity;
$$;
revoke all on function public.health_connection_pressure() from public;
grant execute on function public.health_connection_pressure() to service_role;
```

`pg_stat_activity` needs `security definer`, and the function should only be
granted to the role whose key the probe uses — `service_role` above, never
`anon` or `authenticated`.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-supabase
npm install @openstatus/health @openstatus/health-supabase
```

```ts
import { createClient } from "@supabase/supabase-js";
import { createHealthHandler } from "@openstatus/health";
import { supabaseProbe } from "@openstatus/health-supabase";

const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(
  createHealthHandler({ probes: [supabaseProbe({ client })] }),
);
```

The probe fails when the RPC returns an `error`, when the row shape is
unexpected, or when `connection_percent` is above `maxConnectionPercent`
(default `90`). Non-critical by default, so pressure degrades the report
instead of taking the service down. `signal` is forwarded via
`.abortSignal(signal)` when the builder exposes it.

```ts
supabaseProbe({
  client,
  rpc: "health_connection_pressure",
  maxConnectionPercent: 80,
  name: "postgres",
  critical: true,
  skip: () => env.SUPABASE_NOOP === "true",
});
```

A threshold breach throws `SupabaseConnectionPressureError`, which carries
the full `row`. Expose it through `formatError`:

```ts
import { SupabaseConnectionPressureError } from "@openstatus/health-supabase";

createHealthHandler({
  probes: [supabaseProbe({ client })],
  formatError: (error) =>
    error instanceof SupabaseConnectionPressureError
      ? `${error.message} (${error.row.current_connections}/${error.row.max_connections})`
      : error.message,
});
```
## About openstatus

[openstatus](https://www.openstatus.dev/) is the open-source uptime monitoring
and status page platform. This package is part of
[`@openstatus/health`](https://github.com/openstatusHQ/health), the `/health`
endpoints behind openstatus's own services, extracted so any JavaScript server
can expose one. Point an
[openstatus monitor](https://www.openstatus.dev/docs/reference/http-monitor)
at the endpoint and assert on `status` in the body to be alerted on
`degraded` before it becomes `unhealthy`.

Source: [github.com/openstatusHQ/health](https://github.com/openstatusHQ/health).
Issues and PRs welcome.

## License

[MIT](https://github.com/openstatusHQ/health/blob/main/LICENSE)
