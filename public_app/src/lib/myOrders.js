export const ORDER_STATUS = {
  // Labels are shown via t(`orders.status.${key}`).
  pending: { tone: "amber", step: 0 },
  accepted: { tone: "blue", step: 1 },
  delivering: { tone: "blue", step: 2 },
  fulfilled: { tone: "green", step: 3 },
  rejected: { tone: "red", step: -1 },
  canceled: { tone: "red", step: -1 }
};
