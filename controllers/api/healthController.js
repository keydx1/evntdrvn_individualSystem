import { sequelize } from "../../models/index.js";
import { nowIso } from "../../utils/apiFormat.js";

export const health = async (req, res) => {
  try {
    await sequelize.authenticate();
    return res.json({
      data: {
        status: "ok",
        database: "up",
        version: "1.0.0",
        server_time: nowIso(),
      },
      meta: { request_id: req.id ?? null },
    });
  } catch {
    return res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "AquaPiol is running but the database is not reachable.",
        details: null,
        request_id: req.id ?? null,
      },
    });
  }
};
