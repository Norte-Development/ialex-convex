// import { useLayout } from "@/context/LayoutContext";
// import { ArrowRight, SendIcon, ArrowLeft } from "lucide-react";
// import TextareaAutosize from "react-textarea-autosize";

// const Sidebar = () => {
//   const { isSidebarOpen, toggleSidebar } = useLayout();

//   return (
//     <aside
//       className={`relative bg-white border-l border-border  min-h-screen  transform transition-all duration-300 ease-in-out  flex flex-col justify-end  z-40 ${
//         isSidebarOpen ? "w-64" : "w-0"
//       }`}
//     >
//       <button
//         className="absolute top-5 left-2 cursor-pointer"
//         onClick={() => {
//           toggleSidebar();
//         }}
//       >
//         <ArrowRight size={15} />
//       </button>
//       {!isSidebarOpen && (
//         <button
//           onClick={toggleSidebar}
//           className="fixed top-1/2 right-2 z-40 cursor-pointer bg-white border border-gray-300 rounded-full p-2 shadow-md hover:shadow-lg transition-shadow"
//         >
//           <ArrowLeft size={15} />
//         </button>
//       )}
//       <div className="flex gap-2 w-full justify-center items-center p-2">
//         <TextareaAutosize className="w-full resize-none rounded-lg max-h-[100px] border border-input bg-[#f7f7f7] px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
//         <SendIcon size={25} className="cursor-pointer" />
//       </div>
//     </aside>
//   );
// };

// export default Sidebar;
