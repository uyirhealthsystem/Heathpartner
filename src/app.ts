import cors from "cors";
import express from "express";
import healthPartnerRoutes from "./routes/health-partner.routes";
import referralRoutes from "./routes/referral.routes";
import paymentRoutes from "./routes/payment.routes";
import profileRoutes from "./routes/profile.routes";
import districtRoutes from "./routes/district.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "health-partner-service",
  });
});

app.use("/api/v1/health-partners", healthPartnerRoutes);
app.use("/api/v1/referrals", referralRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/districts", districtRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.path,
  });
});

export default app;
