export const getOrderStatusTone = (status) => {
  switch (status) {
    case "pending":
      return "bg-slate-200 text-slate-800";
    case "paid":
      return "bg-slate-100 text-[#102A43]";
    case "out_for_delivery":
      return "bg-orange-100 text-orange-800";
    case "delivered":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "refunded":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export const getPayoutStatusTone = (status) => {
  switch (status) {
    case "awaiting_payment":
    case "pending":
      return "bg-orange-100 text-orange-700";
    case "processing":
      return "bg-slate-100 text-[#102A43]";
    case "ready_for_payout":
      return "bg-orange-100 text-orange-700";
    case "paid":
      return "bg-emerald-100 text-emerald-700";
    case "on_hold":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export const getPayoutStatusLabel = (status) => {
  switch (status) {
    case "awaiting_payment":
      return "Awaiting Payment";
    case "processing":
      return "Processing";
    case "ready_for_payout":
      return "Ready for Payout";
    case "on_hold":
      return "On Hold";
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    default:
      return "Processing";
  }
};

export const getProductReviewStatusTone = (status) => {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
};
