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
import { Loader2, CheckCircle, XCircle, FileText, Shield, ArrowLeft } from "lucide-react"
import { CasePermissionsProvider, useCasePerms } from "@/contexts/CasePermissionsContext"
import { PERMISSIONS } from "@/permissions/types"
import { Button } from "@/components/ui/button"

interface CaseDetailLayoutProps {
  children: React.ReactNode
}

interface UploadFile {
  id: string
  file: File
  status: 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

export default function CaseLayout({ children }: CaseDetailLayoutProps) {
  const { currentCase } = useCase()
  const caseId = currentCase?._id || null

  return (
    <CasePermissionsProvider caseId={caseId}>
      <InnerCaseLayout>{children}</InnerCaseLayout>
    </CasePermissionsProvider>
  )
}

function InnerCaseLayout({ children }: CaseDetailLayoutProps) {
  const { isCaseSidebarOpen } = useLayout()
  const { currentCase } = useCase()
  const { hasAccess, isLoading, can } = useCasePerms()
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [chatbotWidth, setChatbotWidth] = useState(380)
  const [isResizing, setIsResizing] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])

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
  const uploadFile = useCallback(async (file: File) => {
    if (!currentCase) {
      console.error("No case selected")
      return
    }

    if (!can.docs.write) {
      console.error("No permission to upload documents")
      return
    }

    const fileId = `${Date.now()}-${Math.random()}`
    
    // Add file to upload queue
    setUploadFiles(prev => [...prev, {
      id: fileId,
      file,
      status: 'uploading',
      progress: 0
    }])

    try {
      
      // Update progress to 25%
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 25 } : f
      ))
      
      // Step 1: Get a short-lived upload URL
      const postUrl = await generateUploadUrl()
      
      // Update progress to 50%
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 50 } : f
      ))
      
      // Step 2: POST the file to the URL
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      
      const { storageId } = await result.json()
      
      // Update progress to 75%
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 75 } : f
      ))
      
      // Step 3: Save the newly allocated storage id to the database
      await createDocument({
        title: file.name,
        caseId: currentCase._id,
        fileId: storageId,
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      })

      // Update to success
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'success', progress: 100 } : f
      ))

      console.log(`File "${file.name}" uploaded successfully`)
      
      // Remove success files after 3 seconds
      setTimeout(() => {
        setUploadFiles(prev => prev.filter(f => f.id !== fileId))
      }, 3000)
      
    } catch (error) {
      console.error("Error uploading file:", error)
      
      // Update to error
      setUploadFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f
      ))
      
      // Remove error files after 5 seconds
      setTimeout(() => {
        setUploadFiles(prev => prev.filter(f => f.id !== fileId))
      }, 5000)
    }
  }, [currentCase, generateUploadUrl, createDocument])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log("Files dropped:", acceptedFiles)
    
    // Upload each file sequentially
    for (const file of acceptedFiles) {
      await uploadFile(file)
    }
  }, [uploadFile])

  const onDragEnter = useCallback(() => {
  }, [])

  const onDragLeave = useCallback(() => {
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
      'audio/*': ['.mp3', '.wav'],
      'video/*': ['.mp4', '.mov'],
    },
    multiple: true,
    noClick: true, // Don't trigger on click, only drag
    disabled: !can.docs.write, // Disable dropzone if no write permission
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando permisos...</p>
        </div>
      </div>
    )
  }

  // Access denied state
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-gray-600 mb-6">
            No tienes los permisos necesarios para acceder a este caso.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
          
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Contacta al administrador del caso para solicitar acceso.
            </p>
          </div>
        </div>
      </div>
    )
  }

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

      {/* Upload Feedback Overlay */}
      {uploadFiles.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
          {uploadFiles.map((uploadFile) => (
            <div
              key={uploadFile.id}
              className={`bg-white rounded-lg shadow-lg border p-3 transition-all duration-300 ${
                uploadFile.status === 'error' ? 'border-red-200' :
                uploadFile.status === 'success' ? 'border-green-200' :
                'border-blue-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {uploadFile.status === 'uploading' && (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                  {uploadFile.status === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                  </div>
                  
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {uploadFile.progress}% complete
                      </p>
                    </div>
                  )}
                  
                  {uploadFile.status === 'success' && (
                    <p className="text-xs text-green-600 mt-1">
                      Archivo subido correctamente
                    </p>
                  )}
                  
                  {uploadFile.status === 'error' && (
                    <p className="text-xs text-red-600 mt-1">
                      {uploadFile.error || 'Upload failed'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
