"use client"

import { useState, useEffect, useRef } from "react"
import { UserCard } from "./user-card"
import { Users, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, X, Calendar } from "lucide-react"

interface User {
  username: string
  full_name?: string
  timestamp?: number
}

interface UserListProps {
  users: User[]
  followers: User[]
  showNotFollowingBackOnly?: boolean
  showProfileButton?: boolean
  itemsPerPage?: number
}

interface SearchSuggestion {
  user: User
  avatarUrl: string | null
}

export function UserList({
  users,
  followers,
  showNotFollowingBackOnly = false,
  showProfileButton = false,
  itemsPerPage = 25,
}: UserListProps) {
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [perPage, setPerPage] = useState(itemsPerPage)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMonth, setSelectedMonth] = useState<string>("all")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [loadingAvatars, setLoadingAvatars] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Load avatars for suggestions
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const searchLower = searchQuery.toLowerCase()
    const matchedUsers = users
      .filter((user) => {
        const matchUsername = user.username.toLowerCase().includes(searchLower)
        const matchFullName = user.full_name?.toLowerCase().includes(searchLower)
        return matchUsername || matchFullName
      })
      .slice(0, 5) // Limit to 5 suggestions

    if (matchedUsers.length > 0) {
      setShowSuggestions(true)
      
      // Initialize suggestions without avatars first
      const initialSuggestions = matchedUsers.map(user => ({
        user,
        avatarUrl: null
      }))
      setSuggestions(initialSuggestions)

      // Load avatars asynchronously
      setLoadingAvatars(true)
      Promise.all(
        matchedUsers.map(async (user) => {
          try {
            const response = await fetch(`/api/instagram-profile?username=${encodeURIComponent(user.username)}`)
            if (response.ok) {
              const data = await response.json()
              return { user, avatarUrl: data.profilePicUrl || null }
            }
          } catch (error) {
            console.error("Error fetching avatar:", error)
          }
          return { user, avatarUrl: null }
        })
      ).then((loadedSuggestions) => {
        setSuggestions(loadedSuggestions)
        setLoadingAvatars(false)
      })
    } else {
      setShowSuggestions(false)
      setSuggestions([])
    }
  }, [searchQuery, users])

  // Filter users based on search, month, and other filters
  useEffect(() => {
    let result = [...users]

    // Apply not following back filter
    if (showNotFollowingBackOnly && followers.length > 0) {
      const followerUsernames = new Set(followers.map((f) => f.username.toLowerCase()))
      result = result.filter((user) => !followerUsernames.has(user.username.toLowerCase()))
    }

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      result = result.filter((user) => {
        const matchUsername = user.username.toLowerCase().includes(searchLower)
        const matchFullName = user.full_name?.toLowerCase().includes(searchLower)
        return matchUsername || matchFullName
      })
    }

    // Apply month filter
    if (selectedMonth !== "all") {
      result = result.filter((user) => {
        if (!user.timestamp) return false
        const date = new Date(user.timestamp * 1000)
        const month = date.toLocaleString("en-US", { month: "long", year: "numeric" })
        return month === selectedMonth
      })
    }

    setFilteredUsers(result)
    setCurrentPage(1) // Reset to page 1 when filters change
  }, [users, followers, showNotFollowingBackOnly, searchQuery, selectedMonth])

  // Get unique months from users
  const availableMonths = Array.from(
    new Set(
      users
        .filter((user) => user.timestamp)
        .map((user) => {
          const date = new Date(user.timestamp! * 1000)
          return date.toLocaleString("en-US", { month: "long", year: "numeric" })
        })
    )
  ).sort((a, b) => {
    const dateA = new Date(a)
    const dateB = new Date(b)
    return dateB.getTime() - dateA.getTime() // Sort descending (newest first)
  })

  // Calculate pagination
  const totalItems = filteredUsers.length
  const totalPages = Math.ceil(totalItems / perPage)
  const startIndex = (currentPage - 1) * perPage
  const endIndex = startIndex + perPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePerPageChange = (value: number) => {
    setPerPage(value)
    setCurrentPage(1) // Reset to page 1 when changing items per page
  }

  const handleSelectSuggestion = (user: User) => {
    setSearchQuery(user.username)
    setShowSuggestions(false)
  }

  const clearSearch = () => {
    setSearchQuery("")
    setShowSuggestions(false)
  }

  if (users.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground">No users to display</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Section */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Box with Autocomplete */}
          <div className="flex-1 relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by username or full name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true)
                }}
                className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.user.username}
                    onClick={() => handleSelectSuggestion(suggestion.user)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors border-b border-border last:border-b-0"
                  >
                    {suggestion.avatarUrl ? (
                      <img
                        src={suggestion.avatarUrl}
                        alt={suggestion.user.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(suggestion.user.username)}&background=FFD700&color=000&size=100&fontSize=0.4`
                        }}
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">@{suggestion.user.username}</p>
                      {suggestion.user.full_name && (
                        <p className="text-xs text-muted-foreground">{suggestion.user.full_name}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Month Filter */}
          {availableMonths.length > 0 && (
            <div className="flex items-center gap-2 md:w-64">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Months</option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {(searchQuery || selectedMonth !== "all") && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                Search: "{searchQuery}"
                <button onClick={clearSearch} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedMonth !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                Month: {selectedMonth}
                <button onClick={() => setSelectedMonth("all")} className="hover:bg-primary/20 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {filteredUsers.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">No users found matching your filters</p>
          <button
            onClick={() => {
              clearSearch()
              setSelectedMonth("all")
            }}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <>
          {/* Stats and Items Per Page Selector */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border rounded-lg p-4">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
              <span className="font-semibold text-foreground">{Math.min(endIndex, totalItems)}</span> of{" "}
              <span className="font-semibold text-foreground">{totalItems}</span> users
            </div>
            
            <div className="flex items-center gap-2">
              <label htmlFor="perPage" className="text-sm text-muted-foreground whitespace-nowrap">
                Items per page:
              </label>
              <select
                id="perPage"
                value={perPage}
                onChange={(e) => handlePerPageChange(Number(e.target.value))}
                className="bg-background border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {/* User Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentUsers.map((user) => (
              <UserCard
                key={user.username}
                user={user}
                isNotFollowingBack={
                  showNotFollowingBackOnly ||
                  (followers.length > 0 && !followers.some((f) => f.username.toLowerCase() === user.username.toLowerCase()))
                }
                showProfileButton={showProfileButton}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card border border-border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">
                Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
                <span className="font-semibold text-foreground">{totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* First Page */}
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="First page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous Page */}
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`min-w-[2.5rem] px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? "bg-primary text-primary-foreground"
                            : "border border-border hover:bg-accent"
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                {/* Next Page */}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page */}
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-border hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Last page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
