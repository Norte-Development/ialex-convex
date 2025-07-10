import CaseSidebar from "./CaseSideBar";
import { useLayout } from "@/context/LayoutContext";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseDetailLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout();
  return (
    <div className="flex w-full h-screen pt-14">
      <CaseSidebar />
      <section
        className={`w-full h-full overflow-y-auto bg-[#f7f7f7] transition-all duration-300 ease-in-out ${isCaseSidebarOpen ? "ml-64" : "ml-0"}`}
      >
        {children}
      </section>
    </div>
  );
}
