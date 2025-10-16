import React, { ReactNode } from "react";
import NavBar from "./Navbar/NavBar";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className=" flex flex-col overflow-hidden min-h-screen w-screen">
      <NavBar />
      <div className="flex w-full h-full">
        <main className=" h-full min-h-screen justify-center bg-white flex items-center  overflow-x-hidden w-full overflow-y-auto transition-all duration-300 ease-in-out">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
