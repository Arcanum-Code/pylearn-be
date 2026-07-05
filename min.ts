import { Elysia } from "elysia";
import staticPlugin from "@elysiajs/static";
import { join } from "path";

const app = new Elysia()
  .use(
    staticPlugin({
      assets: join(process.cwd(), "storage"),
      prefix: "/storage",
    }),
  )
  .listen(3006);
console.log("Listening on 3006");
