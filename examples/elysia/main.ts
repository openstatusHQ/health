import { node } from "@elysiajs/node";
import { Elysia } from "elysia";
import { healthRoute } from "@openstatus/health-elysia";
import { cloudflareExtend } from "@openstatus/health-cloudflare";
import { exampleProbes } from "../probes.ts";

const app = new Elysia({ adapter: node() }).use(
  healthRoute({
    probes: exampleProbes(),
    extend: cloudflareExtend({ request: (ctx) => ctx.request }),
  }),
);

app.listen(3000);
