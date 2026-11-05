import { Request, Response } from "express";
import { ZodError } from "zod";
import {
  cancelReferralSchema,
  citizenReferralSchema,
  referralCodeSchema,
  referredUserIdSchema,
} from "../schemas/citizen-referral.schema";
import {
  ReferralError,
  cancelReferral,
  checkReferralCode,
  completeReferral,
  registerReferral,
} from "../services/citizen-referral.service";

// Unlike the app-facing controllers, failures keep their real status and a
// machine-readable code: userservice retries a 5xx (or no answer) and gives
// up on a 4xx, so a database outage must never look like a bad code.
function fail(res: Response, error: unknown) {
  if (error instanceof ReferralError) {
    return res.status(error.status).json({ code: error.code, message: error.message });
  }
  if (error instanceof ZodError) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid request", issues: error.issues });
  }
  console.error("internal referral request failed", error);
  return res.status(500).json({ code: "INTERNAL_ERROR", message: "Internal error" });
}

// GET /internal/v1/referral-codes/:code?referredUserId=...
export async function checkCode(req: Request, res: Response) {
  try {
    const code = referralCodeSchema.parse(req.params.code);
    const referredUserId = referredUserIdSchema.parse(req.query.referredUserId);
    return res.json(await checkReferralCode(code, referredUserId));
  } catch (error) {
    return fail(res, error);
  }
}

// POST /internal/v1/referrals
export async function register(req: Request, res: Response) {
  try {
    const body = citizenReferralSchema.parse(req.body);
    const { referral, created } = await registerReferral(body.referralCode, body.referredUserId);
    return res.status(created ? 201 : 200).json(referral);
  } catch (error) {
    return fail(res, error);
  }
}

// POST /internal/v1/referrals/complete
export async function complete(req: Request, res: Response) {
  try {
    const body = citizenReferralSchema.parse(req.body);
    return res.json(await completeReferral(body.referralCode, body.referredUserId));
  } catch (error) {
    return fail(res, error);
  }
}

// POST /internal/v1/referrals/cancel
export async function cancel(req: Request, res: Response) {
  try {
    const body = cancelReferralSchema.parse(req.body);
    return res.json(await cancelReferral(body.referredUserId));
  } catch (error) {
    return fail(res, error);
  }
}
