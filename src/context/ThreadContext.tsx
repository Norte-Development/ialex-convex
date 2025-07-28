"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"

interface ThreadContextType {
  threadId: string | undefined
  isResetting: boolean
  resetThread: () => Promise<void>
  setThreadId: (id: string | undefined) => void
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined)

function getThreadIdFromHash() {
  return window.location.hash.replace(/^#chatbot-/, "") || undefined
}

export function ThreadProvider({ children }: { children: React.ReactNode }) {
  const createThread = useMutation(api.agent.threads.createNewThread)
  const [threadId, setThreadId] = useState<string | undefined>(
    typeof window !== "undefined" ? getThreadIdFromHash() : undefined,
  )
  const [isResetting, setIsResetting] = useState(false)

  // Listen for hash changes
  useEffect(() => {
    function onHashChange() {
      setThreadId(getThreadIdFromHash())
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const resetThread = useCallback(async () => {
    setIsResetting(true)
    try {
      const newId = await createThread({
        title: "Alex - Tu agente legal",
      })
      window.location.hash = `chatbot-${newId}`
      setThreadId(newId)
    } catch (error) {
      console.error("Failed to create new thread:", error)
    } finally {
      setIsResetting(false)
    }
  }, [createThread])

  const value: ThreadContextType = {
    threadId,
    isResetting,
    resetThread,
    setThreadId,
  }

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
}

export function useThread() {
  const context = useContext(ThreadContext)
  if (context === undefined) {
    throw new Error("useThread must be used within a ThreadProvider")
  }
  return context
} 