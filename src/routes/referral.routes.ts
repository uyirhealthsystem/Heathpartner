import { Router } from "express";
import { list } from "../controllers/referral.controller";
import { HP_ROLE, requireAuth } from "../middleware/auth";

// An HP's own referrals. Citizen referrals are no longer created here: the
// patient enters the HP's code at signup and userservice reports it, then
// reports the patient's ABHA linked (routes/internal.routes.ts). An HP can no
// longer claim a reward for someone by naming their user id.
const router = Router();

router.get("/", requireAuth(HP_ROLE), list);

export default router;
