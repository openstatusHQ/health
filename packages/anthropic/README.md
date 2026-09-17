# @openstatus/health-anthropic

[Anthropic](https://www.anthropic.com/) probe for
[`@openstatus/health`](https://jsr.io/@openstatus/health). Sends
`GET {baseUrl}/v1/models` with your API key in the `x-api-key` header, so it
proves both that the API answers and that the key is valid — with `fetch`
alone, on every runtime, and without spending a single token.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-anthropic
npm install @openstatus/health @openstatus/health-anthropic
```

```ts
import { createHealthHandler, readEnv } from "@openstatus/health";
import { anthropicProbe } from "@openstatus/health-anthropic";

const apiKey = readEnv("ANTHROPIC_API_KEY");

Deno.serve(
  createHealthHandler({
    probes: [
      // the factory validates `apiKey` at construction, so pass a
      // placeholder and let `skip` keep the unconfigured check from running.
      anthropicProbe({
        apiKey: apiKey || "unconfigured",
        skip: () => !apiKey,
      }),
    ],
  }),
);
```

`apiKey` is the `sk-ant-…` key from the Anthropic Console. Listing models is a
free read with no side effects, so the probe can run on every health request.
The request also sends `anthropic-version: 2023-06-01`, the header every API
call requires; `anthropicDefaultVersion` exports it. `baseUrl` defaults to
`https://api.anthropic.com` and takes the origin of a gateway in front of it.
Like every probe here, this one never reads the environment itself — pass the
values in, and use `skip` for environments where Anthropic is not configured.

A 2xx here means the API is up and the key authenticates. It does not prove
that a specific model is available or that messages are within their rate
limit; a model-level outage shows up in your request errors before it shows up
here.

```ts
anthropicProbe({
  apiKey: apiKey || "unconfigured",
  // optional overrides from the Probe contract
  name: "llm",
  critical: true,
  timeoutMs: 2000,
  skip: () => !apiKey,
});
```

Non-critical by default: most services can answer without a model call, so an
outage degrades the report instead of taking the service out of rotation. Set
`critical: true` for a service whose every request is an inference.

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
