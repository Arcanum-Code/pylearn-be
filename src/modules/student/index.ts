import { createBaseApp } from "@/libs/base";
import { studentGroups } from "./groups";
import { studentMaterials } from "./materials";
import { studentQuiz } from "./quiz";

export const student = createBaseApp({ tags: ["Student"] }).group(
  "/student",
  (app) => app.use(studentGroups).use(studentMaterials).use(studentQuiz),
);
