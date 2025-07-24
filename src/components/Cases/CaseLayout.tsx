import { CopilotSidebar } from "@copilotkit/react-ui";
import { api } from "../../../convex/_generated/api";
import { useMutation } from "convex/react";
import CaseSidebar from "./CaseSideBar";
import { useLayout } from "@/context/LayoutContext";
import { useCase } from "@/context/CaseContext";
import { useThread } from "@/context/ThreadContext";

interface CaseDetailLayoutProps {
  children: React.ReactNode;
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout();
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
    <CopilotSidebar
      defaultOpen={true}
      clickOutsideToClose={false}
      hitEscapeToClose={true}
      shortcut="k"
      labels={{
        title: "Alex",
        initial: "¿En que trabajamos hoy?",
      }}
      onSubmitMessage={onSubmitMessageCallback}
    >
      {/* Sidebar - fixed */}
      {isCaseSidebarOpen && (
        <div className="fixed top-14 left-0 h-[calc(100vh-56px)] w-64 z-20">
          <CaseSidebar />
        </div>
      )}
      {/* Main content - scrollable */}
      <main
        className={`transition-all duration-300 ease-in-out bg-[#f7f7f7] pt-14 ${
          isCaseSidebarOpen ? "ml-64" : "ml-0"
        } h-[calc(100vh-56px)] overflow-y-auto`}
      >
        {children}
      </main>
    </CopilotSidebar>
  );
}
