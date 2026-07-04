import { createBaseApp } from "@/libs/base";
import { lecturerQuiz } from "./quiz";

export const lecturer = createBaseApp({ tags: ["Lecturer"] }).group(
  "/api/lecturer",
  (app) => app.use(lecturerQuiz),
);
