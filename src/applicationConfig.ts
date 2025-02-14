import { z } from "zod";

export const ArgsSchema = z.object({
  regions: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val);
        if (!Array.isArray(parsed)) throw new Error();
        return parsed;
      } catch {
        throw new Error(
          'Regions must be a valid JSON array (e.g., \'["Europe", "Americas"]\')',
        );
      }
    })
    .refine(
      (arr) =>
        arr.every((region) => ["Europe", "Americas", "Asia"].includes(region)),
      {
        message:
          "Regions must be an array containing only 'Europe', 'Americas', or 'Asia'.",
      },
    ),
  filename: z.string(),
  date: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: "Date must be in YYYY-MM-DD format",
    }),
});

export type Args = z.infer<typeof ArgsSchema>;
