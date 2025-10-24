import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

const BANNER_DISMISSED_KEY = "trialBannerDismissed"
const DISMISS_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export function TrialBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Check if banner was dismissed
    const dismissedData = localStorage.getItem(BANNER_DISMISSED_KEY)
    if (dismissedData) {
      const { timestamp } = JSON.parse(dismissedData)
      const now = Date.now()
      
      // If less than 24 hours have passed, keep it hidden
      if (now - timestamp < DISMISS_DURATION) {
        setIsVisible(false)
      } else {
        // Clear expired dismissal
        localStorage.removeItem(BANNER_DISMISSED_KEY)
      }
    }
  }, [])

  if (!user || user.trialStatus !== "active" || !user.trialEndDate || !isVisible) {
    return null
  }

  const now = Date.now()
  const daysLeft = Math.ceil((user.trialEndDate - now) / (1000 * 60 * 60 * 24))

  // Don't show if trial expired
  if (daysLeft <= 0) {
    return null
  }

  const isUrgent = daysLeft <= 3

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem(
      BANNER_DISMISSED_KEY,
      JSON.stringify({ timestamp: Date.now() })
    )
  }

  return (
    <div
      className={`fixed top-[41px] left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-2 text-sm border-b backdrop-blur-sm ${
        isUrgent 
          ? "bg-red-50/90 border-red-200 text-red-900" 
          : "bg-blue-50/90 border-blue-200 text-blue-900"
      }`}
    >
      <p className="flex-1">
        <strong>{daysLeft} días</strong> restantes de prueba Premium
      </p>
      <div className="flex items-center gap-2">
        <Button
          onClick={() => navigate("/preferencias?section=billing")}
          variant={isUrgent ? "destructive" : "default"}
          size="sm"
          className="h-7 text-xs"
        >
          Actualizar
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-black/5 rounded transition-colors"
          aria-label="Cerrar banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
