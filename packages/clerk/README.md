# @openstatus/health-clerk

[Clerk](https://clerk.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/v1/users?limit=1` to the Clerk Backend API with your secret key
as a bearer header, so it proves both that Clerk answers and that the key is
valid — with `fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-clerk
npm install @openstatus/health @openstatus/health-clerk
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { clerkProbe } from "@openstatus/health-clerk";

const secretKey = readEnv("CLERK_SECRET_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `secretKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      clerkProbe({
        secretKey: secretKey ?? "unconfigured",
        skip: () => secretKey == null,
      }),
    ],
  }),
);
```

`secretKey` is the `CLERK_SECRET_KEY` of the instance (`sk_live_…` or
`sk_test_…`). Listing one user is the cheapest authenticated read on the
Backend API and has no side effects, so the probe can run on every health
request. `baseUrl` defaults to `https://api.clerk.com`. Like every probe here,
this one never reads the environment itself — pass the values in, and use
`skip` for environments where Clerk is not configured.

This checks the Backend API your server calls to verify sessions and read
users; the Frontend API your browser code talks to is a separate host with its
own status.

```ts
clerkProbe({
  secretKey,
  // optional overrides from the Probe contract
  name: "auth",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.CLERK_SECRET_KEY == null,
});
```

Non-critical by default, since Clerk's session tokens are verified locally
with the instance's JWKS and most requests never call the Backend API. Set
`critical: true` when requests cannot be served without it — sign-up, user
management or organization lookups on every request.

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
