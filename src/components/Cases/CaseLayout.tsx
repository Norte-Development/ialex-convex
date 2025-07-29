"use client"

import type React from "react"
import CaseSidebar from "./CaseSideBar"
import SidebarChatbot from "../Agent/SidebarChatbot"
import { useLayout } from "@/context/LayoutContext"
import { useState, useEffect } from "react"

interface CaseDetailLayoutProps {
  children: React.ReactNode
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout()
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [chatbotWidth, setChatbotWidth] = useState(380)
  const [isResizing, setIsResizing] = useState(false)

  // Load saved width from localStorage
  useEffect(() => {
    const savedWidth = localStorage.getItem("chatbot-width")
    if (savedWidth) {
      setChatbotWidth(Number.parseInt(savedWidth, 10))
    }
  }, [])

  // Save width to localStorage
  const handleWidthChange = (newWidth: number) => {
    setChatbotWidth(newWidth)
    localStorage.setItem("chatbot-width", newWidth.toString())
  }

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen)
  }

  const handleResizeStart = () => {
    setIsResizing(true)
  }

  const handleResizeEnd = () => {
    setIsResizing(false)
  }

  return (
    <div className="relative">
      {/* Left Sidebar - fixed */}
      {isCaseSidebarOpen && (
        <div className="fixed top-14 left-0 h-[calc(100vh-56px)] w-64 z-20">
          <CaseSidebar />
        </div>
      )}

      {/* Main content - scrollable */}
      <main
        className={`bg-[#f7f7f7] pt-14 h-[calc(100vh-56px)] overflow-y-auto ${
          isResizing ? "transition-none" : "transition-all duration-300 ease-in-out"
        }`}
        style={{
          marginLeft: isCaseSidebarOpen ? "256px" : "0px",
          marginRight: isChatbotOpen ? `${chatbotWidth}px` : "0px",
        }}
      >
        {children}
      </main>

      {/* Right Sidebar Chatbot */}
      <SidebarChatbot
        isOpen={isChatbotOpen}
        onToggle={toggleChatbot}
        width={chatbotWidth}
        onWidthChange={handleWidthChange}
        onResizeStart={handleResizeStart}
        onResizeEnd={handleResizeEnd}
      />
    </div>
  )
}
