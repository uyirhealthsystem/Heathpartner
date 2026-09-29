import { Router } from "express";
import {
  bank,
  history,
  summary,
  withdrawal,
  withdrawals,
} from "../controllers/payment.controller";
import { HP_ROLE, requireAuth } from "../middleware/auth";

const router = Router();

const auth = requireAuth(HP_ROLE);

router.get("/", auth, summary);
router.get("/history", auth, history);
router.post("/bank", auth, bank);
router.post("/withdraw", auth, withdrawal);
router.get("/withdrawals", auth, withdrawals);

export default router;
