'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CATEGORY_COLOURS } from '@/types'
import type { Category, MenuItem, Completion, Workshop, WorkshopMenuItem } from '@/types'

interface Props {
  categories: Category[]
  menuItems: MenuItem[]
  completions: Completion[]
  workshops?: Workshop[]
  workshopMenuItems?: WorkshopMenuItem[]
}

export function TraineeProgress({ categories, menuItems, completions, workshops = [], workshopMenuItems = [] }: Props) {
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set())
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  // Build workshop hierarchy (filtered to visible items only)
  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const itemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === ws.id).map(wmi => wmi.menu_item_id))
      const wsItems = menuItems.filter(mi => itemIds.has(mi.id))
      const catIds = [...new Set(wsItems.map(mi => mi.category_id))]
      const wsCats = categories.filter(c => catIds.includes(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, categories: wsCats, items: wsItems }
    }).filter(ws => ws.items.length > 0)
  }, [workshops, workshopMenuItems, menuItems, categories])

  // Overall stats across all visible workshops
  const totalItems = workshopHierarchy.reduce((sum, ws) => sum + ws.items.length, 0)
  const totalCompleted = workshopHierarchy.reduce((sum, { workshop, items }) => {
    return sum + items.filter(mi => completions.some(c => c.menu_item_id === mi.id && c.workshop_id === workshop.id)).length
  }, 0)
  const overallPercent = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

  const shadowingCount = completions.filter(c => c.is_shadowing_moment).length

  function toggleWorkshop(id: string) {
    setExpandedWorkshops(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">My Progress</h1>
      </div>

      {/* Overall summary card */}
      <div className="card p-5 mb-6 bg-charcoal text-white">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Overall completion</p>
            <p className="font-serif text-4xl text-gold">{overallPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{totalCompleted} <span className="text-white/40">of {totalItems}</span></p>
            <p className="text-xs text-white/40 mt-0.5">items completed</p>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-700"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        {shadowingCount > 0 && (
          <p className="text-xs text-white/40 mt-3">
            Including {shadowingCount} shadowing moment{shadowingCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* By workshop */}
      <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By workshop</h2>
      <div className="space-y-3">
        {workshopHierarchy.map(({ workshop, categories: wsCats, items: wsItems }) => {
          const wsExpanded = expandedWorkshops.has(workshop.id)
          const wsDone = wsItems.filter(mi => completions.some(c => c.menu_item_id === mi.id && c.workshop_id === workshop.id)).length
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

              {/* Courses inside workshop */}
              {wsExpanded && (
                <div className="border-t border-black/5">
                  {wsCats.map(cat => {
                    const courseKey = `${workshop.id}-${cat.id}`
                    const courseExpanded = expandedCourses.has(courseKey)
                    const colour = CATEGORY_COLOURS[cat.name] ?? cat.colour_hex
                    const catItemsInWs = wsItems.filter(mi => mi.category_id === cat.id)
                    const catDone = catItemsInWs.filter(mi => completions.some(c => c.menu_item_id === mi.id && c.workshop_id === workshop.id)).length
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
                            <p className="text-xs text-charcoal/40 mt-0.5">{catDone} of {catTotal} complete</p>
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

                        {/* Categories (menu items) */}
                        {courseExpanded && (
                          <div className="divide-y divide-black/5 bg-charcoal/[0.01]">
                            {catItemsInWs.map(item => {
                              const isCompleted = completions.some(c => c.menu_item_id === item.id && c.workshop_id === workshop.id)
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
    </div>
  )
}
