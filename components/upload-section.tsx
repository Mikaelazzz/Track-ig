"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, FileJson } from "lucide-react"
import { processJsonFile } from "@/lib/json-processor"

interface UploadSectionProps {
  isMultiple?: boolean
  onDataUpdate: (category: string, data: any) => void
  onNotification: (message: string, isError?: boolean) => void
}

export function UploadSection({ isMultiple = false, onDataUpdate, onNotification }: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setIsLoading(true)
    try {
      if (isMultiple) {
        const fileMappings: Record<string, { category: string; dataKey?: string }> = {
          "followers_1.json": { category: "followers_1" },
          "following.json": { category: "following", dataKey: "relationships_following" },
          "blocked_profiles.json": { category: "blocked_profile", dataKey: "relationships_blocked_users" },
          "close_friends.json": { category: "close_friends", dataKey: "relationships_close_friends" },
          "hide_story_from.json": { category: "hide_story_from", dataKey: "relationships_hide_stories_from" },
          "pending_follow_requests.json": {
            category: "pending_follow_request",
            dataKey: "relationships_follow_requests_sent",
          },
          "recent_follow_requests.json": {
            category: "recent_follow_request",
            dataKey: "relationships_permanent_follow_requests",
          },
          "recently_unfollowed_profiles.json": {
            category: "recently_unfollowed_profiles",
            dataKey: "relationships_unfollowed_users",
          },
        }

        let successCount = 0
        const failedFiles: string[] = []

        for (const file of selectedFiles) {
          const fileName = file.name.toLowerCase()
          const mapping = fileMappings[fileName]

          if (mapping) {
            const result = await processJsonFile(file, mapping.category, mapping.dataKey)
            if (result.success) {
              onDataUpdate(mapping.category, result.data)
              successCount++
            } else {
              failedFiles.push(fileName)
            }
          } else {
            failedFiles.push(fileName)
          }
        }

        if (successCount > 0) {
          onNotification(`${successCount} file(s) uploaded successfully`)
        }
        if (failedFiles.length > 0) {
          onNotification(`Failed to process: ${failedFiles.join(", ")}`, true)
        }
      }

      setSelectedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (error) {
      onNotification("Error uploading file", true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <FileJson className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Upload JSON Data</h3>
      </div>

      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium mb-1">Click to select files</p>
          <p className="text-xs text-muted-foreground">or drag and drop JSON files</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple={isMultiple}
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected files ({selectedFiles.length}):</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {selectedFiles.map((file) => (
                <div key={file.name} className="text-xs bg-muted p-2 rounded flex justify-between items-center">
                  <span>{file.name}</span>
                  <span className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isLoading}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isLoading ? "Uploading..." : "Upload Data"}
        </button>
      </div>
    </div>
  )
}
