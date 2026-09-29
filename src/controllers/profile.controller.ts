import { Request, Response } from "express";
import { updateProfileSchema } from "../schemas/health-partner.schema";
import { getProfile, updateProfile } from "../services/profile.service";

export async function get(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.json(await getProfile(userId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load profile";

    return res.status(400).json({ message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const body = updateProfileSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.json(await updateProfile(userId, body));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile";

    return res.status(400).json({ message });
  }
}
