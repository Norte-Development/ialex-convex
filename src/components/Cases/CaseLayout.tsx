import { CopilotSidebar } from "@copilotkit/react-ui";
import { api } from "../../../convex/_generated/api";
import { useMutation } from "convex/react";
import CaseSidebar from "./CaseSideBar";
import { useLayout } from "@/context/LayoutContext";
import { useCase } from "@/context/CaseContext";
import { useThread } from "@/context/ThreadContext";
import { ArrowRight } from "lucide-react";
import Sidebar from "../Layout/Sidebar";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen, toggleCaseSidebar } = useLayout();
  const { caseId } = useCase();
  const { thread } = useThread();
  const createThread = useMutation(api.functions.chat.createThreadMetadata);

  const onSubmitMessageCallback = (message: string) => {
    const truncatedMessage = message.slice(0, 50);
    createThread({
      caseId: caseId || undefined,
      title: truncatedMessage,
      threadId: thread.threadId,
    });
    return Promise.resolve();
  };

  return (
    // <CopilotSidebar
    //   defaultOpen={true}
    //   clickOutsideToClose={false}
    //   hitEscapeToClose={true}
    //   shortcut="k"
    //   labels={{
    //     title: "Alex",
    //     initial: "¿En que trabajamos hoy?",
    //   }}
    //   onSubmitMessage={onSubmitMessageCallback}
    // >
    <>
      <div className="flex h-screen pt-14">
        {/* Sidebar - dynamic width */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isCaseSidebarOpen ? "w-64" : "w-0"
          }`}
        >
          <CaseSidebar />
        </div>
        {/* Main content - scrollable */}
        <main className="flex-1 bg-[#f7f7f7] overflow-y-auto pt-5 pl-2">
          {children}
        </main>
        <Sidebar />
      </div>

      {/* Botón de abrir cuando sidebar está cerrada */}
      {!isCaseSidebarOpen && (
        <button
          onClick={toggleCaseSidebar}
          className="fixed top-1/2 left-2 z-40 cursor-pointer bg-white border border-gray-300 rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"
        >
          <ArrowRight size={15} />
        </button>
      )}
    </>
    // </CopilotSidebar>
  );
}
