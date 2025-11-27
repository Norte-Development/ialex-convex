export const BLACK_FRIDAY_CONFIG = {
  // Master switch to enable/disable the feature
  isEnabled: true,
  
  // Promo window: Friday Nov 28 2025 to Friday Dec 5 2025
  startDate: new Date("2025-11-27T00:00:00"),
  endDate: new Date("2025-12-05T23:59:59"),
  
  // Coupon ID from Stripe dashboard
  couponId: "7bl3s6eL", // TODO: Update with actual Stripe Coupon ID
  
  // Storage keys for persistence
  storageKeys: {
    lastShown: "ialex-bf-2025-last-shown",
    impressions: "ialex-bf-2025-impressions",
    dismissed: "ialex-bf-2025-dismissed"
  },
  
  // Max times to show the popup total (optional cap)
  maxImpressions: 5
};

