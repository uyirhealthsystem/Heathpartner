import { z } from "zod";

export const locationNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const districtHealthPartnersQuerySchema = z.object({
  blockId: z.string().trim().min(1).optional(),
  villageId: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DistrictHealthPartnersQuery = z.infer<
  typeof districtHealthPartnersQuerySchema
>;
