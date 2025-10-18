"use client"

import { useState } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Header } from "@/components/header"
import { StatsGrid } from "@/components/stats-grid"
import { TabNavigation } from "@/components/tab-navigation"
import { TabContent } from "@/components/tab-content"
import { Notification } from "@/components/notification"
import { useInstagramData } from "@/hooks/use-instagram-data"

export default function Home() {
  const [activeTab, setActiveTab] = useState("upload_all")
  const [notification, setNotification] = useState<{ message: string; isError: boolean } | null>(null)
  const { data, updateData, deleteData, stats } = useInstagramData()

  const showNotification = (message: string, isError = false) => {
    setNotification({ message, isError })
    setTimeout(() => setNotification(null), 3000)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <StatsGrid stats={stats} />

        <div className="mt-8">
          <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          <TabContent
            activeTab={activeTab}
            data={data}
            onDataUpdate={updateData}
            onDataDelete={deleteData}
            onNotification={showNotification}
          />
        </div>
      </main>

      {notification && <Notification message={notification.message} isError={notification.isError} />}
    </div>
  )
}
