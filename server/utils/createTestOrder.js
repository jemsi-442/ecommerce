import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { Order, OrderItem, Product, User } from "../models/index.js";
import { assignRider, getOrderVendorRiderScope } from "./assignRider.js";

dotenv.config();

const ensureTestCustomer = async () => {
  const email = process.env.TEST_CUSTOMER_EMAIL || "customer@ramla.com";
  const password = process.env.TEST_CUSTOMER_PASSWORD || "Jay442tx";
  const name = process.env.TEST_CUSTOMER_NAME || "Test Customer";

  let user = await User.findOne({ where: { email } });

  if (user) {
    user.name = name;
    user.password = password;
    user.role = "customer";
    user.active = true;
    await user.save();
    return user;
  }

  user = await User.create({
    name,
    email,
    password,
    role: "customer",
    active: true,
  });

  return user;
};

export const createTestOrder = async () => {
  const customer = await ensureTestCustomer();
  const product = await Product.findOne({ where: { status: "approved" }, order: [["id", "DESC"]] });

  if (!product) {
    throw new Error("No approved product found. Approve at least one product first.");
  }

  const qty = 1;
  const subtotal = Number(product.price) * qty;
  const deliveryFee = 3000;
  const totalAmount = subtotal + deliveryFee;

  const order = await Order.create({
    userId: customer.id,
    totalAmount,
    deliveryType: "home",
    deliveryAddress: "Test Street, Dar es Salaam",
    deliveryContactPhone: "0712345678",
    status: "paid",
    isPaid: true,
    paidAt: new Date(),
    paymentMethod: "cash_on_delivery",
  });

  await OrderItem.create({
    orderId: order.id,
    productId: product.id,
    quantity: qty,
    price: Number(product.price),
  });

  const vendorId = await getOrderVendorRiderScope(order.id);
  const riderId = await assignRider({ vendorId });

  if (riderId) {
    order.riderId = riderId;
    order.assignedAt = new Date();
    order.status = "out_for_delivery";
    await order.save();
  }

  return {
    orderId: order.id,
    customerEmail: customer.email,
    riderAssigned: Boolean(riderId),
    riderId,
    productId: product.id,
  };
};

const run = async () => {
  try {
    await connectDB();
    const result = await createTestOrder();
    console.log(`Test order created: #${result.orderId}`);
    console.log(`Customer: ${result.customerEmail}`);
    console.log(`Product ID: ${result.productId}`);
    console.log(
      result.riderAssigned
        ? `Assigned to rider ID: ${result.riderId}`
        : "No available rider found. Order remained paid without rider assignment."
    );
    process.exit(0);
  } catch (error) {
    console.error("Error creating test order:", error);
    process.exit(1);
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
