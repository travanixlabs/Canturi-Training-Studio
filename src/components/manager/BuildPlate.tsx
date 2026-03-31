'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Search, X, Info } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import { savePlateAssignments } from '@/app/manager/build-plate/actions'
import type { Course, Category, User, Workshop, WorkshopCourse, Subcategory, TrainingTask, TrainingTaskContent, TrainingTaskCompletion, TrainingTaskAssigned } from '@/types'

interface Props {
  trainees: User[]
  courses: Course[]
  categories: Category[]
  workshops: Workshop[]
  workshopCourses: WorkshopCourse[]
  subcategories: Subcategory[]
  trainingTasks: TrainingTask[]
  taskContent: TrainingTaskContent[]
  completions: TrainingTaskCompletion[]
  assignments: TrainingTaskAssigned[]
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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function BuildPlate({ trainees, courses, categories, workshops, workshopCourses, subcategories, trainingTasks, taskContent, completions, assignments }: Props) {
  const sortedTrainees = useMemo(() =>
    [...trainees].sort((a, b) => a.name.localeCompare(b.name)),
    [trainees]
  )

  const router = useRouter()
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(sortedTrainees[0]?.id ?? '')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ type: 'workshop' | 'course' | 'category' | 'subcategory' | 'task'; id: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'todo' | 'assigned' | 'completed'>('all')
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null)

  // Content helpers
  const getContentForTask = (taskId: string) =>
    taskContent.filter(c => c.training_task_id === taskId).sort((a, b) => a.sort_order - b.sort_order)

  function getEmbedUrl(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return url
  }

  function isEmbeddable(url: string) {
    return url.includes('youtube') || url.includes('vimeo') || url.includes('youtu.be')
  }

  // Plate assignment state
  const buildInitialPlate = useCallback((traineeId: string) => {
    const map: Record<string, string[]> = {}
    for (const a of assignments.filter(a => a.trainee_id === traineeId)) {
      const key = a.assigned_date
      if (!map[key]) map[key] = []
      map[key].push(a.training_task_id)
    }
    return map
  }, [assignments])

  const [localPlate, setLocalPlate] = useState<Record<string, string[]>>(() => buildInitialPlate(sortedTrainees[0]?.id ?? ''))
  const [savedPlate, setSavedPlate] = useState<Record<string, string[]>>(() => buildInitialPlate(sortedTrainees[0]?.id ?? ''))
  const [daySaveStatus, setDaySaveStatus] = useState<Record<string, 'saved' | 'error'>>({})
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    const allDates = new Set([...Object.keys(localPlate), ...Object.keys(savedPlate)])
    for (const date of allDates) {
      const local = (localPlate[date] ?? []).join(',')
      const saved = (savedPlate[date] ?? []).join(',')
      if (local !== saved) return true
    }
    return false
  }, [localPlate, savedPlate])

  // Task lookup map for performance
  const taskMap = useMemo(() => {
    const m = new Map<string, TrainingTask>()
    for (const t of trainingTasks) m.set(t.id, t)
    return m
  }, [trainingTasks])

  // Warn on page leave with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

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

  // Blue status: assigned today or future, not yet completed for that date
  const todayKey = toDateKey(today)

  const traineeAssignments = useMemo(() =>
    assignments.filter(a => a.trainee_id === selectedTraineeId),
    [assignments, selectedTraineeId]
  )

  const isTaskBlue = (taskId: string) => {
    if (isTaskCompleted(taskId)) return false
    const taskAssigns = traineeAssignments.filter(a => a.training_task_id === taskId && a.assigned_date >= todayKey)
    if (taskAssigns.length === 0) return false
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return false
    if (!task.is_recurring) return true
    const completionDates = new Set(traineeCompletions.filter(c => c.training_task_id === taskId).map(c => c.completed_at.split('T')[0]))
    return taskAssigns.some(a => !completionDates.has(a.assigned_date))
  }

  const isSubBlue = (subId: string) => {
    const tasks = getTasksForSub(subId)
    return tasks.length > 0 && tasks.every(t => isTaskCompleted(t.id) || isTaskBlue(t.id)) && tasks.some(t => isTaskBlue(t.id))
  }

  const isCatBlue = (catId: string) => {
    const subs = getSubsForCat(catId)
    return subs.length > 0 && subs.every(s => isSubCompleted(s.id) || isSubBlue(s.id)) && subs.some(s => isSubBlue(s.id))
  }

  const isCourseBlue = (courseId: string) => {
    const cats = getCatsForCourse(courseId)
    return cats.length > 0 && cats.every(c => isCatCompleted(c.id) || isCatBlue(c.id)) && cats.some(c => isCatBlue(c.id))
  }

  const isWorkshopBlue = (wsId: string) => {
    const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === wsId).map(wc => wc.course_id))
    const wsCourses = courses.filter(c => courseIds.has(c.id))
    return wsCourses.length > 0 && wsCourses.every(c => isCourseCompleted(c.id) || isCourseBlue(c.id)) && wsCourses.some(c => isCourseBlue(c.id))
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
  const isTaskAssigned = (taskId: string) => traineeAssignments.some(a => a.training_task_id === taskId)

  const taskMatchesFilter = (taskId: string) => {
    if (filter === 'all') return true
    if (filter === 'completed') return isTaskCompleted(taskId)
    if (filter === 'assigned') return isTaskAssigned(taskId) && !isTaskCompleted(taskId)
    return !isTaskCompleted(taskId) && !isTaskAssigned(taskId)
  }

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
            {(['all', 'todo', 'assigned', 'completed'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-gold text-white'
                    : 'bg-charcoal/5 text-charcoal/40 hover:bg-charcoal/10'
                }`}
              >
                {f === 'all' ? 'All' : f === 'todo' ? 'To Do' : f === 'assigned' ? 'Assigned' : 'Completed'}
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
                      : isWorkshopBlue(workshop.id) ? 'bg-blue-50'
                      : 'hover:bg-charcoal/3'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] flex-shrink-0 font-serif ${isWorkshopCompleted(workshop.id) ? 'bg-green-100 text-green-700' : isWorkshopBlue(workshop.id) ? 'bg-blue-100 text-blue-700' : 'bg-gold/10 text-gold'}`}>W</span>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${isWorkshopCompleted(workshop.id) ? 'text-green-700' : isWorkshopBlue(workshop.id) ? 'text-blue-700' : 'text-charcoal'}`}>{workshop.name}</span>
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
                                : isCourseBlue(course.id) ? 'bg-blue-50'
                                : 'hover:bg-charcoal/3'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${isCourseCompleted(course.id) ? 'bg-green-200 text-green-700' : isCourseBlue(course.id) ? 'bg-blue-200 text-blue-700' : ''}`}
                                style={isCourseCompleted(course.id) || isCourseBlue(course.id) ? {} : { backgroundColor: colour + '20', color: colour }}
                              >
                                {isCourseCompleted(course.id) ? '✓' : course.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className={`text-sm ${isCourseCompleted(course.id) ? 'text-green-700' : isCourseBlue(course.id) ? 'text-blue-700' : 'text-charcoal/70'}`}>{course.name}</span>
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
                                          : isCatBlue(cat.id) ? 'bg-blue-50'
                                          : 'hover:bg-charcoal/3'
                                        }`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <span className={`text-xs ${isCatCompleted(cat.id) ? 'text-green-700 font-medium' : isCatBlue(cat.id) ? 'text-blue-700 font-medium' : 'text-charcoal/50'}`}>{cat.title}</span>
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
                                                    : isSubBlue(sub.id) ? 'bg-blue-50'
                                                    : 'hover:bg-charcoal/3'
                                                  }`}
                                                >
                                                  <div className="flex-1 min-w-0">
                                                    <span className={`text-xs ${isSubCompleted(sub.id) ? 'text-green-700 font-medium' : isSubBlue(sub.id) ? 'text-blue-700 font-medium' : 'text-charcoal/40'}`}>{sub.title}</span>
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
                                                        draggable="true"
                                                        onDragStart={(e) => {
                                                          e.dataTransfer.setData('text/plain', task.id)
                                                          e.dataTransfer.effectAllowed = 'copy'
                                                        }}
                                                        onClick={() => {
                                                          if (selection?.type === 'task' && selection.id === task.id) {
                                                            setPreviewTaskId(task.id)
                                                          } else {
                                                            selectTask(task.id)
                                                          }
                                                        }}
                                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-all flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                                                          selection?.type === 'task' && selection.id === task.id
                                                            ? 'bg-gold/10 text-gold font-medium'
                                                            : isTaskCompleted(task.id)
                                                            ? 'bg-green-50 text-green-700'
                                                            : isTaskBlue(task.id)
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'text-charcoal/40 hover:bg-charcoal/3 hover:text-charcoal/60'
                                                        }`}
                                                      >
                                                        {selection?.type === 'task' && selection.id === task.id && (
                                                          <button
                                                            onClick={(e) => { e.stopPropagation(); setPreviewTaskId(task.id) }}
                                                            className="flex-shrink-0 text-gold/50 hover:text-gold transition-colors"
                                                            title="Click for more details"
                                                          >
                                                            <Info size={16} />
                                                          </button>
                                                        )}
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
                onClick={() => {
                  if (isDirty && !window.confirm('You have unsaved changes. Switch trainee anyway?')) return
                  setSelectedTraineeId(trainee.id)
                  setSelection(null)
                  const plate = buildInitialPlate(trainee.id)
                  setLocalPlate(plate)
                  setSavedPlate(plate)
                  setDaySaveStatus({})
                }}
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
            <div className="ml-auto flex-shrink-0">
              <button
                onClick={async () => {
                  setSaving(true)
                  // Only send dates that have been changed
                  const toSave: Record<string, string[]> = {}
                  const allDates = new Set([...Object.keys(localPlate), ...Object.keys(savedPlate)])
                  for (const date of allDates) {
                    const local = (localPlate[date] ?? []).join(',')
                    const saved = (savedPlate[date] ?? []).join(',')
                    if (local !== saved) {
                      toSave[date] = localPlate[date] ?? []
                    }
                  }
                  if (Object.keys(toSave).length === 0) { setSaving(false); return }
                  const result = await savePlateAssignments(selectedTraineeId, toSave)
                  const newStatus: Record<string, 'saved' | 'error'> = { ...daySaveStatus }
                  for (const d of result.saved) {
                    newStatus[d] = 'saved'
                    setSavedPlate(prev => ({ ...prev, [d]: localPlate[d] ?? [] }))
                  }
                  for (const d of Object.keys(result.errors ?? {})) newStatus[d] = 'error'
                  setDaySaveStatus(newStatus)
                  setSaving(false)
                  router.refresh()
                }}
                disabled={saving || !isDirty}
                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  isDirty
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-charcoal/5 text-charcoal/30 cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
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
                    const dateKey = toDateKey(day)
                    const dayTasks = localPlate[dateKey] ?? []
                    const status = daySaveStatus[dateKey]

                    return (
                      <div
                        key={di}
                        onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateKey) }}
                        onDragEnter={(e) => { e.preventDefault() }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDate(null)
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOverDate(null)
                          const taskId = e.dataTransfer.getData('text/plain')
                          const sourceDate = e.dataTransfer.getData('source-date')
                          if (!taskId || dayTasks.includes(taskId)) return
                          if (sourceDate === dateKey) return // same cell
                          const task = taskMap.get(taskId)
                          if (!task) return
                          // Non-recurring tasks can only appear once (except when moving)
                          if (!task.is_recurring && !sourceDate) {
                            const alreadyAssigned = Object.entries(localPlate).some(([d, ids]) => d !== dateKey && ids.includes(taskId))
                            if (alreadyAssigned) return
                          }
                          setLocalPlate(prev => {
                            const next = { ...prev }
                            // Remove from source date if moving between calendar cells
                            if (sourceDate && next[sourceDate]) {
                              next[sourceDate] = next[sourceDate].filter(id => id !== taskId)
                            }
                            // Add to target date
                            next[dateKey] = [...(next[dateKey] ?? []), taskId]
                            return next
                          })
                          setDaySaveStatus(prev => {
                            const n = { ...prev }
                            delete n[dateKey]
                            if (sourceDate) delete n[sourceDate]
                            return n
                          })
                        }}
                        className={`p-2 flex flex-col min-h-[100px] bg-white transition-all ${
                          isToday ? 'ring-2 ring-inset ring-gold/30' : ''
                        } ${
                          dragOverDate === dateKey ? 'bg-gold/5' : ''
                        } ${
                          status === 'saved' ? 'ring-2 ring-inset ring-green-500 bg-green-50' : ''
                        } ${
                          status === 'error' ? 'ring-2 ring-inset ring-red-500 bg-red-50' : ''
                        }`}
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
                          {dayTasks.length > 0 && (
                            <span className={`text-[9px] ml-auto ${
                              dayTasks.length >= 3 && dayTasks.length <= 6 ? 'text-charcoal/30' : 'text-red-400'
                            }`}>{dayTasks.length}/6</span>
                          )}
                        </div>
                        {/* Task chips */}
                        <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                          {dayTasks.map((taskId, idx) => {
                            const task = taskMap.get(taskId)
                            if (!task) return null
                            const sub = subcategories.find(s => s.id === task.subcategory_id)
                            const cat = sub ? categories.find(c => c.id === sub.category_id) : null
                            const course = cat ? courses.find(c => c.id === cat.course_id) : null
                            const colour = course?.colour_hex || COURSE_COLOURS[course?.name ?? ''] || '#C9A96E'

                            return (
                              <div
                                key={`${taskId}-${idx}`}
                                draggable="true"
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', taskId)
                                  e.dataTransfer.setData('source-date', dateKey)
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs leading-snug group cursor-grab active:cursor-grabbing"
                                style={{ backgroundColor: colour + '15', color: colour }}
                              >
                                <span className="flex-1">{task.title}</span>
                                <button
                                  onClick={() => {
                                    setLocalPlate(prev => ({
                                      ...prev,
                                      [dateKey]: (prev[dateKey] ?? []).filter(id => id !== taskId)
                                    }))
                                    setDaySaveStatus(prev => { const n = { ...prev }; delete n[dateKey]; return n })
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Task preview overlay */}
      {previewTaskId && (() => {
        const task = taskMap.get(previewTaskId)
        if (!task) return null
        const sub = subcategories.find(s => s.id === task.subcategory_id)
        const cat = sub ? categories.find(c => c.id === sub.category_id) : null
        const course = cat ? courses.find(c => c.id === cat.course_id) : null
        const content = getContentForTask(task.id)

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setPreviewTaskId(null)}>
            <div className="fixed inset-0 bg-black/30" />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b border-black/5 flex items-start justify-between">
                <div>
                  <p className="text-xs text-charcoal/30 mb-1">
                    {course && <span>{course.name} &rsaquo; </span>}
                    {cat && <span>{cat.title} &rsaquo; </span>}
                    {sub && <span>{sub.title}</span>}
                  </p>
                  <h2 className="font-serif text-lg text-charcoal">{task.title}</h2>
                </div>
                <button onClick={() => setPreviewTaskId(null)} className="p-1 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {task.trainer_type && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.trainer_type}</span>}
                  {task.modality && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.modality}</span>}
                  {task.role_level && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.role_level}</span>}
                  {task.priority_level && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.priority_level}</span>}
                  {task.is_recurring && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">Recurring ×{task.recurring_count}</span>}
                  {(task.tags ?? []).map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{tag}</span>
                  ))}
                </div>

                {/* Content */}
                {content.length > 0 && (
                  <div className="space-y-4">
                    {content.map(c => (
                      <div key={c.id}>
                        {c.title && c.type !== 'text' && <p className="text-xs font-medium text-charcoal/50 mb-1.5">{c.title}</p>}
                        {c.type === 'text' && c.url && <div className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{c.url}</div>}
                        {c.type === 'webpage' && c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold/80 underline underline-offset-2 break-all">{c.url}</a>}
                        {c.type === 'image' && c.url && <img src={c.url} alt={c.title || ''} className="max-w-full rounded-lg border border-black/5" />}
                        {c.type === 'video' && c.url && (
                          isEmbeddable(c.url) ? (
                            <div className="rounded-lg overflow-hidden" style={{ height: '320px' }}>
                              <iframe src={getEmbedUrl(c.url)} className="w-full h-full border-0" title={c.title || 'Video'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                          ) : <video src={c.url} controls className="max-w-full rounded-lg" />
                        )}
                        {c.type === 'pdf' && c.url && (
                          <div className="rounded-lg overflow-hidden border border-black/5" style={{ height: '400px' }}>
                            <iframe src={c.url} className="w-full h-full border-0" title={c.title || 'PDF'} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {content.length === 0 && (
                  <p className="text-sm text-charcoal/30 text-center py-4">No content attached to this task</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
