export type PopupAudience = "all" | "free" | "trial" | "free_or_trial";

export type PopupFormState = {
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  audience: PopupAudience;
  startAtLocal: string;
  endAtLocal: string;
  showAfterDays: string;
  frequencyDays: string;
  maxImpressions: string;
  priority: string;
};

export const emptyPopupForm: PopupFormState = {
  key: "",
  title: "",
  body: "",
  enabled: true,
  audience: "all",
  startAtLocal: "",
  endAtLocal: "",
  showAfterDays: "",
  frequencyDays: "",
  maxImpressions: "",
  priority: "",
};
