import { Op } from "sequelize";
import Rider from "../models/Rider.js";
import Order from "../models/Order.js";

export const assignRider = async () => {
  const riders = await Rider.findAll({
    where: {
      available: true,
      isActive: true,
    },
  });

  if (!riders.length) {
    console.warn("No available riders");
    return null;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const riderLoads = await Promise.all(
    riders.map(async (rider) => {
      const activeOrders = await Order.count({
        where: {
          riderId: rider.id,
          status: "out_for_delivery",
          createdAt: { [Op.gte]: todayStart },
        },
      });

      return {
        rider,
        load: activeOrders,
      };
    })
  );

  riderLoads.sort((a, b) => a.load - b.load);

  const selectedRider = riderLoads[0].rider;

  selectedRider.available = false;
  selectedRider.lastAssignedAt = new Date();
  await selectedRider.save();

  console.log(`Rider assigned: ${selectedRider.name} | Load: ${riderLoads[0].load}`);

  return selectedRider.id;
};
