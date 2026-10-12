import type { JsonObject } from "@openstatus/health";
import { flyServer } from "@openstatus/health-fly";
import { koyebServer } from "@openstatus/health-koyeb";
import { railwayServer } from "@openstatus/health-railway";
import { vercelServer } from "@openstatus/health-vercel";

export function exampleServer(): JsonObject {
  const server =
    flyServer() ?? koyebServer() ?? railwayServer() ?? vercelServer();
  return server == null ? {} : { server };
}
