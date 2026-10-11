import { Elysia } from "elysia";
import { healthRoute } from "@openstatus/health-elysia";
import { cloudflareExtend } from "@openstatus/health-cloudflare";
import { exampleProbes } from "../probes.ts";

const app = new Elysia().use(
  healthRoute({
    probes: exampleProbes(),
    extend: cloudflareExtend({ request: (ctx) => ctx.request }),
  }),
);

export default app;
