import { Elysia } from "elysia";
import staticPlugin from "@elysiajs/static";
import { join } from "path";
import { group, health } from "./src/modules";

const app = new Elysia()
  .use(group)
  .use(
    staticPlugin({
      assets: join(process.cwd(), "storage"),
      prefix: "/storage",
    }),
  )
  .use(health)
  .listen(3016);
