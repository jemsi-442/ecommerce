import { normalizeSnippePhoneNumber } from "./snippe.js";

const NETWORK_PREFIXES = {
  mpesa: ["074", "075", "076"],
  airtel_money: ["068", "069", "078"],
  mixx_by_yas: ["065", "067", "071", "077"],
  halopesa: ["061", "062"],
};

const NETWORK_LABELS = {
  mpesa: "M-Pesa",
  airtel_money: "Airtel Money",
  mixx_by_yas: "Mixx by Yas",
  halopesa: "HaloPesa",
};

export const getSupportedMobileNetworkPrefixes = (network) =>
  NETWORK_PREFIXES[String(network || "").trim().toLowerCase()] || [];

export const getSupportedMobileNetworkLabel = (network) =>
  NETWORK_LABELS[String(network || "").trim().toLowerCase()] || "Selected network";

export const detectMobileNetworkFromPhone = (phoneNumber) => {
  const normalizedPhone = normalizeSnippePhoneNumber(phoneNumber);
  const localPrefix = `0${normalizedPhone.slice(3, 5)}`;

  return (
    Object.entries(NETWORK_PREFIXES).find(([, prefixes]) =>
      prefixes.includes(localPrefix)
    )?.[0] || null
  );
};

export const validatePhoneForSelectedNetwork = (phoneNumber, network) => {
  const prefixes = getSupportedMobileNetworkPrefixes(network);
  const label = getSupportedMobileNetworkLabel(network);

  if (!prefixes.length) {
    return {
      valid: false,
      message: "Choose a supported mobile money network before placing the order",
    };
  }

  const normalizedPhone = normalizeSnippePhoneNumber(phoneNumber);
  const localPrefix = `0${normalizedPhone.slice(3, 5)}`;
  const detectedNetwork = detectMobileNetworkFromPhone(phoneNumber);
  const detectedLabel = detectedNetwork ? getSupportedMobileNetworkLabel(detectedNetwork) : null;

  if (!prefixes.includes(localPrefix)) {
    return {
      valid: false,
      message: detectedLabel
        ? `${label} requires a phone number starting with ${prefixes.join(", ")}. This number looks like ${detectedLabel}.`
        : `${label} requires a phone number starting with ${prefixes.join(", ")}`,
      normalizedPhone,
      localPrefix,
      detectedNetwork,
      detectedLabel,
    };
  }

  return {
    valid: true,
    normalizedPhone,
    localPrefix,
    detectedNetwork,
    detectedLabel,
  };
};
