import CaseLayout from "@/components/Cases/CaseLayout";
import { Tiptap } from "@/components/Editor/tiptap-editor";
import { useParams } from "react-router-dom";

export default function EscritoPage() {
  const { escritoId } = useParams();
  return (
    <CaseLayout>
      <div className="w-full h-full flex flex-col  bg-transparent">
        <div className="w-full h-full flex flex-col  bg-white">
          <Tiptap documentId={escritoId} />
        </div>
      </div>
    </CaseLayout>
  );
}
