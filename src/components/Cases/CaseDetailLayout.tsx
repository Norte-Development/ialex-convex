import CaseSidebar from "../Layout/CaseSideBar";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseDetailLayout({ children }: CaseDetailLayoutProps) {
  return (
    <div className="flex  w-full h-screen pt-14">
      <CaseSidebar />
      <section className="w-full h-full overflow-y-auto bg-[#f7f7f7]">
        {children}
      </section>
    </div>
  );
}
