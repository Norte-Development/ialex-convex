import CaseDetailLayout from "@/components/Layout/CaseDetailLayout";
import HeaderOfDocument from "@/components/Documents/HeaderOfDocument";

export default function AgreementsPage() {
  return (
    <CaseDetailLayout>
      <div className="w-[75%] h-full flex flex-col  bg-transparent">
        <HeaderOfDocument />
        <div className="w-full h-full flex flex-col  bg-white">
          <h1>Acuerdos Page</h1>
        </div>
      </div>
    </CaseDetailLayout>
  );
}
