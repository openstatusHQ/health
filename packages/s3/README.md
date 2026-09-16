# @openstatus/health-s3

S3 probe for [`@openstatus/health`](https://jsr.io/@openstatus/health).
Sends [`HeadBucket`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_HeadBucket.html)
through an [`@aws-sdk/client-s3`](https://github.com/aws/aws-sdk-js-v3)
client and fails the check when the bucket does not answer — on AWS S3,
Cloudflare R2, Tigris, Backblaze B2, MinIO or any other S3-compatible store.

```sh
deno add jsr:@openstatus/health jsr:@openstatus/health-s3
npm install @openstatus/health @openstatus/health-s3 @aws-sdk/client-s3
```

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { createHealthHandler } from "@openstatus/health";
import { s3Probe } from "@openstatus/health-s3";

const client = new S3Client({ region: env.AWS_REGION });

Deno.serve(
  createHealthHandler({
    probes: [s3Probe({ client, bucket: env.S3_BUCKET })],
  }),
);
```

`HeadBucket` is the cheapest request that proves the endpoint, the
credentials and the bucket at once: it transfers no body, and a `403` or
`404` — wrong credentials, wrong bucket, wrong region — fails the check
just like a network error. The probe's `AbortSignal` is passed as
`abortSignal`, so a `timeoutMs` cancels the request in flight.

```ts
s3Probe({
  client,
  bucket: "uploads",
  // optional overrides from the Probe contract
  name: "uploads",
  critical: true,
  timeoutMs: 2000,
  skip: () => env.S3_BUCKET == null,
});
```

Non-critical by default: object storage usually backs uploads and assets
whose outage degrades the report instead of taking the service out of
rotation. Set `critical: true` when requests cannot proceed without it.

Unlike most probes here, this one imports `HeadBucketCommand` at runtime,
so `@aws-sdk/client-s3` is a required peer dependency. The client itself is
typed structurally as `{ send(command, options?) }`. The factory throws
`ProbeConfigError` at construction when the client has no `send()` or
`bucket` is empty. Inside a Cloudflare Worker, prefer
`@openstatus/health-cloudflare-r2` and its binding over the S3 API.

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
