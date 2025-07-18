import CaseDetailLayout from "@/components/Layout/CaseDetailLayout";
import HeaderOfDocument from "@/components/Documents/HeaderOfDocument";

export default function NameOfDocumentPage() {
  return (
    <CaseDetailLayout>
      <div className="w-[75%] h-full flex flex-col  bg-transparent">
        <HeaderOfDocument />
        <div className="w-full h-full flex flex-col  bg-white">
          <h1>Nombre del documento Page</h1>
        </div>
      </div>
    </CaseDetailLayout>
  );
}
