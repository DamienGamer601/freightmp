import { Router } from "express";
import { getTelemetrySnapshot, submitTelemetry } from "../websocket/server";

const router = Router();

// Snapshot de la télémétrie courante (camions actifs).
router.get("/", (_req, res) => {
  res.json(getTelemetrySnapshot());
});

/**
 * Réception de télémétrie depuis un client (jeu ETS2/ATS ou simulateur).
 * Le client envoie un payload `{ truckId, game, x, z, speedKmh, heading, fuelLiters }`.
 */
router.post("/", (req, res) => {
  const record = submitTelemetry(req.body);
  res.json({ ok: true, truckId: record.truckId });
});

export default router;
