import { Op } from "sequelize";
import AuditLog from "../models/AuditLog.js";

export const getAuditLogs = async (req, res) => {
  const { status, rider, date } = req.query;

  const where = {};

  if (status) where.action = status;
  if (rider) where.riderId = rider;

  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    where.createdAt = { [Op.gte]: start, [Op.lte]: end };
  }

  const logs = await AuditLog.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: 200,
  });

  res.json(logs);
};
