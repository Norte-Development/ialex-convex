import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"

interface ThreadContextType {
  threadId: string | undefined
  createThreadWithTitle: (title: string, caseId?: string | undefined) => Promise<string>
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

  // Listen for hash changes
  useEffect(() => {
    function onHashChange() {
      setThreadId(getThreadIdFromHash())
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

  const createThreadWithTitle = useCallback(async (title: string, caseId: string | undefined) => {
    const newId = await createThread({ title, caseId: caseId || undefined })
    window.location.hash = `chatbot-${newId}`
    setThreadId(newId)
    return newId
  }, [createThread])

  const value: ThreadContextType = {
    threadId,
    createThreadWithTitle,
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