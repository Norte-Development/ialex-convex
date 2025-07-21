import React, { ReactNode } from "react";
import { useLayout } from "@/context/LayoutContext";
import NavBar from "./NavBar";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isSidebarOpen } = useLayout();

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <NavBar />
        <div className="flex w-full">
          <Sidebar />
          <main
            className={`flex-1 h-full overflow-x-hidden w-full overflow-y-auto bg-background transition-all duration-300 ease-in-out ${
              isSidebarOpen ? "mr-38" : ""
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
