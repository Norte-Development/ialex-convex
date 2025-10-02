import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { generateJSON } from '@tiptap/html'
import { extensions } from "./extensions";

export function useTemplate({ templateId }: { templateId: Id<"modelos"> }) {

    const template = useQuery(api.functions.templates.getModelo, { modeloId: templateId });

    const jsonDoc = generateJSON(template?.content || "", extensions);  
    return jsonDoc;
}