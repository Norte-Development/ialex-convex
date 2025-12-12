import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useMarketingPopup() {
  const active = useQuery(api.functions.popups.getActivePopupForUser, {});
  const recordImpression = useMutation(
    api.functions.popups.recordPopupImpression,
  );
  const dismiss = useMutation(api.functions.popups.dismissPopup);

  return {
    active,
    recordImpression,
    dismiss,
  };
}
