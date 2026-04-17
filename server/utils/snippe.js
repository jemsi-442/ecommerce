import crypto from "crypto";
import ApiError from "./ApiError.js";

const SNIPPE_BASE_URL = String(process.env.SNIPPE_BASE_URL || "https://api.snippe.sh").replace(/\/$/, "");
const SNIPPE_API_VERSION = "2026-01-25";
const SNIPPE_MIN_AMOUNT_TZS = 500;

const isPlaceholder = (value = "") =>
  !value || String(value).startsWith("replace_with_") || String(value).includes("<");

const splitCustomerName = (name = "") => {
  const cleaned = String(name).trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { firstname: "Customer", lastname: "Order" };
  }

  const [firstname, ...rest] = cleaned.split(" ");
  return {
    firstname,
    lastname: rest.join(" ") || "Customer",
  };
};

export const isSnippeConfigured = () => !isPlaceholder(process.env.SNIPPE_API_KEY);

export const isSnippeWebhookConfigured = () =>
  isSnippeConfigured() && !isPlaceholder(process.env.SNIPPE_WEBHOOK_SECRET);

export const getSnippeWebhookUrl = (req) => {
  const configured = String(process.env.SNIPPE_WEBHOOK_URL || "").trim();
  if (configured) {
    return configured;
  }

  const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) {
    throw new ApiError(500, "Unable to determine webhook URL for Snippe");
  }

  return `${protocol}://${host}/api/payments/snippe/webhook`;
};

export const normalizeSnippePhoneNumber = (value = "") => {
  const digits = String(value).replace(/\D/g, "");

  if (digits.startsWith("255") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `255${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `255${digits}`;
  }

  throw new ApiError(400, "Phone number must be in 07XXXXXXXX or 255XXXXXXXXX format");
};

const parseSnippeResponse = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ApiError(502, "Invalid response received from Snippe", text);
  }
};

export const createSnippeMobilePayment = async ({
  amount,
  phoneNumber,
  customerName,
  customerEmail,
  webhookUrl,
  metadata = {},
  idempotencyKey,
}) => {
  if (!isSnippeConfigured()) {
    throw new ApiError(503, "Snippe API is not configured");
  }

  const roundedAmount = Math.round(Number(amount));
  if (!Number.isFinite(roundedAmount) || roundedAmount < SNIPPE_MIN_AMOUNT_TZS) {
    throw new ApiError(400, `Snippe mobile payments require at least TZS ${SNIPPE_MIN_AMOUNT_TZS}`);
  }

  const customer = splitCustomerName(customerName);
  const response = await fetch(`${SNIPPE_BASE_URL}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SNIPPE_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": String(idempotencyKey || "").slice(0, 30),
    },
    body: JSON.stringify({
      payment_type: "mobile",
      details: {
        amount: roundedAmount,
        currency: "TZS",
      },
      phone_number: normalizeSnippePhoneNumber(phoneNumber),
      customer: {
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customerEmail,
      },
      webhook_url: webhookUrl,
      metadata,
    }),
  });

  const payload = await parseSnippeResponse(response);
  if (!response.ok || payload?.status === "error") {
    if (
      payload?.error_code === "PAY_001" &&
      payload?.message === "failed to initiate payment"
    ) {
      throw new ApiError(
        400,
        "Snippe could not start the mobile money prompt. Confirm the phone number is active for mobile money and try again.",
        payload
      );
    }

    throw new ApiError(
      Number(payload?.code || response.status || 502),
      payload?.message || "Failed to create Snippe payment",
      payload
    );
  }

  return payload?.data || payload;
};

export const getSnippePaymentStatus = async (reference) => {
  if (!isSnippeConfigured()) {
    throw new ApiError(503, "Snippe API is not configured");
  }

  const response = await fetch(`${SNIPPE_BASE_URL}/v1/payments/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${process.env.SNIPPE_API_KEY}`,
    },
  });

  const payload = await parseSnippeResponse(response);
  if (!response.ok || payload?.status === "error") {
    throw new ApiError(
      Number(payload?.code || response.status || 502),
      payload?.message || "Failed to fetch Snippe payment status",
      payload
    );
  }

  return payload?.data || payload;
};

export const triggerSnippePaymentPush = async (reference) => {
  if (!isSnippeConfigured()) {
    throw new ApiError(503, "Snippe API is not configured");
  }

  const response = await fetch(
    `${SNIPPE_BASE_URL}/v1/payments/${encodeURIComponent(reference)}/push`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SNIPPE_API_KEY}`,
      },
    }
  );

  const payload = await parseSnippeResponse(response);
  if (!response.ok || payload?.status === "error") {
    throw new ApiError(
      Number(payload?.code || response.status || 502),
      payload?.message || "Failed to retry Snippe mobile money push",
      payload
    );
  }

  return payload?.data || payload;
};

export const verifySnippeWebhook = (rawBody, headers = {}) => {
  if (!isSnippeWebhookConfigured()) {
    throw new ApiError(503, "Snippe webhook secret is not configured");
  }

  const timestamp = headers["x-webhook-timestamp"];
  const signature = headers["x-webhook-signature"];

  if (!timestamp || !signature) {
    throw new ApiError(400, "Missing Snippe webhook signature headers");
  }

  const eventTime = Number(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(eventTime) || Math.abs(currentTime - eventTime) > 300) {
    throw new ApiError(400, "Snippe webhook timestamp is invalid or too old");
  }

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
  const message = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.SNIPPE_WEBHOOK_SECRET)
    .update(message)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    throw new ApiError(400, "Invalid Snippe webhook signature");
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expectedSignature, "utf8")
  );

  if (!isValid) {
    throw new ApiError(400, "Invalid Snippe webhook signature");
  }

  return JSON.parse(payload);
};

export const getSnippeApiVersion = () => SNIPPE_API_VERSION;
