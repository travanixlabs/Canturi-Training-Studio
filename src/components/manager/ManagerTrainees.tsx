'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import type { User, Course, Category, Completion, Plate, VisibleCourse, Workshop, WorkshopCategory } from '@/types'

interface Props {
  trainees: User[]
  courses: Course[]
  categories: Category[]
  completions: Completion[]
  plates?: Plate[]
  visibleCategories?: VisibleCourse[]
  workshops?: Workshop[]
  workshopCategories?: WorkshopCategory[]
}

export function ManagerTrainees({ trainees, courses, categories, completions, plates = [], visibleCategories = [], workshops = [], workshopCategories = [] }: Props) {
  const [selected, setSelected] = useState<User | 'all'>('all')
  const [expandedLevel1, setExpandedLevel1] = useState<Set<string>>(new Set())
  const [expandedLevel2, setExpandedLevel2] = useState<Set<string>>(new Set())
  const [expandedLevel3, setExpandedLevel3] = useState<Set<string>>(new Set())

  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const itemIds = new Set(workshopCategories.filter(wmi => wmi.workshop_id === ws.id).map(wmi => wmi.category_id))
      const wsItems = categories.filter(mi => itemIds.has(mi.id))
      const catIds = [...new Set(wsItems.map(mi => mi.course_id))]
      const wsCats = courses.filter(c => catIds.includes(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, categories: wsCats, items: wsItems }
    })
  }, [workshops, workshopCategories, courses, categories])

  const getWorkshopCompletions = (traineeId: string, workshopId: string) => {
    const wsItemIds = new Set(workshopCategories.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.category_id))
    return completions.filter(c => c.trainee_id === traineeId && wsItemIds.has(c.category_id) && c.workshop_id === workshopId)
  }

  const getCourseCompletions = (traineeId: string, workshopId: string, categoryId: string) => {
    const wsItemIds = new Set(workshopCategories.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.category_id))
    const catItems = categories.filter(mi => wsItemIds.has(mi.id) && mi.course_id === categoryId)
    return catItems.filter(mi => completions.some(c => c.category_id === mi.id && c.trainee_id === traineeId && c.workshop_id === workshopId))
  }

  // Detailed course breakdown
  const getCourseBreakdown = (traineeId: string, workshopId: string, categoryId: string) => {
    const wsItemIds = new Set(workshopCategories.filter(wmi => wmi.workshop_id === workshopId).map(wmi => wmi.category_id))
    const catItems = categories.filter(mi => wsItemIds.has(mi.id) && mi.course_id === categoryId)

    const catComps = completions.filter(c => c.trainee_id === traineeId && c.workshop_id === workshopId && catItems.some(mi => mi.id === c.category_id))
    const nrCompleted = catComps.filter(c => !c.is_shadowing_moment).length
    const nrShadowed = catComps.filter(c => c.is_shadowing_moment).length
    const nrTotal = catItems.length
    const nrToDo = nrTotal - nrCompleted - nrShadowed

    return {
      categories: { total: nrTotal, completed: nrCompleted, shadowed: nrShadowed, toDo: nrToDo },
    }
  }

  // Workshop-level aggregated breakdown
  const getWorkshopBreakdown = (traineeId: string, workshopId: string, wsCats: Course[], wsItems: Category[]) => {
    let nrTotal = 0, nrCompleted = 0, nrShadowed = 0
    let coursesCompleted = 0
    const allTraineeRatings: number[] = []
    const allTrainerRatings: number[] = []

    for (const cat of wsCats) {
      const bd = getCourseBreakdown(traineeId, workshopId, cat.id)
      nrTotal += bd.categories.total
      nrCompleted += bd.categories.completed
      nrShadowed += bd.categories.shadowed

      const catDone = bd.categories.completed + bd.categories.shadowed >= bd.categories.total
      if (catDone && bd.categories.total > 0) coursesCompleted++

      // Ratings
      const courseComps = completions.filter(c => c.trainee_id === traineeId && c.workshop_id === workshopId && wsItems.some(mi => mi.id === c.category_id && mi.course_id === cat.id))
      for (const c of courseComps) {
        if (c.trainee_rating != null) allTraineeRatings.push(c.trainee_rating)
        if (c.trainer_rating != null) allTrainerRatings.push(c.trainer_rating)
      }
    }

    return {
      coursesCompleted,
      coursesTotal: wsCats.length,
      categories: { total: nrTotal, completed: nrCompleted, shadowed: nrShadowed, toDo: nrTotal - nrCompleted - nrShadowed },
      avgTrainee: allTraineeRatings.length > 0 ? (allTraineeRatings.reduce((a, b) => a + b, 0) / allTraineeRatings.length).toFixed(1) : null,
      avgTrainer: allTrainerRatings.length > 0 ? (allTrainerRatings.reduce((a, b) => a + b, 0) / allTrainerRatings.length).toFixed(1) : null,
    }
  }

  const overallStats = (traineeId: string) => {
    let total = 0
    let done = 0
    let workshopsTotal = 0, workshopsCompleted = 0
    let coursesTotal = 0, coursesCompleted = 0
    let nrTotal = 0, nrCompleted = 0, nrShadowed = 0

    for (const { workshop, categories: wsCats, items: wsItems } of workshopHierarchy) {
      total += wsItems.length
      done += getWorkshopCompletions(traineeId, workshop.id).length
      workshopsTotal++

      const wsBd = getWorkshopBreakdown(traineeId, workshop.id, wsCats, wsItems)
      coursesTotal += wsBd.coursesTotal
      coursesCompleted += wsBd.coursesCompleted
      nrTotal += wsBd.categories.total
      nrCompleted += wsBd.categories.completed
      nrShadowed += wsBd.categories.shadowed

      // Workshop is complete if all courses are complete
      if (wsBd.coursesCompleted >= wsBd.coursesTotal && wsBd.coursesTotal > 0) workshopsCompleted++
    }

    return {
      total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0,
      workshopsTotal, workshopsCompleted,
      coursesTotal, coursesCompleted,
      categories: { total: nrTotal, completed: nrCompleted, shadowed: nrShadowed, toDo: nrTotal - nrCompleted - nrShadowed },
    }
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
                      <p className="text-[11px] text-charcoal/40 mt-0.5">{tStats.workshopsCompleted} / {tStats.workshopsTotal} Workshops</p>
                      <p className="text-[11px] text-charcoal/40">{tStats.coursesCompleted} / {tStats.coursesTotal} Courses</p>
                      <p className="text-[11px] text-charcoal/40">
                        {tStats.categories.completed + tStats.categories.shadowed} of {tStats.categories.total} Categories
                        {tStats.categories.completed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-green-600">{tStats.categories.completed} Completed</span></>}
                        {tStats.categories.shadowed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-blue-600">{tStats.categories.shadowed} Shadowed</span></>}
                        {tStats.categories.toDo > 0 && <><span className="text-charcoal/30"> | </span><span>{tStats.categories.toDo} To Do</span></>}
                      </p>
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
                        const wsBd = getWorkshopBreakdown(trainee.id, workshop.id, wsCats, wsItems)
                        const wsPct = wsBd.categories.total > 0 ? Math.round(((wsBd.categories.completed + wsBd.categories.shadowed) / wsBd.categories.total) * 100) : 0

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
                                <p className="text-[11px] text-charcoal/40 mt-0.5">{wsBd.coursesCompleted} / {wsBd.coursesTotal} courses</p>
                                <p className="text-[11px] text-charcoal/40">
                                  {wsBd.categories.completed + wsBd.categories.shadowed} of {wsBd.categories.total} Categories
                                  {wsBd.categories.completed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-green-600">{wsBd.categories.completed} Completed</span></>}
                                  {wsBd.categories.shadowed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-blue-600">{wsBd.categories.shadowed} Shadowed</span></>}
                                  {wsBd.categories.toDo > 0 && <><span className="text-charcoal/30"> | </span><span>{wsBd.categories.toDo} To Do</span></>}
                                </p>
                                {(wsBd.avgTrainee || wsBd.avgTrainer) && (
                                  <p className="text-[11px] text-charcoal/30">
                                    {wsBd.avgTrainee && <span>Trainee Rating {wsBd.avgTrainee}</span>}
                                    {wsBd.avgTrainee && wsBd.avgTrainer && <span> | </span>}
                                    {wsBd.avgTrainer && <span>Manager Rating {wsBd.avgTrainer}</span>}
                                  </p>
                                )}
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
                                  const colour = cat.colour_hex ?? COURSE_COLOURS[cat.name] ?? '#C9A96E'
                                  const bd = getCourseBreakdown(trainee.id, workshop.id, cat.id)
                                  const catPct = bd.categories.total > 0 ? Math.round(((bd.categories.completed + bd.categories.shadowed) / bd.categories.total) * 100) : 0
                                  const courseComps = completions.filter(c => c.trainee_id === trainee.id && c.workshop_id === workshop.id && categories.some(mi => mi.id === c.category_id && mi.course_id === cat.id))
                                  const traineeRatings = courseComps.map(c => c.trainee_rating).filter((r): r is number => r != null)
                                  const trainerRatings = courseComps.map(c => c.trainer_rating).filter((r): r is number => r != null)
                                  const avgTrainee = traineeRatings.length > 0 ? (traineeRatings.reduce((a, b) => a + b, 0) / traineeRatings.length).toFixed(1) : null
                                  const avgTrainer = trainerRatings.length > 0 ? (trainerRatings.reduce((a, b) => a + b, 0) / trainerRatings.length).toFixed(1) : null

                                  return (
                                    <div key={cat.id} className="pl-14 pr-4 py-3 border-b border-black/5">
                                      <div className="flex items-center gap-3">
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
                                          <p className="text-[11px] text-charcoal/40 mt-0.5">
                                            {bd.categories.completed + bd.categories.shadowed} of {bd.categories.total} Categories
                                            {bd.categories.completed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-green-600">{bd.categories.completed} Completed</span></>}
                                            {bd.categories.shadowed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-blue-600">{bd.categories.shadowed} Shadowed</span></>}
                                            {bd.categories.toDo > 0 && <><span className="text-charcoal/30"> | </span><span>{bd.categories.toDo} To Do</span></>}
                                          </p>
                                          {(avgTrainee || avgTrainer) && (
                                            <p className="text-[11px] text-charcoal/30 mt-0.5">
                                              {avgTrainee && <span>Trainee Rating {avgTrainee}</span>}
                                              {avgTrainee && avgTrainer && <span> | </span>}
                                              {avgTrainer && <span>Manager Rating {avgTrainer}</span>}
                                            </p>
                                          )}
                                        </div>
                                        <div className="w-10 h-1 bg-charcoal/8 rounded-full overflow-hidden flex-shrink-0">
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
                const wsBd = getWorkshopBreakdown(trainee.id, workshop.id, wsCats, wsItems)
                const wsPct = wsBd.categories.total > 0 ? Math.round(((wsBd.categories.completed + wsBd.categories.shadowed) / wsBd.categories.total) * 100) : 0

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
                        <p className="text-[11px] text-charcoal/40 mt-0.5">{wsBd.coursesCompleted} / {wsBd.coursesTotal} courses</p>
                        <p className="text-[11px] text-charcoal/40">
                          {wsBd.categories.completed + wsBd.categories.shadowed} of {wsBd.categories.total} Categories
                          {wsBd.categories.completed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-green-600">{wsBd.categories.completed} Completed</span></>}
                          {wsBd.categories.shadowed > 0 && <><span className="text-charcoal/30"> | </span><span className="text-blue-600">{wsBd.categories.shadowed} Shadowed</span></>}
                          {wsBd.categories.toDo > 0 && <><span className="text-charcoal/30"> | </span><span>{wsBd.categories.toDo} To Do</span></>}
                        </p>
                        {(wsBd.avgTrainee || wsBd.avgTrainer) && (
                          <p className="text-[11px] text-charcoal/30">
                            {wsBd.avgTrainee && <span>Trainee Rating {wsBd.avgTrainee}</span>}
                            {wsBd.avgTrainee && wsBd.avgTrainer && <span> | </span>}
                            {wsBd.avgTrainer && <span>Manager Rating {wsBd.avgTrainer}</span>}
                          </p>
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
                          const bd = getCourseBreakdown(trainee.id, workshop.id, cat.id)
                          const catPct = bd.categories.total > 0 ? Math.round(((bd.categories.completed + bd.categories.shadowed) / bd.categories.total) * 100) : 0
                          const courseComps = completions.filter(c => c.trainee_id === trainee.id && c.workshop_id === workshop.id && categories.some(mi => mi.id === c.category_id && mi.course_id === cat.id))
                          const traineeRatings = courseComps.map(c => c.trainee_rating).filter((r): r is number => r != null)
                          const trainerRatings = courseComps.map(c => c.trainer_rating).filter((r): r is number => r != null)
                          const avgTrainee = traineeRatings.length > 0 ? (traineeRatings.reduce((a, b) => a + b, 0) / traineeRatings.length).toFixed(1) : null
                          const avgTrainer = trainerRatings.length > 0 ? (trainerRatings.reduce((a, b) => a + b, 0) / trainerRatings.length).toFixed(1) : null

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
                                    {bd.categories.completed + bd.categories.shadowed} of {bd.categories.total} Categories
                                    {bd.categories.completed > 0 && <span className="text-green-600"> | {bd.categories.completed} Completed</span>}
                                    {bd.categories.shadowed > 0 && <span className="text-blue-600"> | {bd.categories.shadowed} Shadowed</span>}
                                    {bd.categories.toDo > 0 && <span> | {bd.categories.toDo} To Do</span>}
                                  </p>
                                  {(avgTrainee || avgTrainer) && (
                                    <p className="text-[11px] text-charcoal/30 mt-0.5">
                                      {avgTrainee && <span>Trainee Rating {avgTrainee}</span>}
                                      {avgTrainee && avgTrainer && <span> | </span>}
                                      {avgTrainer && <span>Manager Rating {avgTrainer}</span>}
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
          </>
        )
      })()}
    </div>
  )
}
