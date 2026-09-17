# @openstatus/health-stripe

[Stripe](https://stripe.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/v1/balance` with your secret key as a bearer header, so it
proves both that the Stripe API answers and that the key is valid — with
`fetch` alone, on every runtime.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-stripe
npm install @openstatus/health @openstatus/health-stripe
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { stripeProbe } from "@openstatus/health-stripe";

const secretKey = readEnv("STRIPE_SECRET_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `secretKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      stripeProbe({
        secretKey: secretKey || "unconfigured",
        skip: () => !secretKey,
      }),
    ],
  }),
);
```

`secretKey` is the `sk_live_…` / `sk_test_…` key, or a restricted key (`rk_…`)
granted read access to **Balance** — the least privilege that still
authenticates. Retrieving the balance is a read with no side effects and no
list to page, so the probe can run on every health request. `baseUrl` defaults
to `https://api.stripe.com` and takes the URL of a mock server such as
`stripe-mock`. Like every probe here, this one never reads the environment
itself — pass the values in, and use `skip` for environments where Stripe is
not configured.

```ts
stripeProbe({
  secretKey,
  // optional overrides from the Probe contract
  name: "billing",
  critical: true,
  timeoutMs: 2000,
  skip: () => !secretKey,
});
```

Non-critical by default: most requests do not touch Stripe, so an outage
degrades the report instead of taking the service out of rotation. Set
`critical: true` for a checkout or billing service that cannot serve without
it.

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
