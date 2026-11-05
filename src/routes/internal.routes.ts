import { Router } from "express";
import { cancel, checkCode, complete, register } from "../controllers/internal-referral.controller";

// Service-to-service API, called by userservice for citizen referrals.
// Mounted at /internal/v1, which the API Gateway never forwards (it maps only
// /api/v1/hp/* to this service's /api/v1/*). Like every internal API on the
// platform there is no token: only the private network keeps outsiders out,
// so this port must stay closed to the internet.
const router = Router();

router.get("/referral-codes/:code", checkCode);
router.post("/referrals", register);
router.post("/referrals/complete", complete);
router.post("/referrals/cancel", cancel);

export default router;
