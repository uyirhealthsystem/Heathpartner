import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(150),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
  email: z.string().trim().email().max(150).optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must be YYYY-MM-DD")
    .optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  addressLine1: z.string().trim().max(255).optional(),
  addressLine2: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, "Invalid pincode").optional(),
  profilePhotoUrl: z.string().trim().url().max(500).optional(),
});

const id = z.string().trim().min(1).max(100);

// Location is District -> Block -> Village. Block and village are optional,
// but a village needs its block.
export const createHealthPartnerSchema = profileSchema
  .extend({
    districtId: id,
    blockId: id.optional(),
    villageId: id.optional(),
    referralCode: z.string().trim().min(1).max(30).optional(),
  })
  .refine((data) => !data.villageId || data.blockId, {
    message: "blockId is required when villageId is given",
    path: ["blockId"],
  });

// Location is updated as a group: send districtId with the (optional)
// blockId / villageId. Omitted block / village are cleared.
export const updateProfileSchema = profileSchema
  .partial()
  .extend({
    districtId: id.optional(),
    blockId: id.nullable().optional(),
    villageId: id.nullable().optional(),
  })
  .refine(
    (data) =>
      data.districtId !== undefined ||
      (data.blockId === undefined && data.villageId === undefined),
    {
      message: "districtId is required when changing blockId or villageId",
      path: ["districtId"],
    }
  )
  .refine((data) => !data.villageId || data.blockId, {
    message: "blockId is required when villageId is given",
    path: ["blockId"],
  });

export const updateHealthPartnerSchema = z.object({
  referralCode: z.string().trim().min(1).max(30).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type ProfileFields = z.infer<typeof profileSchema>;
export type CreateHealthPartnerInput = z.infer<typeof createHealthPartnerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
