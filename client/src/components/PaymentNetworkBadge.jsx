import { useEffect, useState } from "react";
import { getPaymentNetworkLabel, getPaymentNetworkLogoCandidates } from "../utils/paymentNetworkLogo";

export default function PaymentNetworkBadge({ provider, className = "" }) {
  const [index, setIndex] = useState(0);
  const candidates = getPaymentNetworkLogoCandidates(provider);
  const label = getPaymentNetworkLabel(provider);
  const src = candidates[index];

  useEffect(() => {
    setIndex(0);
  }, [provider]);

  if (!provider) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`.trim()}>
      {src ? (
        <img
          src={src}
          alt={`${label} logo`}
          className="h-5 w-auto rounded-sm object-contain"
          onError={() => {
            if (index < candidates.length - 1) {
              setIndex((current) => current + 1);
            } else {
              setIndex(candidates.length);
            }
          }}
        />
      ) : null}
      <span>{label}</span>
    </div>
  );
}
