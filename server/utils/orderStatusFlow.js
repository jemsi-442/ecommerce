export const ORDER_STATUS_FLOW = {
  pending: ["paid", "cancelled"],
  paid: ["out_for_delivery", "cancelled", "refunded"],
  out_for_delivery: ["delivered", "refunded", "cancelled"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export const canTransition = (current, next) => {
  return ORDER_STATUS_FLOW[current]?.includes(next);
};
