import CaseLayout from "@/components/Cases/CaseLayout";
import { Tiptap } from "@/components/Editor/tiptap-editor";

export default function AgreementsPage() {
  return (
    <CaseLayout>
      <div className="w-[75%] h-full flex flex-col  bg-transparent">
        {/* <HeaderOfDocument /> */}
        <div className="w-full h-full flex flex-col  bg-white">
          <Tiptap />
        </div>
      </div>
    </CaseLayout>
  );
}
