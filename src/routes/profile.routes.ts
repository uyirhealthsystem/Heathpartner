import { Router } from "express";
import { get, update } from "../controllers/profile.controller";
import { HP_ROLE, requireAuth } from "../middleware/auth";

const router = Router();

const auth = requireAuth(HP_ROLE);

router.get("/", auth, get);
router.patch("/", auth, update);

export default router;
