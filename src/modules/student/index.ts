import { createBaseApp } from "@/libs/base";
import { studentMaterials } from "./materials";

export const student = createBaseApp({ tags: ["Student"] }).group(
  "/student",
  (app) => app.use(studentMaterials),
);
