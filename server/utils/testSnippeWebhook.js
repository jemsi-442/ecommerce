import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const webhookUrl =
  process.env.SNIPPE_WEBHOOK_URL || "http://127.0.0.1:5001/api/payments/snippe/webhook";
const webhookSecret = process.env.SNIPPE_WEBHOOK_SECRET;

if (!webhookSecret || webhookSecret.startsWith("replace_with_") || webhookSecret.includes("<")) {
  console.error("SNIPPE_WEBHOOK_SECRET is missing. Set it in server/.env first.");
  process.exit(1);
}

const orderId = Number(process.argv[2] || 1);
const amount = Number(process.argv[3] || 5000);
const paymentReference = process.argv[4] || `pi_local_${Date.now()}`;
const timestamp = Math.floor(Date.now() / 1000).toString();

const payload = JSON.stringify({
  id: `evt_local_${Date.now()}`,
  type: "payment.completed",
  api_version: "2026-01-25",
  created_at: new Date().toISOString(),
  data: {
    reference: paymentReference,
    external_reference: `LOCAL${Date.now()}`,
    status: "completed",
    amount: {
      value: amount,
      currency: "TZS",
    },
    settlement: {
      gross: { value: amount, currency: "TZS" },
      fees: { value: 0, currency: "TZS" },
      net: { value: amount, currency: "TZS" },
    },
    channel: {
      type: "mobile_money",
      provider: "airtel",
    },
    customer: {
      phone: "+255781000000",
      name: "Local Test Customer",
      email: "local@test.com",
    },
    metadata: {
      order_id: String(orderId),
    },
    completed_at: new Date().toISOString(),
  },
});

const signature = crypto
  .createHmac("sha256", webhookSecret)
  .update(`${timestamp}.${payload}`)
  .digest("hex");

const run = async () => {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Signature": signature,
      "X-Webhook-Event": "payment.completed",
      "User-Agent": "Snippe-Webhook/1.0",
    },
    body: payload,
  });

  const text = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(text || "<empty>");
};

run().catch((error) => {
  console.error("Failed to send test webhook:", error.message);
  process.exit(1);
});
