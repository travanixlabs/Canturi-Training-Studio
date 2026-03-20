'use client'

import { useState, useMemo } from 'react'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { CATEGORY_COLOURS } from '@/types'
import type { Category, MenuItem, Completion, User } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
  currentUser: User
}

export function TraineeMenu({ categories, menuItems, completions, currentUser }: Props) {
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(categories.map(c => c.id)))
  const router = useRouter()

  const isCompleted = (itemId: string) => completions.some(c => c.menu_item_id === itemId)
  const getCompletion = (itemId: string) => completions.find(c => c.menu_item_id === itemId) ?? null

  const filteredItems = useMemo(() => {
    if (!search.trim()) return menuItems
    const q = search.toLowerCase()
    return menuItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [menuItems, search])

  const isSearching = search.trim().length > 0

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function highlightText(text: string, query: string) {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-gold/25 text-charcoal rounded px-0.5">{part}</mark>
        : part
    )
  }

  return (
    <>
      <div className="px-5 py-6">
        <div className="mb-5">
          <h1 className="font-serif text-2xl text-charcoal">Training Menu</h1>
          <p className="text-sm text-charcoal/40 mt-1">Browse all topics or search to log a shadowing moment</p>
        </div>

        {/* Search bar — the shadowing trigger */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/30" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topics, tags… e.g. 'ultrasonic clean'"
            className="input pl-10 pr-10"
            autoComplete="off"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search results */}
        {isSearching && (
          <div className="mb-2">
            <p className="text-xs text-charcoal/40 mb-3">
              {filteredItems.length === 0 ? 'No results' : `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''}`}
            </p>
            {filteredItems.length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-charcoal/40 text-sm">No training items match &quot;{search}&quot;</p>
              </div>
            )}
            <div className="space-y-2">
              {filteredItems.map(item => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  completed={isCompleted(item.id)}
                  searchQuery={search}
                  highlightText={highlightText}
                  onOpen={() => router.push(`/trainee/course/${item.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Category browse (when not searching) */}
        {!isSearching && (
          <div className="space-y-3">
            {categories.map(category => {
              const items = menuItems.filter(i => i.category_id === category.id)
              const expanded = expandedCategories.has(category.id)
              const completedCount = items.filter(i => isCompleted(i.id)).length

              return (
                <div key={category.id} className="card overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{
                        backgroundColor: category.colour_hex + '20',
                        color: category.colour_hex
                      }}
                    >
                      {category.icon}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-charcoal text-[15px]">{category.name}</p>
                      <p className="text-xs text-charcoal/40 mt-0.5">{completedCount}/{items.length} complete</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Mini progress */}
                      <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%`,
                            backgroundColor: category.colour_hex
                          }}
                        />
                      </div>
                      {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                    </div>
                  </button>

                  {/* Items */}
                  {expanded && (
                    <div className="border-t border-black/5 divide-y divide-black/5">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => router.push(`/trainee/course/${item.id}`)}
                          className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                        >
                          <span
                            className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                              isCompleted(item.id)
                                ? 'border-transparent'
                                : 'border-charcoal/20'
                            }`}
                            style={isCompleted(item.id) ? { backgroundColor: category.colour_hex } : {}}
                          >
                            {isCompleted(item.id) && <span className="text-white">✓</span>}
                          </span>
                          <div className="flex-1">
                            <p className={`text-[14px] leading-snug ${isCompleted(item.id) ? 'text-charcoal/40' : 'text-charcoal'}`}>
                              {item.title}
                            </p>
                            <p className="text-xs text-charcoal/35 mt-0.5">{item.time_needed} · {item.trainer_type}</p>
                          </div>
                          <span className="text-charcoal/20 text-lg">›</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </>
  )
}

function MenuItemCard({
  item,
  completed,
  searchQuery,
  highlightText,
  onOpen,
}: {
  item: MenuItem
  completed: boolean
  searchQuery: string
  highlightText: (text: string, query: string) => React.ReactNode
  onOpen: () => void
}) {
  const colour = item.category ? CATEGORY_COLOURS[item.category.name] ?? '#C9A96E' : '#C9A96E'

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left p-4 hover:shadow-md transition-shadow relative overflow-hidden"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colour }}
      />
      <div className="pl-3">
        {item.category && (
          <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
        )}
        <p className="font-medium text-charcoal text-[15px] mt-1.5 leading-snug">
          {highlightText(item.title, searchQuery)}
        </p>
        <p className="text-xs text-charcoal/50 mt-1 line-clamp-2 leading-relaxed">
          {highlightText(item.description, searchQuery)}
        </p>
        {completed && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-2">
            <span>✓</span> Completed
          </span>
        )}
      </div>
    </button>
  )
}
