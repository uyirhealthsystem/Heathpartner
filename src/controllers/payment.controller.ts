import { Request, Response } from "express";
import { bankAccountSchema, withdrawSchema } from "../schemas/payment.schema";
import {
  getPaymentHistory,
  getPaymentSummary,
  getWithdrawals,
  saveBankAccount,
  withdraw,
} from "../services/payment.service";

export async function summary(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.json(await getPaymentSummary(userId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load payments";

    return res.status(400).json({ message });
  }
}

export async function history(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.json(await getPaymentHistory(userId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load payment history";

    return res.status(400).json({ message });
  }
}

export async function bank(req: Request, res: Response) {
  try {
    const body = bankAccountSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.json(await saveBankAccount(userId, body));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save bank account";

    return res.status(400).json({ message });
  }
}

export async function withdrawal(req: Request, res: Response) {
  try {
    const body = withdrawSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.status(201).json(await withdraw(userId, body.amount));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create withdrawal";

    return res.status(400).json({ message });
  }
}

export async function withdrawals(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    return res.json(await getWithdrawals(userId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load withdrawals";

    return res.status(400).json({ message });
  }
}
