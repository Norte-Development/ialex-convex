import React, { ReactNode } from "react";
import NavBar from "./Navbar/NavBar";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex-1 flex flex-col overflow-hidden">
        <NavBar />
        <div className="flex w-full h-full">
          <Sidebar />
          <main
            className={` h-full flex bg-[#f7f7f7] justify-center items-center overflow-x-hidden w-full overflow-y-auto  transition-all duration-300 ease-in-out `}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
