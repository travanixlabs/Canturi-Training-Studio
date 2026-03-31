'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import type { Course, Category, User, Workshop, WorkshopCourse, Subcategory, TrainingTask, TrainingTaskCompletion } from '@/types'

interface Props {
  trainees: User[]
  courses: Course[]
  categories: Category[]
  workshops: Workshop[]
  workshopCourses: WorkshopCourse[]
  subcategories: Subcategory[]
  trainingTasks: TrainingTask[]
  completions: TrainingTaskCompletion[]
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  // Monday = start of week (day 0 = Sun, so offset by 1)
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getCalendarWeeks(): { weekStart: Date; days: Date[] }[] {
  const today = new Date()
  const start = getWeekStart(today)
  const weeks: { weekStart: Date; days: Date[] }[] = []

  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() + w * 7)
    const days: Date[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + d)
      days.push(day)
    }
    weeks.push({ weekStart, days })
  }
  return weeks
}

function formatDayHeader(date: Date) {
  return date.toLocaleDateString('en-AU', { weekday: 'short' })
}

function formatDayNumber(date: Date) {
  return date.getDate()
}

function formatMonth(date: Date) {
  return date.toLocaleDateString('en-AU', { month: 'short' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function BuildPlate({ trainees, courses, categories, workshops, workshopCourses, subcategories, trainingTasks, completions }: Props) {
  const sortedTrainees = useMemo(() =>
    [...trainees].sort((a, b) => a.name.localeCompare(b.name)),
    [trainees]
  )

  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(sortedTrainees[0]?.id ?? '')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ type: 'workshop' | 'course' | 'category' | 'subcategory' | 'task'; id: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'todo' | 'completed'>('all')

  const weeks = useMemo(() => getCalendarWeeks(), [])
  const today = new Date()

  // Completions for selected trainee
  const traineeCompletions = useMemo(() =>
    completions.filter(c => c.trainee_id === selectedTraineeId),
    [completions, selectedTraineeId]
  )

  const getCompletionCount = (taskId: string) => traineeCompletions.filter(c => c.training_task_id === taskId).length

  const getRequiredCount = (task: TrainingTask) =>
    task.is_recurring && task.recurring_count ? task.recurring_count : 1

  const isTaskCompleted = (taskId: string) => {
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return false
    return getCompletionCount(taskId) >= getRequiredCount(task)
  }

  const isSubCompleted = (subId: string) => {
    const tasks = getTasksForSub(subId)
    return tasks.length > 0 && tasks.every(t => isTaskCompleted(t.id))
  }

  const isCatCompleted = (catId: string) => {
    const subs = getSubsForCat(catId)
    return subs.length > 0 && subs.every(s => isSubCompleted(s.id))
  }

  const isCourseCompleted = (courseId: string) => {
    const cats = getCatsForCourse(courseId)
    return cats.length > 0 && cats.every(c => isCatCompleted(c.id))
  }

  const isWorkshopCompleted = (wsId: string) => {
    const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === wsId).map(wc => wc.course_id))
    const wsCourses = courses.filter(c => courseIds.has(c.id))
    return wsCourses.length > 0 && wsCourses.every(c => isCourseCompleted(c.id))
  }

  // Hierarchy helpers
  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === ws.id).map(wc => wc.course_id))
      const wsCourses = courses.filter(c => courseIds.has(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, courses: wsCourses }
    }).filter(ws => ws.courses.length > 0)
  }, [workshops, workshopCourses, courses])

  const getCatsForCourse = (courseId: string) =>
    categories.filter(c => c.course_id === courseId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const getSubsForCat = (catId: string) =>
    subcategories.filter(s => s.category_id === catId).sort((a, b) => a.sort_order - b.sort_order)

  const getTasksForSub = (subId: string) =>
    trainingTasks.filter(t => t.subcategory_id === subId).sort((a, b) => a.sort_order - b.sort_order)

  // Progress stats
  const taskCompletedCount = (t: TrainingTask) => Math.min(getCompletionCount(t.id), getRequiredCount(t))

  const subStats = (subId: string) => {
    const tasks = getTasksForSub(subId)
    return {
      completed: tasks.reduce((sum, t) => sum + taskCompletedCount(t), 0),
      total: tasks.reduce((sum, t) => sum + getRequiredCount(t), 0),
    }
  }

  const catStats = (catId: string) => {
    const subs = getSubsForCat(catId)
    const tasks = subs.flatMap(s => getTasksForSub(s.id))
    return {
      subCompleted: subs.filter(s => isSubCompleted(s.id)).length, subTotal: subs.length,
      taskCompleted: tasks.reduce((sum, t) => sum + taskCompletedCount(t), 0),
      taskTotal: tasks.reduce((sum, t) => sum + getRequiredCount(t), 0),
    }
  }

  const courseStats = (courseId: string) => {
    const cats = getCatsForCourse(courseId)
    const subs = cats.flatMap(c => getSubsForCat(c.id))
    const tasks = subs.flatMap(s => getTasksForSub(s.id))
    return {
      catCompleted: cats.filter(c => isCatCompleted(c.id)).length, catTotal: cats.length,
      subCompleted: subs.filter(s => isSubCompleted(s.id)).length, subTotal: subs.length,
      taskCompleted: tasks.reduce((sum, t) => sum + taskCompletedCount(t), 0),
      taskTotal: tasks.reduce((sum, t) => sum + getRequiredCount(t), 0),
    }
  }

  const workshopStats = (wsId: string) => {
    const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === wsId).map(wc => wc.course_id))
    const wsCourses = courses.filter(c => courseIds.has(c.id))
    const cats = wsCourses.flatMap(c => getCatsForCourse(c.id))
    const subs = cats.flatMap(c => getSubsForCat(c.id))
    const tasks = subs.flatMap(s => getTasksForSub(s.id))
    return {
      courseCompleted: wsCourses.filter(c => isCourseCompleted(c.id)).length, courseTotal: wsCourses.length,
      catCompleted: cats.filter(c => isCatCompleted(c.id)).length, catTotal: cats.length,
      subCompleted: subs.filter(s => isSubCompleted(s.id)).length, subTotal: subs.length,
      taskCompleted: tasks.reduce((sum, t) => sum + taskCompletedCount(t), 0),
      taskTotal: tasks.reduce((sum, t) => sum + getRequiredCount(t), 0),
    }
  }

  // Filter helpers
  const taskMatchesFilter = (taskId: string) =>
    filter === 'all' || (filter === 'completed' ? isTaskCompleted(taskId) : !isTaskCompleted(taskId))

  const getFilteredTasksForSub = (subId: string) =>
    getTasksForSub(subId).filter(t => taskMatchesFilter(t.id))

  const getFilteredSubsForCat = (catId: string) =>
    getSubsForCat(catId).filter(s => getFilteredTasksForSub(s.id).length > 0)

  const getFilteredCatsForCourse = (courseId: string) =>
    getCatsForCourse(courseId).filter(c => getFilteredSubsForCat(c.id).length > 0)

  const filteredWorkshopHierarchy = useMemo(() => {
    if (filter === 'all') return workshopHierarchy
    return workshopHierarchy.map(({ workshop, courses: wsCourses }) => ({
      workshop,
      courses: wsCourses.filter(c => getFilteredCatsForCourse(c.id).length > 0),
    })).filter(ws => ws.courses.length > 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopHierarchy, filter, traineeCompletions])

  // Search
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return null

    const matchFields = (fields: (string | undefined | null)[]) =>
      fields.some(f => f && f.toLowerCase().includes(q))

    type SearchResult = { type: 'course' | 'category' | 'subcategory' | 'task'; id: string; title: string; breadcrumb: string }
    const results: SearchResult[] = []

    for (const course of courses) {
      if (matchFields([course.name, course.icon])) {
        results.push({ type: 'course', id: course.id, title: course.name, breadcrumb: 'Course' })
      }
    }
    for (const cat of categories) {
      const course = courses.find(c => c.id === cat.course_id)
      if (matchFields([cat.title, cat.description])) {
        results.push({ type: 'category', id: cat.id, title: cat.title, breadcrumb: course?.name || 'Category' })
      }
    }
    for (const sub of subcategories) {
      const cat = categories.find(c => c.id === sub.category_id)
      const course = cat ? courses.find(c => c.id === cat.course_id) : null
      if (matchFields([sub.title, sub.content])) {
        results.push({ type: 'subcategory', id: sub.id, title: sub.title, breadcrumb: [course?.name, cat?.title].filter(Boolean).join(' › ') })
      }
    }
    for (const task of trainingTasks) {
      const sub = subcategories.find(s => s.id === task.subcategory_id)
      const cat = sub ? categories.find(c => c.id === sub.category_id) : null
      const course = cat ? courses.find(c => c.id === cat.course_id) : null
      if (matchFields([task.title, task.trainer_type, task.modality, task.role_level, task.priority_level, ...(task.tags ?? [])])) {
        results.push({ type: 'task', id: task.id, title: task.title, breadcrumb: [course?.name, cat?.title, sub?.title].filter(Boolean).join(' › ') })
      }
    }
    return results
  }, [searchQuery, courses, categories, subcategories, trainingTasks])

  // Expand/collapse
  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function getAllKeysForWorkshop(wsId: string) {
    const keys: string[] = [`ws-${wsId}`]
    const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === wsId).map(wc => wc.course_id))
    for (const cId of courseIds) {
      keys.push(`c-${cId}`)
      const cats = getCatsForCourse(cId)
      for (const cat of cats) {
        keys.push(`cat-${cat.id}`)
        const subs = getSubsForCat(cat.id)
        for (const sub of subs) keys.push(`sub-${sub.id}`)
      }
    }
    return keys
  }

  function expandAll(wsId: string) {
    const keys = getAllKeysForWorkshop(wsId)
    setExpanded(prev => { const next = new Set(prev); for (const k of keys) next.add(k); return next })
  }

  function collapseAll(wsId: string) {
    const keys = getAllKeysForWorkshop(wsId)
    setExpanded(prev => { const next = new Set(prev); for (const k of keys) next.delete(k); return next })
  }

  // Selection handlers — expand and select
  function selectWorkshop(wsId: string) {
    toggle(`ws-${wsId}`)
    setSelection({ type: 'workshop', id: wsId })
  }
  function selectCourse(courseId: string) {
    toggle(`c-${courseId}`)
    setSelection({ type: 'course', id: courseId })
  }
  function selectCategory(catId: string) {
    toggle(`cat-${catId}`)
    setSelection({ type: 'category', id: catId })
  }
  function selectSubcategory(subId: string) {
    toggle(`sub-${subId}`)
    setSelection({ type: 'subcategory', id: subId })
  }
  function selectTask(taskId: string) {
    setSelection(selection?.type === 'task' && selection.id === taskId ? null : { type: 'task', id: taskId })
  }

  // Search result selection
  function selectSearchResult(type: string, id: string) {
    setSearchQuery('')
    setSelection({ type: type as 'course' | 'category' | 'subcategory' | 'task', id })
    if (type === 'course') toggle(`c-${id}`)
    else if (type === 'category') toggle(`cat-${id}`)
    else if (type === 'subcategory') toggle(`sub-${id}`)
  }

  return (
    <div className="flex min-h-[calc(100vh-120px)]">
      {/* Left sidebar */}
      <div className="w-80 h-[calc(100vh-120px)] overflow-y-auto sticky top-[120px] border-r border-black/5 bg-white flex-shrink-0">
        <div className="p-4">
          <h1 className="font-serif text-xl text-charcoal mb-1">Training Menu</h1>
          <p className="text-xs text-charcoal/40 mb-3">Browse all training topics</p>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search courses, categories, tasks..."
              className="input pl-9 pr-8 py-2 text-sm w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 mb-4">
            {(['all', 'todo', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-gold text-white'
                    : 'bg-charcoal/5 text-charcoal/40 hover:bg-charcoal/10'
                }`}
              >
                {f === 'all' ? 'All' : f === 'todo' ? 'To Do' : 'Completed'}
              </button>
            ))}
          </div>

          {/* Search results */}
          {searchResults ? (
            <div className="space-y-1">
              {searchResults.length === 0 ? (
                <p className="text-xs text-charcoal/30 text-center py-4">No results found</p>
              ) : (
                <>
                  <p className="text-[10px] text-charcoal/30 mb-2">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</p>
                  {searchResults.map(r => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => selectSearchResult(r.type, r.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-charcoal/3 transition-all"
                    >
                      <p className="text-sm text-charcoal leading-snug">{r.title}</p>
                      <p className="text-[10px] text-charcoal/30 mt-0.5">{r.breadcrumb}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : (

          <div className="space-y-1">
            {filteredWorkshopHierarchy.map(({ workshop, courses: wsCourses }) => {
              const wsKey = `ws-${workshop.id}`
              const wsOpen = expanded.has(wsKey)

              return (
                <div key={workshop.id}>
                  {/* Workshop */}
                  <button
                    onClick={() => selectWorkshop(workshop.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                      selection?.type === 'workshop' && selection.id === workshop.id ? 'bg-gold/10'
                      : isWorkshopCompleted(workshop.id) ? 'bg-green-50'
                      : 'hover:bg-charcoal/3'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] flex-shrink-0 font-serif ${isWorkshopCompleted(workshop.id) ? 'bg-green-100 text-green-700' : 'bg-gold/10 text-gold'}`}>W</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${isWorkshopCompleted(workshop.id) ? 'text-green-700' : 'text-charcoal'}`}>{workshop.name}</span>
                      {(() => { const s = workshopStats(workshop.id); return (
                        <p className="text-[9px] text-charcoal/30 leading-tight mt-0.5">{s.courseCompleted}/{s.courseTotal} courses · {s.catCompleted}/{s.catTotal} categories · {s.subCompleted}/{s.subTotal} subcategories · {s.taskCompleted}/{s.taskTotal} tasks</p>
                      )})()}
                    </div>
                    {wsOpen ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                  </button>

                  <div className="flex gap-2 mt-0.5 mb-1 ml-12">
                    <button onClick={(e) => { e.stopPropagation(); expandAll(workshop.id) }} className="text-[10px] font-medium text-gold hover:text-gold/80 transition-colors">Expand All</button>
                    <span className="text-charcoal/15">|</span>
                    <button onClick={(e) => { e.stopPropagation(); collapseAll(workshop.id) }} className="text-[10px] font-medium text-charcoal/40 hover:text-charcoal/60 transition-colors">Collapse All</button>
                  </div>

                  {wsOpen && (
                    <div className="ml-4 pl-3 border-l border-charcoal/8 mt-1 mb-2 space-y-0.5">
                      {wsCourses.map(course => {
                        const cKey = `c-${course.id}`
                        const cOpen = expanded.has(cKey)
                        const colour = course.colour_hex || COURSE_COLOURS[course.name] || '#C9A96E'
                        const cats = getFilteredCatsForCourse(course.id)

                        return (
                          <div key={course.id}>
                            <button
                              onClick={() => selectCourse(course.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                                selection?.type === 'course' && selection.id === course.id ? 'bg-gold/10'
                                : isCourseCompleted(course.id) ? 'bg-green-50'
                                : 'hover:bg-charcoal/3'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${isCourseCompleted(course.id) ? 'bg-green-200 text-green-700' : ''}`}
                                style={isCourseCompleted(course.id) ? {} : { backgroundColor: colour + '20', color: colour }}
                              >
                                {isCourseCompleted(course.id) ? '✓' : course.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${isCourseCompleted(course.id) ? 'text-green-700' : 'text-charcoal/70'}`}>{course.name}</span>
                                {(() => { const s = courseStats(course.id); return (
                                  <p className="text-[9px] text-charcoal/30 leading-tight mt-0.5">{s.catCompleted}/{s.catTotal} categories · {s.subCompleted}/{s.subTotal} subcategories · {s.taskCompleted}/{s.taskTotal} tasks</p>
                                )})()}
                              </div>
                              {cOpen ? <ChevronUp size={12} className="text-charcoal/20" /> : <ChevronDown size={12} className="text-charcoal/20" />}
                            </button>

                            {cOpen && (
                              <div className="ml-4 pl-3 border-l border-charcoal/8 mt-1 mb-1 space-y-0.5">
                                {cats.map(cat => {
                                  const catKey = `cat-${cat.id}`
                                  const catOpen = expanded.has(catKey)
                                  const subs = getFilteredSubsForCat(cat.id)

                                  return (
                                    <div key={cat.id}>
                                      <button
                                        onClick={() => selectCategory(cat.id)}
                                        className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                                          selection?.type === 'category' && selection.id === cat.id ? 'bg-gold/10'
                                          : isCatCompleted(cat.id) ? 'bg-green-50'
                                          : 'hover:bg-charcoal/3'
                                        }`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <span className={`text-xs ${isCatCompleted(cat.id) ? 'text-green-700 font-medium' : 'text-charcoal/50'}`}>{cat.title}</span>
                                          {(() => { const s = catStats(cat.id); return (
                                            <p className="text-[9px] text-charcoal/30 leading-tight mt-0.5">{s.subCompleted}/{s.subTotal} subcategories · {s.taskCompleted}/{s.taskTotal} tasks</p>
                                          )})()}
                                        </div>
                                        {subs.length > 0 && (
                                          catOpen ? <ChevronUp size={10} className="text-charcoal/20" /> : <ChevronDown size={10} className="text-charcoal/20" />
                                        )}
                                      </button>

                                      {catOpen && subs.length > 0 && (
                                        <div className="ml-3 pl-3 border-l border-charcoal/5 mt-0.5 mb-1 space-y-0.5">
                                          {subs.map(sub => {
                                            const subKey = `sub-${sub.id}`
                                            const subOpen = expanded.has(subKey)
                                            const tasks = getFilteredTasksForSub(sub.id)

                                            return (
                                              <div key={sub.id}>
                                                <button
                                                  onClick={() => selectSubcategory(sub.id)}
                                                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                                                    selection?.type === 'subcategory' && selection.id === sub.id ? 'bg-gold/10'
                                                    : isSubCompleted(sub.id) ? 'bg-green-50'
                                                    : 'hover:bg-charcoal/3'
                                                  }`}
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    <span className={`text-xs ${isSubCompleted(sub.id) ? 'text-green-700 font-medium' : 'text-charcoal/40'}`}>{sub.title}</span>
                                                    {(() => { const s = subStats(sub.id); return (
                                                      <p className="text-[9px] text-charcoal/30 leading-tight mt-0.5">{s.completed}/{s.total} tasks</p>
                                                    )})()}
                                                  </div>
                                                  {tasks.length > 0 && (
                                                    subOpen ? <ChevronUp size={10} className="text-charcoal/15" /> : <ChevronDown size={10} className="text-charcoal/15" />
                                                  )}
                                                </button>

                                                {subOpen && tasks.length > 0 && (
                                                  <div className="ml-2 pl-3 border-l border-charcoal/5 mt-0.5 mb-1 space-y-0.5">
                                                    {tasks.map(task => (
                                                      <button
                                                        key={task.id}
                                                        onClick={() => selectTask(task.id)}
                                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-all flex items-center ${
                                                          selection?.type === 'task' && selection.id === task.id
                                                            ? 'bg-gold/10 text-gold font-medium'
                                                            : isTaskCompleted(task.id)
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'text-charcoal/40 hover:bg-charcoal/3 hover:text-charcoal/60'
                                                        }`}
                                                      >
                                                        <span className="flex-1">{task.title}</span>
                                                        <span className="text-[9px] text-charcoal/30 flex-shrink-0 ml-1">{taskCompletedCount(task)}/{getRequiredCount(task)}</span>
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
      </div>

      {/* Right: trainee pills + calendar */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Trainee pills */}
        <div className="border-b border-black/5 bg-white px-5 py-3 overflow-x-auto flex-shrink-0">
          <div className="flex gap-2">
            {sortedTrainees.map(trainee => (
              <button
                key={trainee.id}
                onClick={() => { setSelectedTraineeId(trainee.id); setSelection(null) }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  selectedTraineeId === trainee.id
                    ? 'bg-gold text-white'
                    : 'bg-charcoal/5 text-charcoal/50 hover:bg-charcoal/10'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                  selectedTraineeId === trainee.id ? 'bg-white/20 text-white' : 'bg-charcoal/10 text-charcoal/40'
                }`}>
                  {trainee.avatar_initials}
                </span>
                {trainee.name.split(' ')[0]}
              </button>
            ))}
            {sortedTrainees.length === 0 && (
              <p className="text-sm text-charcoal/30">No trainees in your boutique</p>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="h-full min-h-[500px] flex flex-col">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-px bg-charcoal/10 rounded-t-xl overflow-hidden">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="bg-charcoal/5 px-3 py-2 text-center">
                  <span className="text-xs font-medium text-charcoal/50">{day}</span>
                </div>
              ))}
            </div>

            {/* Week rows */}
            <div className="flex-1 grid grid-rows-4 gap-px bg-charcoal/10 rounded-b-xl overflow-hidden">
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-px">
                  {week.days.map((day, di) => {
                    const isToday = isSameDay(day, today)
                    return (
                      <div
                        key={di}
                        className={`p-2 flex flex-col min-h-[100px] bg-white ${isToday ? 'ring-2 ring-inset ring-gold/30' : ''}`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`text-xs font-medium ${
                            isToday ? 'text-gold' : 'text-charcoal/40'
                          }`}>
                            {formatDayNumber(day)}
                          </span>
                          {(day.getDate() === 1 || (wi === 0 && di === 0)) && (
                            <span className="text-[10px] text-charcoal/30">{formatMonth(day)}</span>
                          )}
                        </div>
                        {/* Calendar content will go here */}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
