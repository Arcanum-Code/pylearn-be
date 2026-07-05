import { Elysia } from "elysia";

const scopedAuth = new Elysia()
  .onBeforeHandle(() => { throw new Error("Auth Failed"); })
  .as("scoped");

const leakingGroup = scopedAuth
  .onError(({ error }) => { return "Caught: " + error.message; })
  .group("/groups", (app) => app.get("/", () => "groups"));

const app = new Elysia()
  .get("/storage", () => "static file")
  .use(leakingGroup)
  .listen(3013);
