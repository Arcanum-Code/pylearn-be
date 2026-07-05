import { Elysia } from "elysia";
import { group, health } from "./src/modules";

const app = new Elysia()
  .use(health)
  .use(group)
  .listen(3015);
