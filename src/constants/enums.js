export const Roles = Object.freeze({
  USER: "user",
  PROVIDER: "provider",
  ADMIN: "admin",
  DRIVER: "driver"
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
  WITHDRAWAL: "withdrawal",
  PLATFORM_WITHDRAWAL: "platform_withdrawal",
  CART_PURCHASE: "cart_purchase",
  RIDE_TRIP: "ride_trip"
});

export const TransactionStatus = Object.freeze({
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "canceled",
  REFUNDED: "refunded"
});

export const RideVehicleType = Object.freeze({
  BODA: "boda",
  CAR: "car"
});

export const RideTripStatus = Object.freeze({
  SEARCHING: "searching",
  MATCHED: "matched",
  ARRIVED: "arrived",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED_BY_RIDER: "cancelled_by_rider",
  CANCELLED_BY_DRIVER: "cancelled_by_driver",
  NO_DRIVERS_FOUND: "no_drivers_found"
});

export const RideDriverModerationStatus = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended"
});

export const RidePaymentMethod = Object.freeze({
  CASH: "cash",
  MOBILE_MONEY: "mobile_money"
});
