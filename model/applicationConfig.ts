import { z } from "zod";

export const ArgsSchema = z.object({
  regions: z
    .string()
    .optional()
    .default(JSON.stringify(["Europe", "Americas", "Asia"])) // Default as JSON string
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
  filename: z.string().default("../data/matchdata.json"),
  date: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: "Date must be in YYYY-MM-DD format",
    }),
});
