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
    phone: user.phone || null,
    createdAt: user.createdAt || user.created_at || null,
  };

  if (out.role === "user") {
    out.role = "customer";
  }

  out.savedProductIds = Array.isArray(user.savedProductIds)
    ? user.savedProductIds.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0)
    : [];

  out.favoriteStoreSlugs = Array.isArray(user.favoriteStoreSlugs)
    ? user.favoriteStoreSlugs.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean)
    : [];

  if (!includePassword) {
    delete out.password;
  }

  return out;
};

export const serializeProduct = (row) => {
  const product = toPlain(row);
  if (!product) return null;

  const imageUrl = product.image || null;
  const creator = product.creator
    ? {
        _id: product.creator.id,
        id: product.creator.id,
        name: product.creator.name,
        role: product.creator.role === "user" ? "customer" : product.creator.role,
        storeName: product.creator.storeName || null,
        storeSlug: product.creator.storeSlug || null,
      }
    : null;

  const reviewer = product.reviewer
    ? {
        _id: product.reviewer.id,
        id: product.reviewer.id,
        name: product.reviewer.name,
        role: product.reviewer.role === "user" ? "customer" : product.reviewer.role,
      }
    : null;

  return {
    ...product,
    _id: product.id,
    price: Number(product.price),
    imageUrl,
    images: imageUrl ? [{ url: imageUrl, publicId: null }] : [],
    reviewNotes: product.reviewNotes || product.review_notes || null,
    reviewedAt: product.reviewedAt || product.reviewed_at || null,
    reviewedBy: product.reviewedBy || product.reviewed_by || reviewer?.id || null,
    vendor: creator,
    reviewer,
  };
};

export const serializeOrder = (row) => {
  const order = toPlain(row);
  if (!order) return null;

  const user = order.user
    ? {
        ...order.user,
        role: order.user.role === "user" ? "customer" : order.user.role,
        _id: order.user.id,
        phone: order.user.phone || null,
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
        const vendor = item.product?.creator
          ? {
              _id: item.product.creator.id,
              id: item.product.creator.id,
              name: item.product.creator.name,
              storeName: item.product.creator.storeName || null,
              storeSlug: item.product.creator.storeSlug || null,
              businessPhone: item.product.creator.businessPhone || null,
            }
          : null;

        return {
          _id: item.id,
          product: productId,
          name: productName,
          qty,
          price: Number(item.price || 0),
          image: item.product?.image || null,
          vendor,
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
      proofRecipient: order.deliveryProofRecipient || order.delivery_proof_recipient || null,
      proofNote: order.deliveryProofNote || order.delivery_proof_note || null,
      issueReportedAt: order.deliveryIssueReportedAt || order.delivery_issue_reported_at || null,
      issueReason: order.deliveryIssueReason || order.delivery_issue_reason || null,
      issueStatus: order.deliveryIssueStatus || order.delivery_issue_status || null,
      issueResolvedAt: order.deliveryIssueResolvedAt || order.delivery_issue_resolved_at || null,
      issueResolutionNote:
        order.deliveryIssueResolutionNote || order.delivery_issue_resolution_note || null,
    },
    payment: {
      method: order.paymentMethod || "mobile_money",
      provider: order.paymentProvider || null,
      reference: order.paymentReference || null,
      status: order.paymentStatus || (order.isPaid ? "completed" : null),
      expiresAt: order.paymentExpiresAt || null,
      failedAt: order.paymentFailedAt || null,
      failureReason: order.paymentFailureReason || null,
      isPaid: Boolean(order.isPaid),
      paidAt: order.paidAt || null,
    },
  };
};
