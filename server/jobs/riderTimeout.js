import { Op } from "sequelize";
import Order from "../models/Order.js";
import Rider from "../models/Rider.js";
import { assignRider } from "../utils/assignRider.js";

const SLA_MINUTES = 2;

export const riderAutoTimeout = async () => {
  try {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - SLA_MINUTES * 60 * 1000);

    const timedOutOrders = await Order.findAll({
      where: {
        status: "out_for_delivery",
        acceptedAt: null,
        assignedAt: { [Op.lte]: timeoutThreshold },
        riderId: { [Op.ne]: null },
      },
    });

    if (!timedOutOrders.length) return;

    console.log(`Rider timeout job: ${timedOutOrders.length} order(s)`);

    for (const order of timedOutOrders) {
      const oldRiderId = order.riderId;

      if (oldRiderId) {
        await Rider.update({ available: true }, { where: { id: oldRiderId } });
      }

      const newRiderId = await assignRider();

      if (!newRiderId) {
        console.warn(`No rider available for order ${order.id}`);
        continue;
      }

      order.riderId = newRiderId;
      order.assignedAt = new Date();
      order.acceptedAt = null;

      await order.save();

      console.log(`Order ${order.id} reassigned to rider ${newRiderId}`);
    }
  } catch (error) {
    console.error("riderAutoTimeout error:", error.message);
  }
};
