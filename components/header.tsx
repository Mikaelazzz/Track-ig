import { Instagram } from "lucide-react"

export function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Instagram className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Instagram Insights</h1>
            <p className="text-sm text-muted-foreground">Analyze your followers and following data</p>
          </div>
        </div>
      </div>
    </header>
  )
}
