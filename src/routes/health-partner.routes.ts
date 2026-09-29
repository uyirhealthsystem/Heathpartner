import { Router } from "express";
import {
  create,
  dashboard,
  update,
} from "../controllers/health-partner.controller";
import { HP_ROLE, requireAuth } from "../middleware/auth";

const router = Router();

const auth = requireAuth(HP_ROLE);

router.post("/", auth, create);
router.get("/dashboard", auth, dashboard);
router.patch("/me", auth, update);

export default router;
