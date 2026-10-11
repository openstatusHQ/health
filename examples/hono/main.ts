import { Hono } from "hono";
import { healthRoute } from "@openstatus/health-hono";
import { flyExtend } from "@openstatus/health-fly";
import { exampleProbes } from "../probes.ts";

const app = new Hono();
app.route("/", healthRoute({ probes: exampleProbes(), extend: flyExtend() }));

export default app;
