import { PaginationSchema } from "@/libs/response";
import { z } from "zod";

export const MaterialTypeEnum = z.enum(["file"]);

export const CreateMaterialSchema = z.object({
  lecturerId: z.string(),
  groupId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  materialType: z.enum(["file"], {
    errorMap: () => ({
      message: 'Must be "file"',
    }),
  }),
  content: z.string().optional(),
  sourceUrl: z.string().url().optional(),

  isPublished: z
    .preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    }, z.boolean())
    .optional(),
  sequence: z
    .preprocess(
      (val) => (val === undefined || val === null ? undefined : Number(val)),
      z.number().int().optional(),
    )
    .optional(),
  file: z
    .any()
    .refine((file) => file instanceof File, "Must be a File object")
    .refine(
      (file) => file instanceof File && file.type === "application/pdf",
      "Only PDF files are allowed",
    )
    .refine(
      (file) => file instanceof File && file.size <= 10 * 1024 * 1024,
      "File size must be less than 10MB",
    ),
});

export const CreateMaterialMeSchema = CreateMaterialSchema.omit({
  lecturerId: true,
});

export const UpdateMaterialSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    materialType: z
      .enum(["file"], {
        errorMap: () => ({
          message: 'Must be "file"',
        }),
      })
      .optional(),
    content: z.string().optional(),
    sourceUrl: z.string().url().optional(),

    isPublished: z
      .preprocess((val) => {
        if (val === "true" || val === true) return true;
        if (val === "false" || val === false) return false;
        return val;
      }, z.boolean())
      .optional(),
    sequence: z
      .preprocess(
        (val) => (val === undefined || val === null ? undefined : Number(val)),
        z.number().int().optional(),
      )
      .optional(),
    forceReread: z
      .preprocess((val) => {
        if (val === "true" || val === true) return true;
        if (val === "false" || val === false) return false;
        return val;
      }, z.boolean())
      .optional(),
    file: z
      .any()
      .refine((file) => !file || file instanceof File, "Must be a File object")
      .refine(
        (file) =>
          !file || (file instanceof File && file.type === "application/pdf"),
        "Only PDF files are allowed",
      )
      .refine(
        (file) =>
          !file || (file instanceof File && file.size <= 10 * 1024 * 1024),
        "File size must be less than 10MB",
      )
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for modification updating",
  });

export const MaterialParamSchema = z.object({
  id: z.string(),
});

export const GetMaterialsQuerySchema = PaginationSchema.extend({
  lecturerId: z.string().optional(),
  materialType: MaterialTypeEnum.optional(),
  isPublished: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((val) => val === true || val === "true")
    .optional(),
});

export type CreateMaterialInput = z.infer<typeof CreateMaterialSchema>;
export type CreateMaterialMeInput = z.infer<typeof CreateMaterialMeSchema>;
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialSchema>;
