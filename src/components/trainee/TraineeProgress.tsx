'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import type { Course, Category, Completion, Workshop, WorkshopCategory, Plate } from '@/types'

interface Props {
  courses: Course[]
  categories: Category[]
  completions: Completion[]
  workshops?: Workshop[]
  workshopCategories?: WorkshopCategory[]
  plates?: Plate[]
}

export function TraineeProgress({ courses, categories, completions, workshops = [], workshopCategories = [], plates = [] }: Props) {
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set())

  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const itemIds = new Set(workshopCategories.filter(wmi => wmi.workshop_id === ws.id).map(wmi => wmi.category_id))
      const wsItems = categories.filter(mi => itemIds.has(mi.id))
      const catIds = [...new Set(wsItems.map(mi => mi.course_id))]
      const wsCats = courses.filter(c => catIds.includes(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, categories: wsCats, items: wsItems }
    }).filter(ws => ws.items.length > 0)
  }, [workshops, workshopCategories, courses, categories])

  const getCourseBreakdown = (workshopId: string, categoryId: string) => {
    const wsItemIds = new Set(workshopCategories.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.category_id))
    const catItems = categories.filter(mi => wsItemIds.has(mi.id) && mi.course_id === categoryId)

    const catComps = completions.filter(c => c.workshop_id === workshopId && catItems.some(mi => mi.id === c.category_id))
    const completed = catComps.filter(c => !c.is_shadowing_moment).length
    const shadowed = catComps.filter(c => c.is_shadowing_moment).length
    const total = catItems.length
    const toDo = total - completed - shadowed

    return { total, completed, shadowed, toDo }
  }

  const getWorkshopBreakdown = (workshopId: string, wsCats: Course[], wsItems: Category[]) => {
    let nrTotal = 0, nrCompleted = 0, nrShadowed = 0
    let coursesCompleted = 0
    const allTraineeRatings: number[] = []

    for (const cat of wsCats) {
      const bd = getCourseBreakdown(workshopId, cat.id)
      nrTotal += bd.total
      nrCompleted += bd.completed
      nrShadowed += bd.shadowed

      const catDone = bd.completed + bd.shadowed >= bd.total
      if (catDone && bd.total > 0) coursesCompleted++

      const courseComps = completions.filter(c => c.workshop_id === workshopId && wsItems.some(mi => mi.id === c.category_id && mi.course_id === cat.id))
      for (const c of courseComps) {
        if (c.trainee_rating != null) allTraineeRatings.push(c.trainee_rating)
      }
    }

    return {
      coursesCompleted,
      coursesTotal: wsCats.length,
      categories: { total: nrTotal, completed: nrCompleted, shadowed: nrShadowed, toDo: nrTotal - nrCompleted - nrShadowed },
      avgTrainee: allTraineeRatings.length > 0 ? (allTraineeRatings.reduce((a, b) => a + b, 0) / allTraineeRatings.length).toFixed(1) : null,
    }
  }

  // Overall stats
  const overallStats = useMemo(() => {
    let total = 0
    let done = 0
    for (const { workshop, items } of workshopHierarchy) {
      total += items.length
      done += items.filter(mi => completions.some(c => c.category_id === mi.id && c.workshop_id === workshop.id)).length
    }
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [workshopHierarchy, completions])

  function toggleWorkshop(id: string) {
    setExpandedWorkshops(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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
            <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Overall</p>
            <p className="font-serif text-4xl text-gold">{overallStats.pct}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{overallStats.done} <span className="text-white/40">of {overallStats.total}</span></p>
            <p className="text-xs text-white/40 mt-0.5">completed</p>
          </div>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${overallStats.pct}%` }} />
        </div>
      </div>

      {/* By workshop */}
      <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">By workshop</h2>
      <div className="space-y-3">
        {workshopHierarchy.map(({ workshop, categories: wsCats, items: wsItems }) => {
          const wsExpanded = expandedWorkshops.has(workshop.id)
          const wsBd = getWorkshopBreakdown(workshop.id, wsCats, wsItems)
          const wsPct = wsBd.categories.total > 0 ? Math.round(((wsBd.categories.completed + wsBd.categories.shadowed) / wsBd.categories.total) * 100) : 0

          return (
            <div key={workshop.id} className="card overflow-hidden">
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
                  <p className="text-[11px] text-charcoal/40 mt-0.5">{wsBd.coursesCompleted} / {wsBd.coursesTotal} courses</p>
                  <p className="text-[11px] text-charcoal/40">
                    {wsBd.categories.completed + wsBd.categories.shadowed} of {wsBd.categories.total} Categories
                    {wsBd.categories.completed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-green-600">{wsBd.categories.completed} Completed</span></>}
                    {wsBd.categories.shadowed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-blue-600">{wsBd.categories.shadowed} Shadowed</span></>}
                    {wsBd.categories.toDo > 0 && <><span className="text-charcoal/30"> | </span><span>{wsBd.categories.toDo} To Do</span></>}
                  </p>
                  {wsBd.avgTrainee && (
                    <p className="text-[11px] text-charcoal/30">My Confidence {wsBd.avgTrainee}</p>
                  )}
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
                    const colour = cat.colour_hex ?? COURSE_COLOURS[cat.name] ?? '#C9A96E'
                    const bd = getCourseBreakdown(workshop.id, cat.id)
                    const catPct = bd.total > 0 ? Math.round(((bd.completed + bd.shadowed) / bd.total) * 100) : 0
                    const courseComps = completions.filter(c => c.workshop_id === workshop.id && categories.some(mi => mi.id === c.category_id && mi.course_id === cat.id))
                    const traineeRatings = courseComps.map(c => c.trainee_rating).filter((r): r is number => r != null)
                    const avgTrainee = traineeRatings.length > 0 ? (traineeRatings.reduce((a, b) => a + b, 0) / traineeRatings.length).toFixed(1) : null

                    return (
                      <div key={cat.id} className="pl-8 pr-4 py-3 border-b border-black/5">
                        <div className="flex items-center gap-3">
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
                            <p className="text-[11px] text-charcoal/40 mt-0.5">
                              {bd.completed + bd.shadowed} of {bd.total} Categories
                              {bd.completed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-green-600">{bd.completed} Completed</span></>}
                              {bd.shadowed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-blue-600">{bd.shadowed} Shadowed</span></>}
                              {bd.toDo > 0 && <><span className="text-charcoal/30"> | </span><span>{bd.toDo} To Do</span></>}
                            </p>
                            {avgTrainee && (
                              <p className="text-[11px] text-charcoal/30 mt-0.5">
                                My Confidence {avgTrainee}
                              </p>
                            )}
                          </div>
                          <div className="w-12 h-1 bg-charcoal/8 rounded-full overflow-hidden flex-shrink-0">
                            <div className="h-full rounded-full transition-all" style={{ width: `${catPct}%`, backgroundColor: colour }} />
                          </div>
                        </div>
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
