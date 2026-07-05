import { Elysia } from "elysia";
import staticPlugin from "@elysiajs/static";
import { join } from "path";
import { auth, materials, user, rbac, dashboard, quizzes, group, student, lecturer } from "./src/modules";

const app = new Elysia()
  .use(
    staticPlugin({
      assets: join(process.cwd(), "storage"),
      prefix: "/storage",
    }),
  )
  .use(auth)
  .use(materials)
  .use(user)
  .use(rbac)
  .use(dashboard)
  .use(quizzes)
  .use(group)
  .use(student)
  .use(lecturer)
  .listen(3008);
console.log("Listening on 3008");
