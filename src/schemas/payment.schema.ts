import { z } from "zod";

export const bankAccountSchema = z.object({
  accountHolderName: z.string().min(1).max(150),
  accountNumber: z.string().min(1).max(50),
  ifscCode: z.string().min(1).max(20),
  bankName: z.string().min(1).max(150),
});

export const withdrawSchema = z.object({
  amount: z.number().positive(),
});
