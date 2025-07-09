import CaseSidebar from "../Layout/CaseSideBar";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseDetailLayout({ children }: CaseDetailLayoutProps) {
  return (
    <div className="flex bg-green-400 w-full min-h-screen">
      <CaseSidebar />
      <section className="w-full">{children}</section>
    </div>
  );
}
