import ConditionalLayout from "@/components/Layout/ConditionalLayout";
import { useLayout } from "@/context/LayoutContext";
import TeamTable from "@/components/Teams/TeamTable";

export default function TeamPage() {
  const { isInCaseContext } = useLayout();

  return (
    <ConditionalLayout>
      <div
        className={`flex flex-col gap-4 w-full min-h-screen px-10 bg-[#f7f7f7] ${isInCaseContext ? "pt-5" : "pt-20"}`}
      >
        <section className="w-full h-full flex justify-start items-center">
          <h1 className="text-2xl font-bold text-black">Equipo</h1>
        </section>
        <TeamTable />
      </div>
    </ConditionalLayout>
  );
}
