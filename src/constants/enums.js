export const Roles = Object.freeze({
  USER: "user",
  PROVIDER: "provider",
  ADMIN: "admin"
});

export const ProviderModerationStatus = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended"
});

export const CategoryBehavior = Object.freeze({
  GENERAL: "general",
  HOTEL: "hotel",
  DOCTOR: "doctor",
  ONLINE_SHOP: "online_shop",
  RESTAURANT: "restaurant",
  REAL_ESTATE: "real_estate",
  EVENT_VENDOR: "event_vendor",
  SCHOOL: "school",
  AUTO: "auto",
  BEAUTY: "beauty",
  LEGAL: "legal",
  FITNESS: "fitness"
});

export const CategoryViewType = Object.freeze({
  DIRECTORY: "directory",
  PROFESSIONAL: "professional",
  HOTEL: "hotel",
  ECOMMERCE: "ecommerce",
  RESTAURANT: "restaurant",
  REAL_ESTATE: "real_estate",
  SCHOOL: "school",
  EVENT_VENDOR: "event_vendor",
  PORTFOLIO: "portfolio",
  BOOKING: "booking"
});

export const ServiceProductType = Object.freeze({
  SERVICE: "service",
  PRODUCT: "product"
});

export const ServiceProductStatus = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended"
});

export const TransactionType = Object.freeze({
  SUBSCRIPTION: "subscription",
  CONTACT_UNLOCK: "contact_unlock",
  PURCHASE: "purchase",
  WITHDRAWAL: "withdrawal"
});

export const TransactionStatus = Object.freeze({
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled",
  REFUNDED: "refunded"
});
