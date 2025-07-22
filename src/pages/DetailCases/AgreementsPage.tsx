import CaseDetailLayout from "@/components/Layout/CaseDetailLayout";
import HeaderOfDocument from "@/components/Documents/HeaderOfDocument";
import { Tiptap } from "@/components/Editor/tiptap-editor";

export default function AgreementsPage() {
  return (
    <CaseDetailLayout>
      <div className="w-[75%] h-full flex flex-col  bg-transparent">
        {/* <HeaderOfDocument /> */}
        <div className="w-full h-full flex flex-col  bg-white">
          <Tiptap />
        </div>
      </div>
    </CaseDetailLayout>
  );
}
