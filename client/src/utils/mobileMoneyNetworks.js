export const MOBILE_NETWORK_PREFIXES = {
  mpesa: ["074", "075", "076"],
  airtel_money: ["068", "069", "078"],
  mixx_by_yas: ["065", "067", "071", "077"],
  halopesa: ["061", "062"],
};

export const MOBILE_NETWORK_LABELS = {
  mpesa: "M-Pesa",
  airtel_money: "Airtel Money",
  mixx_by_yas: "Mixx by Yas",
  halopesa: "HaloPesa",
};

export const getMobileNetworkLabel = (network) =>
  MOBILE_NETWORK_LABELS[String(network || "").trim().toLowerCase()] || "Selected network";

export const getMobileNetworkPrefixes = (network) =>
  MOBILE_NETWORK_PREFIXES[String(network || "").trim().toLowerCase()] || [];

export const detectMobileNetworkFromPhone = (phoneNumber) => {
  const normalizedPhone = normalizeTanzaniaPhoneNumber(phoneNumber);

  if (!normalizedPhone) {
    return null;
  }

  const localPrefix = `0${normalizedPhone.slice(3, 5)}`;

  return (
    Object.entries(MOBILE_NETWORK_PREFIXES).find(([, prefixes]) =>
      prefixes.includes(localPrefix)
    )?.[0] || null
  );
};

export const normalizeTanzaniaPhoneNumber = (value = "") => {
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

  return null;
};

export const validatePhoneForNetwork = (phoneNumber, network) => {
  const normalizedPhone = normalizeTanzaniaPhoneNumber(phoneNumber);
  const prefixes = MOBILE_NETWORK_PREFIXES[String(network || "").trim().toLowerCase()] || [];
  const label = MOBILE_NETWORK_LABELS[String(network || "").trim().toLowerCase()] || "Selected network";
  const detectedNetwork = detectMobileNetworkFromPhone(phoneNumber);
  const detectedLabel = detectedNetwork ? getMobileNetworkLabel(detectedNetwork) : null;

  if (!normalizedPhone) {
    return {
      valid: false,
      message: "Phone number must be in 07XXXXXXXX or 255XXXXXXXXX format",
    };
  }

  if (!prefixes.length) {
    return {
      valid: false,
      message: "Choose a supported mobile money network first",
    };
  }

  const localPrefix = `0${normalizedPhone.slice(3, 5)}`;

  if (!prefixes.includes(localPrefix)) {
    return {
      valid: false,
      message: detectedLabel
        ? `${label} inahitaji namba inayoanza na ${prefixes.join(", ")}. Namba hii inaonekana kuwa ya ${detectedLabel}.`
        : `${label} inahitaji namba inayoanza na ${prefixes.join(", ")}`,
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
