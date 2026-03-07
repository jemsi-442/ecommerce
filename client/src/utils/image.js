const PLACEHOLDER = "/images/placeholder-bag.svg";
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/api\/?$/, "");

const candidateKeys = [
  "url",
  "secure_url",
  "src",
  "image",
  "imageUrl",
  "path",
];

const toCleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

export const resolveImageUrl = (value, fallback = PLACEHOLDER) => {
  if (!value) return fallback;

  if (typeof value === "string") {
    const url = toCleanString(value);
    if (!url) return fallback;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
      return url;
    }
    if (url.startsWith("/")) {
      return `${API_ORIGIN}${url}`;
    }
    return url;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveImageUrl(item, "");
      if (resolved) return resolved;
    }
    return fallback;
  }

  if (typeof value === "object") {
    for (const key of candidateKeys) {
      const raw = toCleanString(value[key]);
      if (raw) return resolveImageUrl(raw, "");
    }
  }

  return fallback;
};

export const PLACEHOLDER_IMAGE = PLACEHOLDER;
