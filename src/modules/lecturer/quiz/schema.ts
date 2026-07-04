import { z } from "zod";

export const createQuizSchema = z.object({
  level: z.number().int().min(1),
  title: z.string().min(1),
  pass_threshold: z.number().min(0).max(100).default(70),
});

export const updateQuizSchema = createQuizSchema.partial();

export const createQuestionSchema = z.object({
  question_text: z.string().min(1),
  key_answer_text: z.string().min(1),
  sequence_order: z.number().int().min(1),
});

export const replaceBlanksSchema = z.object({
  blanks: z.array(
    z.object({
      keyword: z.string().min(1),
      start_index: z.number().int().min(0),
      end_index: z.number().int().min(0),
    }),
  ),
});

export const updateQuestionSchema = createQuestionSchema.partial();
