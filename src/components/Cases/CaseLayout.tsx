import CaseSidebar from "./CaseSideBar";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  return (
    <div className="flex w-full h-full ">
      <CaseSidebar />
      <section
        className={`w-full pl-5 pt-5  h-full flex justify-center items-center overflow-y-auto bg-[#f7f7f7] transition-all duration-300 ease-in-out `}
      >
        {children}
      </section>
    </div>
  );
}
