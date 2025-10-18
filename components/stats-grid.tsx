import { Users, UserCheck, UserX, Heart, Eye } from "lucide-react"

interface StatsGridProps {
  stats: {
    followers: number
    following: number
    notFollowingBack: number
    blocked: number
    closeFriends: number
  }
}

export function StatsGrid({ stats }: StatsGridProps) {
  const statItems = [
    { label: "Followers", value: stats.followers, icon: Users, color: "bg-blue-100 dark:bg-blue-900" },
    { label: "Following", value: stats.following, icon: UserCheck, color: "bg-green-100 dark:bg-green-900" },
    { label: "Not Following Back", value: stats.notFollowingBack, icon: UserX, color: "bg-red-100 dark:bg-red-900" },
    { label: "Blocked", value: stats.blocked, icon: Eye, color: "bg-orange-100 dark:bg-orange-900" },
    { label: "Close Friends", value: stats.closeFriends, icon: Heart, color: "bg-pink-100 dark:bg-pink-900" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {statItems.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                <p className="text-3xl font-bold text-foreground">{item.value.toLocaleString()}</p>
              </div>
              <div className={`${item.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
