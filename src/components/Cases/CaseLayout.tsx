"use client"

import type React from "react"
import CaseSidebar from "./CaseSideBar"
import SidebarChatbot from "../Agent/SidebarChatbot"
import { useLayout } from "@/context/LayoutContext"
import { useState, useEffect, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import { useCase } from "@/context/CaseContext"

interface CaseDetailLayoutProps {
  children: React.ReactNode
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout()
  const { currentCase } = useCase()
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [chatbotWidth, setChatbotWidth] = useState(380)
  const [isResizing, setIsResizing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Convex mutations
  const generateUploadUrl = useMutation(api.functions.documents.generateUploadUrl)
  const createDocument = useMutation(api.functions.documents.createDocument)

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

  // Document upload handlers
  const [isDragActive, setIsDragActive] = useState(false)

  const uploadFile = useCallback(async (file: File) => {
    if (!currentCase) {
      console.error("No case selected")
      return
    }

    try {
      setIsUploading(true)
      
      // Step 1: Get a short-lived upload URL
      const postUrl = await generateUploadUrl()
      
      // Step 2: POST the file to the URL
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      
      const { storageId } = await result.json()
      
      // Step 3: Save the newly allocated storage id to the database
      await createDocument({
        title: file.name,
        caseId: currentCase._id,
        fileId: storageId,
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      })

      console.log(`File "${file.name}" uploaded successfully`)
    } catch (error) {
      console.error("Error uploading file:", error)
      alert(`Error uploading ${file.name}. Please try again.`)
    } finally {
      setIsUploading(false)
    }
  }, [currentCase, generateUploadUrl, createDocument])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsDragActive(false)
    console.log("Files dropped:", acceptedFiles)
    
    // Upload each file sequentially
    for (const file of acceptedFiles) {
      await uploadFile(file)
    }
  }, [uploadFile])

  const onDragEnter = useCallback(() => {
    setIsDragActive(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragActive(false)
  }, [])

  const { getRootProps } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'text/plain': ['.txt'],
    },
    multiple: true,
    noClick: true, // Don't trigger on click, only drag
  })

  return (
    <div {...getRootProps()} className="relative h-full w-full">
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
