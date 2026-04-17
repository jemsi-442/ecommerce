const PAYMENT_NETWORK_ASSET_BASE = "/payment-networks";

const PAYMENT_NETWORK_FILE_CANDIDATES = {
  mpesa: ["mpesa.svg", "mpesa.png", "mpesa.webp"],
  airtel_money: ["airtel-money.svg", "airtel-money.png", "airtel-money.webp"],
  mixx_by_yas: ["mixx-by-yas.svg", "mixx-by-yas.png", "mixx-by-yas.webp"],
  halopesa: ["halopesa.svg", "halopesa.png", "halopesa.webp"],
  snippe: ["snippe.svg", "snippe.png", "snippe.webp"],
};

const PROVIDER_ALIASES = {
  mpesa: "mpesa",
  "m-pesa": "mpesa",
  "m pesa": "mpesa",
  vodacom: "mpesa",
  airtel: "airtel_money",
  airtelmoney: "airtel_money",
  "airtel-money": "airtel_money",
  "airtel money": "airtel_money",
  mixx: "mixx_by_yas",
  yas: "mixx_by_yas",
  "mixx-by-yas": "mixx_by_yas",
  "mixx by yas": "mixx_by_yas",
  halotel: "halopesa",
  "halo pesa": "halopesa",
  halopesa: "halopesa",
  snippe: "snippe",
};

const normalizeProviderKey = (value = "") => {
  const normalized = String(value).trim().toLowerCase().replace(/[_-]+/g, " ");
  return PROVIDER_ALIASES[normalized] || normalized.replace(/\s+/g, "_");
};

export const normalizePaymentNetworkProvider = (value = "") => normalizeProviderKey(value);

export const getPaymentNetworkLogoCandidates = (provider) => {
  const providerKey = normalizeProviderKey(provider);
  const filenames = PAYMENT_NETWORK_FILE_CANDIDATES[providerKey] || [];

  return filenames.map((filename) => `${PAYMENT_NETWORK_ASSET_BASE}/${filename}`);
};

export const getPaymentNetworkLabel = (provider = "") => {
  const providerKey = normalizeProviderKey(provider);

  switch (providerKey) {
    case "mpesa":
      return "M-Pesa";
    case "airtel_money":
      return "Airtel Money";
    case "mixx_by_yas":
      return "Mixx by Yas";
    case "halopesa":
      return "HaloPesa";
    case "snippe":
      return "Snippe";
    default:
      return String(provider || "").replaceAll("_", " ");
  }
};

export const MOBILE_PAYMENT_NETWORK_OPTIONS = [
  {
    value: "mpesa",
    label: "M-Pesa",
    description: "Vodacom Tanzania",
  },
  {
    value: "airtel_money",
    label: "Airtel Money",
    description: "Airtel Tanzania",
  },
  {
    value: "mixx_by_yas",
    label: "Mixx by Yas",
    description: "Yas Tanzania",
  },
  {
    value: "halopesa",
    label: "HaloPesa",
    description: "Halotel Tanzania",
  },
];
