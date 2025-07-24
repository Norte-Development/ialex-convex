import CaseLayout from "@/components/Cases/CaseLayout";
import { Tiptap } from "@/components/Editor/tiptap-editor";
import { useCase } from "@/context/CaseContext";

export default function AgreementsPage() {
  const { currentCase } = useCase();
  return (
    <CaseLayout>
      <div className="w-[75%] h-full flex flex-col  bg-transparent">
        {/* <HeaderOfDocument /> */}
        <div className="w-full h-full flex flex-col  bg-white">
          <Tiptap documentId={currentCase?._id} />
        </div>
      </div>
    </CaseLayout>
  );
}
