// import { useLayout } from "@/context/LayoutContext";
import { ArrowRight, SendIcon } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";

const Sidebar = () => {
  // const { isSidebarOpen, toggleSidebar } = useLayout();

  return (
    <aside
      className={`bg-white border-l border-border w-80 min-h-screen p-4 transform transition-transform duration-300 ease-in-out pt-15 flex flex-col justify-end fixed top-0 right-0 z-40`}
      // isSidebarOpen ? "translate-x-0" : "translate-x-full"
    >
      <button
        className="absolute top-16 left-2 cursor-pointer"
        onClick={() => {}}
        // toggleSidebar();
        // }
      >
        <ArrowRight size={15} />
      </button>
      <div className="flex gap-2 w-full justify-center items-center p-2">
        <TextareaAutosize className="w-full resize-none rounded-lg max-h-[100px] border border-input bg-[#f7f7f7] px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <SendIcon size={25} className="cursor-pointer" />
      </div>
    </aside>
  );
};

export default Sidebar;
