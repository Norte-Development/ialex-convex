import CaseSidebar from "./CaseSideBar";
import { useLayout } from "@/context/LayoutContext";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseDetailLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen, isSidebarOpen } = useLayout();
  return (
    <div className="flex w-full h-screen pt-14">
      <CaseSidebar />
      <section
        className={`w-full h-full flex justify-center items-center overflow-y-auto bg-[#f7f7f7] transition-all duration-300 ease-in-out ${
          isCaseSidebarOpen ? "ml-64" : "ml-0"
        } ${isSidebarOpen ? "mr-42" : "mr-0"} `}
      >
        {children}
      </section>
    </div>
  );
}
