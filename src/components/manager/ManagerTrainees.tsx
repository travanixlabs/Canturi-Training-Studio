'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORY_COLOURS } from '@/types'
import type { User, Category, MenuItem, Completion, Plate, VisibleCategory, Workshop, WorkshopMenuItem } from '@/types'

interface Props {
  trainees: User[]
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
  plates?: Plate[]
  visibleCategories?: VisibleCategory[]
  workshops?: Workshop[]
  workshopMenuItems?: WorkshopMenuItem[]
}

export function ManagerTrainees({ trainees, categories, menuItems, completions, plates = [], visibleCategories = [], workshops = [], workshopMenuItems = [] }: Props) {
  const [selected, setSelected] = useState<User | null>(trainees[0] ?? null)
  const [expandedProgress, setExpandedProgress] = useState<Set<string>>(new Set())
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  // Build workshop hierarchy
  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const itemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === ws.id).map(wmi => wmi.menu_item_id))
      const wsItems = menuItems.filter(mi => itemIds.has(mi.id))
      const catIds = [...new Set(wsItems.map(mi => mi.category_id))]
      const wsCats = categories.filter(c => catIds.includes(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, categories: wsCats, menuItemIds: itemIds, items: wsItems }
    })
  }, [workshops, workshopMenuItems, menuItems, categories])

  // Workshop-scoped helpers
  const getWorkshopCompletions = (traineeId: string, workshopId: string) => {
    const wsItemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.menu_item_id))
    return completions.filter(c => c.trainee_id === traineeId && wsItemIds.has(c.menu_item_id) && c.workshop_id === workshopId)
  }

  const getCourseCompletions = (traineeId: string, workshopId: string, categoryId: string) => {
    const wsItemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.menu_item_id))
    const catItems = menuItems.filter(mi => wsItemIds.has(mi.id) && mi.category_id === categoryId)
    return catItems.filter(mi => completions.some(c => c.menu_item_id === mi.id && c.trainee_id === traineeId && c.workshop_id === workshopId))
  }

  // Overall across all workshops
  const overallStats = (traineeId: string) => {
    let total = 0
    let done = 0
    for (const { workshop, items } of workshopHierarchy) {
      total += items.length
      done += getWorkshopCompletions(traineeId, workshop.id).length
    }
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }

  function toggleWorkshop(id: string) {
    setExpandedProgress(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // Collapse all courses when toggling workshop
    setExpandedCourses(new Set())
  }

  function toggleCourse(key: string) {
    setExpandedCourses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (trainees.length === 0) {
    return (
      <div className="px-5 py-6">
        <h1 className="font-serif text-2xl text-charcoal mb-4">Progress</h1>
        <div className="card p-6 text-center">
          <p className="text-charcoal/40 text-sm">No active employees in your boutique.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-charcoal">Progress</h1>
      </div>

      {/* Trainee tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {trainees.map(trainee => (
          <button
            key={trainee.id}
            onClick={() => { setSelected(trainee); setExpandedProgress(new Set()); setExpandedCourses(new Set()) }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium flex-shrink-0 transition-all ${
              selected?.id === trainee.id
                ? 'border-gold bg-gold/10 text-gold'
                : 'border-charcoal/15 text-charcoal/60'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs">
              {trainee.avatar_initials}
            </span>
            {trainee.name}
          </button>
        ))}
      </div>

      {selected && (() => {
        const stats = overallStats(selected.id)

        return stats.total === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-charcoal/40 text-sm">No categories assigned to {selected.name.split(' ')[0]} yet.</p>
          </div>
        ) : (
          <>
            {/* Overall */}
            <div className="card p-5 mb-4 bg-charcoal text-white">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Overall</p>
                  <p className="font-serif text-4xl text-gold">{stats.pct}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{stats.done} <span className="text-white/40">of {stats.total}</span></p>
                  <p className="text-xs text-white/40 mt-0.5">completed</p>
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full transition-all"
                  style={{ width: `${stats.pct}%` }}
                />
              </div>
            </div>

            {/* By workshop */}
            <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By workshop</h2>
            <div className="space-y-3">
              {workshopHierarchy.map(({ workshop, categories: wsCats, items: wsItems }) => {
                const wsExpanded = expandedProgress.has(workshop.id)
                const wsDone = getWorkshopCompletions(selected.id, workshop.id).length
                const wsTotal = wsItems.length
                const wsPct = wsTotal > 0 ? Math.round((wsDone / wsTotal) * 100) : 0

                return (
                  <div key={workshop.id} className="card overflow-hidden">
                    {/* Workshop header */}
                    <button
                      onClick={() => toggleWorkshop(workshop.id)}
                      className="w-full p-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                    >
                      <span className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-sm flex-shrink-0 text-gold font-serif">
                        W
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between items-baseline">
                          <p className="font-serif font-medium text-charcoal text-[15px]">{workshop.name}</p>
                          <p className="text-sm font-medium text-gold">{wsPct}%</p>
                        </div>
                        <p className="text-xs text-charcoal/40 mt-0.5">{wsDone} of {wsTotal} · {wsCats.length} course{wsCats.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold rounded-full transition-all"
                            style={{ width: `${wsPct}%` }}
                          />
                        </div>
                        {wsExpanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                      </div>
                    </button>

                    {/* Courses inside workshop — always expanded when workshop is expanded */}
                    {wsExpanded && (
                      <div className="border-t border-black/5">
                        {wsCats.map(cat => {
                          const courseKey = `${workshop.id}-${cat.id}`
                          const courseExpanded = expandedCourses.has(courseKey)
                          const colour = CATEGORY_COLOURS[cat.name] ?? cat.colour_hex
                          const catItemsInWs = wsItems.filter(mi => mi.category_id === cat.id)
                          const catDone = getCourseCompletions(selected.id, workshop.id, cat.id).length
                          const catTotal = catItemsInWs.length
                          const catPct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0

                          return (
                            <div key={cat.id}>
                              {/* Course header */}
                              <button
                                onClick={() => toggleCourse(courseKey)}
                                className="w-full pl-8 pr-4 py-3 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors border-b border-black/5"
                              >
                                <span
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                                  style={{ backgroundColor: colour + '20', color: colour }}
                                >
                                  {cat.icon}
                                </span>
                                <div className="flex-1">
                                  <div className="flex justify-between items-baseline">
                                    <p className="font-medium text-charcoal text-[14px]">{cat.name}</p>
                                    <p className="text-sm font-medium" style={{ color: colour }}>{catPct}%</p>
                                  </div>
                                  <p className="text-xs text-charcoal/40 mt-0.5">{catDone} of {catTotal}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-1 bg-charcoal/8 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{ width: `${catPct}%`, backgroundColor: colour }}
                                    />
                                  </div>
                                  {courseExpanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                                </div>
                              </button>

                              {/* Categories (menu items) inside course */}
                              {courseExpanded && (
                                <div className="divide-y divide-black/5 bg-charcoal/[0.01]">
                                  {catItemsInWs.map(item => {
                                    const isCompleted = completions.some(
                                      c => c.menu_item_id === item.id && c.trainee_id === selected.id && c.workshop_id === workshop.id
                                    )
                                    return (
                                      <div
                                        key={item.id}
                                        className={`pl-14 pr-4 py-3 flex items-center gap-3 ${isCompleted ? 'bg-green-50/30' : ''}`}
                                      >
                                        <span
                                          className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                                            isCompleted ? 'border-transparent bg-green-500' : 'border-charcoal/20'
                                          }`}
                                        >
                                          {isCompleted && <span className="text-white text-[10px]">✓</span>}
                                        </span>
                                        <p className={`text-[13px] ${isCompleted ? 'text-charcoal/40' : 'text-charcoal'}`}>
                                          {item.title}
                                        </p>
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
                )
              })}
            </div>
          </>
        )
      })()}
    </div>
  )
}
