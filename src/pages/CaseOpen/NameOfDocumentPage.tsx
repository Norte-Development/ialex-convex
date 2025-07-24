import CaseLayout from "@/components/Cases/CaseLayout";
import HeaderOfDocument from "@/components/Documents/HeaderOfDocument";
import { Tiptap } from "@/components/Editor/tiptap-editor";
export default function NameOfDocumentPage() {
  return (
    <CaseLayout>
      <div className="w-[75%] h-full flex flex-col  bg-transparent">
        <HeaderOfDocument />
        <div className="w-full h-full flex flex-col  bg-white">
          <h1>Nombre del documento Page</h1>
          <Tiptap />
        </div>
      </div>
    </CaseLayout>
  );
}
