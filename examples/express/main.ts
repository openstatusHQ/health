import express from "express";
import { healthRoute } from "@openstatus/health-express";
import { exampleProbes } from "../probes.ts";
import { exampleServer } from "../server.ts";

const app = express();
app.use(
  healthRoute({
    probes: exampleProbes(),
    extend: (_report, req) => ({
      ...exampleServer(),
      requestId: req.get("x-request-id"),
    }),
  }),
);
app.listen(3000);
