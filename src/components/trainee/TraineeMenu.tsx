'use client'

import { useState, useMemo } from 'react'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { CATEGORY_COLOURS } from '@/types'
import type { Category, MenuItem, Completion, User, RecurringTaskCompletion, Plate, Workshop, WorkshopMenuItem } from '@/types'
import { useRouter } from 'next/navigation'
import { todayAEDT } from '@/lib/dates'

interface Props {
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
  currentUser: User
  recurringCompletions?: RecurringTaskCompletion[]
  plates?: Plate[]
  workshops?: Workshop[]
  workshopMenuItems?: WorkshopMenuItem[]
}

export function TraineeMenu({ categories, menuItems, completions, currentUser, recurringCompletions = [], plates = [], workshops = [], workshopMenuItems = [] }: Props) {
  const [search, setSearch] = useState('')
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const router = useRouter()

  const isCompleted = (itemId: string) => completions.some(c => c.menu_item_id === itemId)
  const getCompletion = (itemId: string) => completions.find(c => c.menu_item_id === itemId) ?? null

  const getRecurringCount = (itemId: string) =>
    recurringCompletions.filter(rc => rc.menu_item_id === itemId && rc.trainee_id === currentUser.id).length

  const getRecurringBreakdown = (itemId: string) => {
    const rcs = recurringCompletions.filter(rc => rc.menu_item_id === itemId && rc.trainee_id === currentUser.id)
    const plateDates = plates.filter(p => p.menu_item_id === itemId && p.trainee_id === currentUser.id).map(p => p.date_assigned)
    const assigned = rcs.filter(rc => plateDates.includes(rc.completed_date)).length
    return { assigned, shadowed: rcs.length - assigned }
  }

  const todayStr = todayAEDT()
  const isDoneToday = (itemId: string) =>
    recurringCompletions.some(rc => rc.menu_item_id === itemId && rc.trainee_id === currentUser.id && rc.completed_date === todayStr)

  const getAssignedDate = (itemId: string) =>
    plates.find(p => p.menu_item_id === itemId && p.trainee_id === currentUser.id)?.date_assigned ?? null

  const isShadowedEarly = (itemId: string) => {
    const comp = getCompletion(itemId)
    const assignedDate = getAssignedDate(itemId)
    return !!(comp && assignedDate && comp.completed_date < assignedDate)
  }

  const formatDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })

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

  function toggleWorkshop(id: string) {
    setExpandedWorkshops(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const itemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === ws.id).map(wmi => wmi.menu_item_id))
      const wsItems = menuItems.filter(mi => itemIds.has(mi.id))
      const catIds = [...new Set(wsItems.map(mi => mi.category_id))]
      const wsCats = categories.filter(c => catIds.includes(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, categories: wsCats, menuItemIds: itemIds }
    }).filter(ws => ws.categories.length > 0)
  }, [workshops, workshopMenuItems, menuItems, categories])

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

        {/* Workshop → Course → Category browse (when not searching) */}
        {!isSearching && (
          <div className="space-y-3">
            {workshopHierarchy.map(({ workshop, categories: wsCats, menuItemIds }) => {
              const wsExpanded = expandedWorkshops.has(workshop.id)
              const wsItems = menuItems.filter(mi => menuItemIds.has(mi.id))
              const wsCompleted = wsItems.filter(i => isCompleted(i.id)).length

              const allCourseKeys = wsCats.map(c => `${workshop.id}-${c.id}`)
              const allCoursesExpanded = allCourseKeys.length > 0 && allCourseKeys.every(k => expandedCategories.has(k))

              return (
                <div key={workshop.id} className="card overflow-hidden">
                  {/* Workshop header */}
                  <button
                    onClick={() => toggleWorkshop(workshop.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-sm flex-shrink-0 text-gold font-serif">
                      W
                    </span>
                    <div className="flex-1">
                      <p className="font-serif font-medium text-charcoal text-[16px]">{workshop.name}</p>
                      <p className="text-xs text-charcoal/40 mt-0.5">{wsCompleted}/{wsItems.length} complete · {wsCats.length} course{wsCats.length !== 1 ? 's' : ''}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (allCoursesExpanded) {
                            setExpandedCategories(prev => {
                              const next = new Set(prev)
                              for (const k of allCourseKeys) next.delete(k)
                              return next
                            })
                            setExpandedWorkshops(prev => {
                              const next = new Set(prev)
                              next.delete(workshop.id)
                              return next
                            })
                          } else {
                            setExpandedCategories(prev => {
                              const next = new Set(prev)
                              for (const k of allCourseKeys) next.add(k)
                              return next
                            })
                            setExpandedWorkshops(prev => new Set(prev).add(workshop.id))
                          }
                        }}
                        className="text-xs font-medium text-gold hover:text-gold/80 transition-colors mt-1"
                      >
                        {allCoursesExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full"
                          style={{ width: `${wsItems.length > 0 ? (wsCompleted / wsItems.length) * 100 : 0}%` }}
                        />
                      </div>
                      {wsExpanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                    </div>
                  </button>

                  {/* Courses inside this workshop */}
                  {wsExpanded && (
                    <div className="border-t border-black/5">
                      {wsCats.map(category => {
                        const catItems = wsItems.filter(i => i.category_id === category.id)
                        const catKey = `${workshop.id}-${category.id}`
                        const catExpanded = expandedCategories.has(catKey)
                        const completedCount = catItems.filter(i => isCompleted(i.id)).length

                        return (
                          <div key={category.id}>
                            {/* Course header */}
                            <button
                              onClick={() => toggleCategory(catKey)}
                              className="w-full pl-8 pr-5 py-3 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors border-b border-black/5"
                            >
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                                style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                              >
                                {category.icon}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium text-charcoal text-[14px]">{category.name}</p>
                                <p className="text-xs text-charcoal/40 mt-0.5">{completedCount}/{catItems.length} complete</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-1 bg-charcoal/8 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${catItems.length > 0 ? (completedCount / catItems.length) * 100 : 0}%`,
                                      backgroundColor: category.colour_hex
                                    }}
                                  />
                                </div>
                                {catExpanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                              </div>
                            </button>

                            {/* Categories (menu items) inside this course */}
                            {catExpanded && (
                              <div className="divide-y divide-black/5 bg-charcoal/[0.01]">
                                {catItems.map(item => {
                                  const isRec = item.is_recurring && !!item.recurring_amount
                                  const recDone = isRec ? getRecurringCount(item.id) : 0
                                  const recTotal = item.recurring_amount ?? 0
                                  const recFullyComplete = isRec && recDone >= recTotal

                                  const completed = isCompleted(item.id)
                                  const comp = getCompletion(item.id)
                                  const shadowedEarly = isShadowedEarly(item.id)
                                  const assignedDate = getAssignedDate(item.id)
                                  const isOverdue = !isRec && !completed && assignedDate && assignedDate < todayStr

                                  const bgClass = isRec
                                    ? (recFullyComplete ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-charcoal/2')
                                    : (completed ? (shadowedEarly ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-green-50/50 hover:bg-green-50') : isOverdue ? 'bg-yellow-50/50 hover:bg-yellow-50' : 'hover:bg-charcoal/2')

                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => router.push(`/trainee/course/${item.id}`)}
                                      className={`w-full pl-12 pr-5 py-3.5 flex items-center gap-3 text-left transition-colors ${bgClass}`}
                                    >
                                      <span
                                        className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                                          isRec
                                            ? (recFullyComplete ? 'border-transparent bg-green-500' : 'border-charcoal/20')
                                            : (completed ? (shadowedEarly ? 'border-transparent bg-blue-500' : 'border-transparent bg-green-500') : isOverdue ? 'border-yellow-400 bg-yellow-50' : 'border-charcoal/20')
                                        }`}
                                      >
                                        {(completed || recFullyComplete) && <span className="text-white text-[10px]">✓</span>}
                                      </span>
                                      <div className="flex-1">
                                        <p className={`text-[14px] leading-snug ${
                                          isRec
                                            ? (recFullyComplete ? 'text-charcoal/40' : 'text-charcoal')
                                            : (completed ? 'text-charcoal/40' : 'text-charcoal')
                                        }`}>
                                          {item.title}
                                        </p>
                                        {isRec ? (
                                          <p className={`text-xs font-medium mt-0.5 ${recFullyComplete ? 'text-green-600' : 'text-charcoal/40'}`}>
                                            {recDone} out of {recTotal} training tasks completed
                                            {recDone > 0 && (() => {
                                              const bd = getRecurringBreakdown(item.id)
                                              return (
                                                <span className="ml-1">
                                                  | {bd.shadowed > 0 && <span className="text-blue-600">{bd.shadowed} shadowed</span>}{bd.assigned > 0 && bd.shadowed > 0 && <span className="text-charcoal/30"> / </span>}{bd.assigned > 0 && <span className="text-green-600">{bd.assigned} completed</span>}
                                                </span>
                                              )
                                            })()}
                                          </p>
                                        ) : completed ? (
                                          <p className="text-xs mt-0.5">
                                            {shadowedEarly ? (
                                              <span className="text-blue-600 font-medium">Shadowed early on {formatDate(comp!.completed_date)}</span>
                                            ) : (
                                              <>
                                                <span className="text-green-600 font-medium">Completed {formatDate(comp!.completed_date)}</span>
                                                {assignedDate && (
                                                  <span className="font-semibold text-charcoal/50 ml-1">{formatDate(assignedDate)}</span>
                                                )}
                                              </>
                                            )}
                                          </p>
                                        ) : assignedDate ? (
                                          <p className="text-xs mt-0.5">
                                            <span className={`font-semibold ${isOverdue ? 'text-yellow-600' : 'text-charcoal/50'}`}>
                                              {isOverdue ? 'Overdue — ' : ''}{formatDate(assignedDate)}
                                            </span>
                                          </p>
                                        ) : null}
                                      </div>
                                      <span className="text-charcoal/20 text-lg">›</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
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
