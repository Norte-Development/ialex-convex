"use client"

import { useAction } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { NormativeDetails } from "./NormativeDetails"
import { FalloDetails } from "./FalloDetails"
import type { CombinedDocument, ContentType } from "../../../types/legislation"

interface DocumentDetailsProps {
  jurisdiction: string
  id: string
  contentType: ContentType
}

// Type guard to determine if a document is a fallo
function isFalloDoc(doc: CombinedDocument): doc is import("../../../types/fallos").FalloDoc {
  return 'tribunal' in doc && 'actor' in doc && 'demandado' in doc;
}

export function DocumentDetails({ jurisdiction, id, contentType }: DocumentDetailsProps) {
  const getNormativeAction = useAction(api.functions.legislation.getNormativeById);
  const getFalloAction = useAction(api.functions.fallos.getFallo);

  // For now, we'll determine the type based on contentType
  // In the future, we could make this more dynamic by checking the document first
  if (contentType === "fallos") {
    return (
      <FalloDetails
        jurisdiction={jurisdiction}
        id={id}
        getFalloAction={getFalloAction}
      />
    );
  }

  // Default to legislation for "legislation" and "all" content types
  return (
    <NormativeDetails
      jurisdiction={jurisdiction}
      id={id}
      getNormativeAction={getNormativeAction}
    />
  );
}
