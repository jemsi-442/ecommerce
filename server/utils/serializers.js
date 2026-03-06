export const toPlain = (row) => {
  if (!row) return null;
  return typeof row.toJSON === "function" ? row.toJSON() : row;
};

export const serializeUser = (row, { includePassword = false } = {}) => {
  const user = toPlain(row);
  if (!user) return null;

  const out = {
    ...user,
    _id: user.id,
  };

  if (!includePassword) {
    delete out.password;
  }

  return out;
};

export const serializeProduct = (row) => {
  const product = toPlain(row);
  if (!product) return null;

  return {
    ...product,
    _id: product.id,
    price: Number(product.price),
    images: Array.isArray(product.images) ? product.images : [],
  };
};

export const serializeOrder = (row) => {
  const order = toPlain(row);
  if (!order) return null;

  const user = order.user
    ? {
        ...order.user,
        _id: order.user.id,
      }
    : undefined;

  const rider = order.rider
    ? {
        ...order.rider,
        _id: order.rider.id,
      }
    : undefined;

  return {
    ...order,
    _id: order.id,
    user: user || order.userId,
    items: Array.isArray(order.items) ? order.items : [],
    totalAmount: Number(order.totalAmount),
    delivery: {
      type: order.deliveryType,
      address: order.deliveryAddress,
      contactPhone: order.deliveryContactPhone,
      rider: rider || order.riderId,
      assignedAt: order.assignedAt,
      acceptedAt: order.acceptedAt,
      completedAt: order.completedAt,
    },
  };
};
