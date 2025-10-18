interface ProcessResult {
  success: boolean
  data?: any[]
  error?: string
}

export async function processJsonFile(file: File, category: string, dataKey?: string): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string)
        let processedData: any[] = []

        if (category === "followers_1") {
          // Followers data is directly an array
          if (Array.isArray(jsonData)) {
            processedData = jsonData.map((item) => ({
              username: item.string_list_data?.[0]?.value || item.title || "Unknown",
              full_name: item.title || "",
              timestamp: item.string_list_data?.[0]?.timestamp || null,
            }))
          }
        } else {
          // Other categories have data nested in a specific key
          const dataArray = dataKey ? jsonData[dataKey] : jsonData
          if (Array.isArray(dataArray)) {
            processedData = dataArray.map((item) => ({
              username: item.string_list_data?.[0]?.value || item.title || "Unknown",
              full_name: item.title || "",
              timestamp: item.string_list_data?.[0]?.timestamp || null,
            }))
          }
        }

        resolve({ success: true, data: processedData })
      } catch (error) {
        resolve({
          success: false,
          error: error instanceof Error ? error.message : "Failed to parse JSON",
        })
      }
    }

    reader.onerror = () => {
      resolve({ success: false, error: "Failed to read file" })
    }

    reader.readAsText(file)
  })
}
