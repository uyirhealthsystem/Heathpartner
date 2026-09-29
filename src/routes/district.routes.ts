import { Router } from "express";
import {
  addBlock,
  addDistrict,
  addVillage,
  blocks,
  districts,
  healthPartners,
  summary,
  villages,
} from "../controllers/district.controller";
import { ADMIN_ROLES, requireAuth } from "../middleware/auth";

const router = Router();

const anyUser = requireAuth();
const admin = requireAuth(...ADMIN_ROLES);

// Location master (read: any logged-in user, e.g. HP app dropdowns;
// write: admins only).
router.get("/", anyUser, districts);
router.post("/", admin, addDistrict);
router.get("/:districtId/blocks", anyUser, blocks);
router.post("/:districtId/blocks", admin, addBlock);
router.get("/:districtId/blocks/:blockId/villages", anyUser, villages);
router.post("/:districtId/blocks/:blockId/villages", admin, addVillage);

// District level Health Partner APIs (admins only).
router.get("/:districtId/health-partners", admin, healthPartners);
router.get("/:districtId/health-partners/summary", admin, summary);

export default router;
