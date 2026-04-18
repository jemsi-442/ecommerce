import { Op } from "sequelize";
import Rider from "../models/Rider.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import Product from "../models/Product.js";

const getAvailableRiders = async (vendorId = null) => {
  if (vendorId) {
    const vendorRiders = await Rider.findAll({
      where: {
        vendorId,
        available: true,
        isActive: true,
      },
    });

    if (vendorRiders.length) {
      return vendorRiders;
    }
  }

  return Rider.findAll({
    where: {
      vendorId: null,
      available: true,
      isActive: true,
    },
  });
};

export const getOrderVendorRiderScope = async (orderId) => {
  const items = await OrderItem.findAll({
    where: { orderId },
    include: [
      {
        model: Product,
        as: "product",
        attributes: ["createdBy"],
        required: false,
      },
    ],
  });

  const vendorIds = [...new Set(items.map((item) => Number(item.product?.createdBy)).filter(Boolean))];
  return vendorIds.length === 1 ? vendorIds[0] : null;
};

export const assignRider = async ({ vendorId = null } = {}) => {
  const riders = await getAvailableRiders(vendorId);

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
          created_at: { [Op.gte]: todayStart },
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
