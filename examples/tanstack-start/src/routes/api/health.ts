import { createRootRoute, createRoute } from "@tanstack/react-router";
import type {} from "@tanstack/start-client-core";
import { healthRoute } from "@openstatus/health-tanstack-start";
import { vercelServer } from "@openstatus/health-vercel";
import { exampleProbes } from "../../../../probes.ts";

const rootRoute = createRootRoute();

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/api/health",
  server: {
    handlers: healthRoute({
      probes: exampleProbes(),
      extend: (_report, { request }) => ({
        server: vercelServer(),
        requestId: request.headers.get("x-request-id"),
      }),
    }),
  },
});
