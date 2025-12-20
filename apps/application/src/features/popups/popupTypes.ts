export type PopupAudience =
  | "all"
  | "free"
  | "trial"
  | "free_or_trial"
  | "premium";

export type PopupTemplate = "simple" | "promo";

export type PopupActionType = "link" | "billing";
export type PopupBillingMode =
  | "plans"
  | "checkout_individual"
  | "checkout_team";

export type PopupActionFormState = {
  type: PopupActionType;
  label: string;
  url?: string;
  newTab?: boolean;
  billingMode?: PopupBillingMode;
};

export type PopupFormState = {
  key: string;
  title: string;
  subtitle: string;
  upperBody: string;
  body: string;
  enabled: boolean;
  template: PopupTemplate;
  audience: PopupAudience;
  badgeText: string;
  actions: PopupActionFormState[];
  startAtLocal: string;
  endAtLocal: string;
  showAfterDays: string;
  frequencyDays: string;
  maxImpressions: string;
  priority: string;
  // Image fields
  imageFile: File | null;
  imagePreviewUrl: string;
  existingImageBucket?: string;
  existingImageObject?: string;
};

export const emptyPopupForm: PopupFormState = {
  key: "",
  title: "",
  subtitle: "",
  upperBody: "",
  body: "",
  enabled: true,
  template: "simple",
  audience: "all",
  badgeText: "",
  actions: [],
  startAtLocal: "",
  endAtLocal: "",
  showAfterDays: "",
  frequencyDays: "",
  maxImpressions: "",
  priority: "",
  imageFile: null,
  imagePreviewUrl: "",
};
