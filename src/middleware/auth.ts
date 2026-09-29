import { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

// Roles from Auth Service (see authservice src/lib/portals.ts).
export const HP_ROLE = "HP";
export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// The API Gateway verifies the token and injects the caller's identity as
// `x-user-id` / `x-user-role`. If `roles` are given, the role must be one of them.
export function requireAuth(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.header("x-user-id");
    const role = req.header("x-user-role");

    if (!userId || !role) {
      return res.status(401).json({
        message: "x-user-id and x-user-role headers are required",
      });
    }

    if (roles.length && !roles.includes(role)) {
      return res.status(403).json({
        message: "This endpoint requires a different role",
      });
    }

    req.user = {
      id: userId,
      role,
    };

    next();
  };
}
