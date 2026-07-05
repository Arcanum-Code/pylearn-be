import { Elysia } from "elysia";
import staticPlugin from "@elysiajs/static";
import { join } from "path";
import { lecturer } from "./src/modules";

const app = new Elysia()
  .use(
    staticPlugin({
      assets: join(process.cwd(), "storage"),
      prefix: "/storage",
    }),
  )
  .use(lecturer)
  .listen(3014);
