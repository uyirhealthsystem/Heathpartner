import { Router } from "express";
import {
  create,
  list,
} from "../controllers/referral.controller";
import { HP_ROLE, requireAuth } from "../middleware/auth";

const router = Router();

const auth = requireAuth(HP_ROLE);

router.post("/", auth, create);
router.get("/", auth, list);

export default router;
