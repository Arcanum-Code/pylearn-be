import { Elysia } from "elysia";
import staticPlugin from "@elysiajs/static";
import { join } from "path";
import { materials } from "./src/modules/materials";
import { auth } from "./src/modules/auth";

const app = new Elysia()
  .use(
    staticPlugin({
      assets: join(process.cwd(), "storage"),
      prefix: "/storage",
    }),
  )
  .use(auth)
  .use(materials)
  .listen(3007);
console.log("Listening on 3007");
