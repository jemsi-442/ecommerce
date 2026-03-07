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

  const imageUrl = product.image || null;

  return {
    ...product,
    _id: product.id,
    price: Number(product.price),
    imageUrl,
    images: imageUrl ? [{ url: imageUrl, publicId: null }] : [],
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

  const items = Array.isArray(order.items)
    ? order.items.map((item) => {
        const qty = Number(item.quantity || item.qty || 0);
        const productId = item.product?.id ?? item.productId ?? item.product;
        const productName = item.product?.name || item.name || null;

        return {
          _id: item.id,
          product: productId,
          name: productName,
          qty,
          price: Number(item.price || 0),
        };
      })
    : [];

  return {
    ...order,
    _id: order.id,
    createdAt: order.createdAt || order.created_at || null,
    user: user || order.userId,
    items,
    totalAmount: Number(order.totalAmount),
    delivery: {
      type: order.deliveryType || "home",
      address: order.deliveryAddress,
      contactPhone: order.deliveryContactPhone,
      rider: rider || order.riderId,
      assignedAt: order.assignedAt,
      acceptedAt: order.acceptedAt,
      completedAt: order.completedAt,
    },
  };
};
