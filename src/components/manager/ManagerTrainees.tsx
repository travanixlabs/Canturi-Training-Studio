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
  const [selected, setSelected] = useState<User | 'all'>('all')
  const [expandedLevel1, setExpandedLevel1] = useState<Set<string>>(new Set())
  const [expandedLevel2, setExpandedLevel2] = useState<Set<string>>(new Set())
  const [expandedLevel3, setExpandedLevel3] = useState<Set<string>>(new Set())

  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const itemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === ws.id).map(wmi => wmi.menu_item_id))
      const wsItems = menuItems.filter(mi => itemIds.has(mi.id))
      const catIds = [...new Set(wsItems.map(mi => mi.category_id))]
      const wsCats = categories.filter(c => catIds.includes(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, categories: wsCats, items: wsItems }
    })
  }, [workshops, workshopMenuItems, menuItems, categories])

  const getWorkshopCompletions = (traineeId: string, workshopId: string) => {
    const wsItemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.menu_item_id))
    return completions.filter(c => c.trainee_id === traineeId && wsItemIds.has(c.menu_item_id) && c.workshop_id === workshopId)
  }

  const getCourseCompletions = (traineeId: string, workshopId: string, categoryId: string) => {
    const wsItemIds = new Set(workshopMenuItems.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.menu_item_id))
    const catItems = menuItems.filter(mi => wsItemIds.has(mi.id) && mi.category_id === categoryId)
    return catItems.filter(mi => completions.some(c => c.menu_item_id === mi.id && c.trainee_id === traineeId && c.workshop_id === workshopId))
  }

  const overallStats = (traineeId: string) => {
    let total = 0
    let done = 0
    for (const { workshop, items } of workshopHierarchy) {
      total += items.length
      done += getWorkshopCompletions(traineeId, workshop.id).length
    }
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }

  const allTraineeStats = useMemo(() => {
    let total = 0
    let done = 0
    for (const t of trainees) {
      const s = overallStats(t.id)
      total += s.total
      done += s.done
    }
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [trainees, workshopHierarchy, completions])

  function toggle(level: 1 | 2 | 3, key: string) {
    const [setter, resetters] = level === 1
      ? [setExpandedLevel1, [setExpandedLevel2, setExpandedLevel3]]
      : level === 2
      ? [setExpandedLevel2, [setExpandedLevel3]]
      : [setExpandedLevel3, []]
    setter(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    for (const r of resetters) r(new Set())
  }

  function resetExpanded() {
    setExpandedLevel1(new Set())
    setExpandedLevel2(new Set())
    setExpandedLevel3(new Set())
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

  const isAll = selected === 'all'

  return (
    <div className="px-5 py-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-charcoal">Progress</h1>
      </div>

      {/* Pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button
          onClick={() => { setSelected('all'); resetExpanded() }}
          className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex-shrink-0 transition-all ${
            isAll ? 'border-gold bg-gold/10 text-gold' : 'border-charcoal/15 text-charcoal/60'
          }`}
        >
          All
        </button>
        {trainees.map(trainee => (
          <button
            key={trainee.id}
            onClick={() => { setSelected(trainee); resetExpanded() }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium flex-shrink-0 transition-all ${
              !isAll && selected.id === trainee.id
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

      {/* Overall card */}
      {(() => {
        const stats = isAll ? allTraineeStats : overallStats(selected.id)
        return (
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
              <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>
        )
      })()}

      {/* === ALL VIEW: By Trainee → Workshop → Course === */}
      {isAll && (
        <>
          <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By trainee</h2>
          <div className="space-y-3">
            {trainees.map(trainee => {
              const tStats = overallStats(trainee.id)
              const tExpanded = expandedLevel1.has(trainee.id)

              return (
                <div key={trainee.id} className="card overflow-hidden">
                  {/* Trainee header */}
                  <button
                    onClick={() => toggle(1, trainee.id)}
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-charcoal/8 flex items-center justify-center text-sm flex-shrink-0 font-medium">
                      {trainee.avatar_initials}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline">
                        <p className="font-medium text-charcoal text-[15px]">{trainee.name}</p>
                        <p className="text-sm font-medium text-gold">{tStats.pct}%</p>
                      </div>
                      <p className="text-xs text-charcoal/40 mt-0.5">{tStats.done} of {tStats.total} completed</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${tStats.pct}%` }} />
                      </div>
                      {tExpanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                    </div>
                  </button>

                  {/* Workshops inside trainee */}
                  {tExpanded && (
                    <div className="border-t border-black/5">
                      {workshopHierarchy.map(({ workshop, categories: wsCats, items: wsItems }) => {
                        const wsKey = `${trainee.id}-${workshop.id}`
                        const wsExpanded = expandedLevel2.has(wsKey)
                        const wsDone = getWorkshopCompletions(trainee.id, workshop.id).length
                        const wsTotal = wsItems.length
                        const wsPct = wsTotal > 0 ? Math.round((wsDone / wsTotal) * 100) : 0

                        return (
                          <div key={workshop.id}>
                            {/* Workshop header */}
                            <button
                              onClick={() => toggle(2, wsKey)}
                              className="w-full pl-8 pr-4 py-3 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors border-b border-black/5"
                            >
                              <span className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center text-xs flex-shrink-0 text-gold font-serif">
                                W
                              </span>
                              <div className="flex-1">
                                <div className="flex justify-between items-baseline">
                                  <p className="font-medium text-charcoal text-[14px]">{workshop.name}</p>
                                  <p className="text-sm font-medium text-gold">{wsPct}%</p>
                                </div>
                                <p className="text-xs text-charcoal/40 mt-0.5">{wsDone} of {wsTotal}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-1 bg-charcoal/8 rounded-full overflow-hidden">
                                  <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${wsPct}%` }} />
                                </div>
                                {wsExpanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                              </div>
                            </button>

                            {/* Courses inside workshop */}
                            {wsExpanded && (
                              <div className="bg-charcoal/[0.01]">
                                {wsCats.map(cat => {
                                  const courseKey = `${trainee.id}-${workshop.id}-${cat.id}`
                                  const courseExpanded = expandedLevel3.has(courseKey)
                                  const colour = CATEGORY_COLOURS[cat.name] ?? cat.colour_hex
                                  const catItemsInWs = wsItems.filter(mi => mi.category_id === cat.id)
                                  const catDone = getCourseCompletions(trainee.id, workshop.id, cat.id).length
                                  const catTotal = catItemsInWs.length
                                  const catPct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0

                                  return (
                                    <div key={cat.id}>
                                      <button
                                        onClick={() => toggle(3, courseKey)}
                                        className="w-full pl-14 pr-4 py-3 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors border-b border-black/5"
                                      >
                                        <span
                                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                                          style={{ backgroundColor: colour + '20', color: colour }}
                                        >
                                          {cat.icon}
                                        </span>
                                        <div className="flex-1">
                                          <div className="flex justify-between items-baseline">
                                            <p className="text-[13px] text-charcoal">{cat.name}</p>
                                            <p className="text-xs font-medium" style={{ color: colour }}>{catPct}%</p>
                                          </div>
                                          <p className="text-xs text-charcoal/40">{catDone} of {catTotal}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-1 bg-charcoal/8 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${catPct}%`, backgroundColor: colour }} />
                                          </div>
                                          {courseExpanded ? <ChevronUp size={12} className="text-charcoal/30" /> : <ChevronDown size={12} className="text-charcoal/30" />}
                                        </div>
                                      </button>

                                      {courseExpanded && (
                                        <div className="divide-y divide-black/5">
                                          {catItemsInWs.map(item => {
                                            const isCompleted = completions.some(
                                              c => c.menu_item_id === item.id && c.trainee_id === trainee.id && c.workshop_id === workshop.id
                                            )
                                            return (
                                              <div key={item.id} className={`pl-20 pr-4 py-2.5 flex items-center gap-3 ${isCompleted ? 'bg-green-50/30' : ''}`}>
                                                <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[8px] ${isCompleted ? 'border-transparent bg-green-500' : 'border-charcoal/20'}`}>
                                                  {isCompleted && <span className="text-white">✓</span>}
                                                </span>
                                                <p className={`text-[12px] ${isCompleted ? 'text-charcoal/40' : 'text-charcoal'}`}>{item.title}</p>
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
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* === INDIVIDUAL VIEW: By Workshop → Course → Category === */}
      {!isAll && (() => {
        const trainee = selected

        return (
          <>
            <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By workshop</h2>
            <div className="space-y-3">
              {workshopHierarchy.map(({ workshop, categories: wsCats, items: wsItems }) => {
                const wsExpanded = expandedLevel1.has(workshop.id)
                const wsDone = getWorkshopCompletions(trainee.id, workshop.id).length
                const wsTotal = wsItems.length
                const wsPct = wsTotal > 0 ? Math.round((wsDone / wsTotal) * 100) : 0

                return (
                  <div key={workshop.id} className="card overflow-hidden">
                    <button
                      onClick={() => toggle(1, workshop.id)}
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
                          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${wsPct}%` }} />
                        </div>
                        {wsExpanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                      </div>
                    </button>

                    {wsExpanded && (
                      <div className="border-t border-black/5">
                        {wsCats.map(cat => {
                          const courseKey = `${workshop.id}-${cat.id}`
                          const courseExpanded = expandedLevel2.has(courseKey)
                          const colour = CATEGORY_COLOURS[cat.name] ?? cat.colour_hex
                          const catItemsInWs = wsItems.filter(mi => mi.category_id === cat.id)
                          const catDone = getCourseCompletions(trainee.id, workshop.id, cat.id).length
                          const catTotal = catItemsInWs.length
                          const catPct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0

                          return (
                            <div key={cat.id}>
                              <button
                                onClick={() => toggle(2, courseKey)}
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
                                    <div className="h-full rounded-full transition-all" style={{ width: `${catPct}%`, backgroundColor: colour }} />
                                  </div>
                                  {courseExpanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                                </div>
                              </button>

                              {courseExpanded && (
                                <div className="divide-y divide-black/5 bg-charcoal/[0.01]">
                                  {catItemsInWs.map(item => {
                                    const isCompleted = completions.some(
                                      c => c.menu_item_id === item.id && c.trainee_id === trainee.id && c.workshop_id === workshop.id
                                    )
                                    return (
                                      <div key={item.id} className={`pl-14 pr-4 py-3 flex items-center gap-3 ${isCompleted ? 'bg-green-50/30' : ''}`}>
                                        <span className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${isCompleted ? 'border-transparent bg-green-500' : 'border-charcoal/20'}`}>
                                          {isCompleted && <span className="text-white text-[10px]">✓</span>}
                                        </span>
                                        <p className={`text-[13px] ${isCompleted ? 'text-charcoal/40' : 'text-charcoal'}`}>{item.title}</p>
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
