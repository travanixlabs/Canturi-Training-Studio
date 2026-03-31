'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, BookOpen, Check, Search, X } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Course, Category, User, Workshop, WorkshopCourse, Subcategory, TrainingTask, TrainingTaskContent, TrainingTaskCompletion, TrainingTaskAssigned } from '@/types'

interface Props {
  courses: Course[]
  categories: Category[]
  currentUser: User
  workshops?: Workshop[]
  workshopCourses?: WorkshopCourse[]
  subcategories?: Subcategory[]
  trainingTasks?: TrainingTask[]
  taskContent?: TrainingTaskContent[]
  completions?: TrainingTaskCompletion[]
  assignments?: TrainingTaskAssigned[]
}

export function TraineeMenu({ courses, categories, currentUser, workshops = [], workshopCourses = [], subcategories = [], trainingTasks = [], taskContent = [], completions: initialCompletions = [], assignments = [] }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ type: 'workshop' | 'course' | 'category' | 'subcategory' | 'task'; id: string } | null>(null)
  const [completions, setCompletions] = useState<TrainingTaskCompletion[]>(initialCompletions)
  const [completing, setCompleting] = useState(false)
  const [completionOverlay, setCompletionOverlay] = useState<string | null>(null) // task id
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'todo' | 'completed'>('all')
  const supabase = createClient()
  const router = useRouter()

  const getCompletionCount = (taskId: string) => completions.filter(c => c.training_task_id === taskId).length

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
  const todayKey = new Date().toISOString().split('T')[0]

  const isTaskBlue = (taskId: string) => {
    if (isTaskCompleted(taskId)) return false
    const taskAssignments = assignments.filter(a => a.training_task_id === taskId && a.assigned_date >= todayKey)
    if (taskAssignments.length === 0) return false
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return false
    if (!task.is_recurring) return true // assigned today/future and not completed
    // Recurring: check if any assigned date today/future has no completion on that date
    const completionDates = new Set(completions.filter(c => c.training_task_id === taskId).map(c => c.completed_at.split('T')[0]))
    return taskAssignments.some(a => !completionDates.has(a.assigned_date))
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

  async function submitCompletion(taskId: string, data: { takeaways: string; summary: string; confidence_rating: number | null; certificate_reference: string | null; certificate_url: string | null }) {
    setCompleting(true)
    const { data: result, error } = await supabase.from('training_task_completions').insert({
      training_task_id: taskId,
      trainee_id: currentUser.id,
      ...data,
    }).select().single()
    if (error) {
      alert('Failed to save completion: ' + error.message)
      setCompleting(false)
      return
    }
    if (result) {
      setCompletions(prev => [...prev, result as TrainingTaskCompletion])
    }
    setCompleting(false)
    setCompletionOverlay(null)
  }

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Build hierarchy
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

  const getContentForTask = (taskId: string) =>
    taskContent.filter(c => c.training_task_id === taskId).sort((a, b) => a.sort_order - b.sort_order)

  // Filtered getters for sidebar (respects filter pills)
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
  }, [workshopHierarchy, filter, completions])

  // Progress stats helpers — recurring tasks count as their recurring_count value
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

  function getAllKeysForWorkshop(wsId: string) {
    const keys: string[] = [`ws-${wsId}`]
    const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === wsId).map(wc => wc.course_id))
    for (const cId of courseIds) {
      keys.push(`c-${cId}`)
      const cats = getCatsForCourse(cId)
      for (const cat of cats) {
        keys.push(`cat-${cat.id}`)
        const subs = getSubsForCat(cat.id)
        for (const sub of subs) {
          keys.push(`sub-${sub.id}`)
        }
      }
    }
    return keys
  }

  function expandAll(wsId: string) {
    const keys = getAllKeysForWorkshop(wsId)
    setExpanded(prev => {
      const next = new Set(prev)
      for (const k of keys) next.add(k)
      return next
    })
  }

  function collapseAll(wsId: string) {
    const keys = getAllKeysForWorkshop(wsId)
    setExpanded(prev => {
      const next = new Set(prev)
      for (const k of keys) next.delete(k)
      return next
    })
  }

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

  // Resolve selected item
  const selWorkshop = selection?.type === 'workshop' ? workshops.find(w => w.id === selection.id) : null
  const selCourse = selection?.type === 'course' ? courses.find(c => c.id === selection.id) : null
  const selCategory = selection?.type === 'category' ? categories.find(c => c.id === selection.id) : null
  const selSubcategory = selection?.type === 'subcategory' ? subcategories.find(s => s.id === selection.id) : null
  const selTask = selection?.type === 'task' ? trainingTasks.find(t => t.id === selection.id) : null
  const selTaskSub = selTask ? subcategories.find(s => s.id === selTask.subcategory_id) : null
  const selTaskCat = selTaskSub ? categories.find(c => c.id === selTaskSub.category_id) : null

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-120px)]">
      {/* Left sidebar */}
      <div className="lg:w-80 lg:h-[calc(100vh-120px)] lg:overflow-y-auto lg:sticky lg:top-[120px] lg:border-r border-b lg:border-b-0 border-black/5 bg-white">
        <div className="p-4">
          <h1 className="font-serif text-xl text-charcoal mb-1">Training Menu</h1>
          <p className="text-xs text-charcoal/40 mb-3">Browse all training topics</p>

          {/* Search */}
          <div className="relative mb-4">
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
                      onClick={() => { setSelection({ type: r.type, id: r.id }); setSearchQuery('') }}
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
                    onClick={() => { toggle(wsKey); setSelection({ type: 'workshop', id: workshop.id }) }}
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
                            {/* Course */}
                            <button
                              onClick={() => { toggle(cKey); setSelection({ type: 'course', id: course.id }) }}
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
                                      {/* Category */}
                                      <button
                                        onClick={() => { toggle(catKey); setSelection({ type: 'category', id: cat.id }) }}
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
                                                {/* Subcategory */}
                                                <button
                                                  onClick={() => { toggle(subKey); setSelection({ type: 'subcategory', id: sub.id }) }}
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
                                                    {tasks.map(task => {
                                                      return (
                                                        <button
                                                          key={task.id}
                                                          onClick={() => setSelection({ type: 'task', id: task.id })}
                                                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-all flex items-center ${
                                                            selection?.type === 'task' && selection.id === task.id
                                                              ? 'bg-gold/10 text-gold font-medium'
                                                              : isTaskCompleted(task.id)
                                                              ? 'bg-green-50 text-green-700'
                                                              : isTaskBlue(task.id)
                                                              ? 'bg-blue-50 text-blue-700'
                                                              : 'text-charcoal/40 hover:bg-charcoal/3 hover:text-charcoal/60'
                                                          }`}
                                                        >
                                                          <span className="flex-1">{task.title}</span>
                                                          <span className="text-[9px] text-charcoal/30 flex-shrink-0 ml-1">{taskCompletedCount(task)}/{getRequiredCount(task)}</span>
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

      {/* Right content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Workshop view */}
        {selWorkshop && (
          <div className="px-5 py-6 max-w-2xl">
            <span className="text-xs text-charcoal/30 uppercase tracking-wider">Workshop</span>
            <h1 className="font-serif text-2xl text-charcoal mt-1 mb-3">{selWorkshop.name}</h1>
            {selWorkshop.tags && selWorkshop.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selWorkshop.tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{tag}</span>
                ))}
              </div>
            )}
            {(() => {
              const wsCourseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === selWorkshop.id).map(wc => wc.course_id))
              const wsCourses = courses.filter(c => wsCourseIds.has(c.id)).sort((a, b) => a.sort_order - b.sort_order)
              const s = workshopStats(selWorkshop.id)
              return (
                <>
                  <p className="text-sm text-charcoal/50 mb-4">{s.courseCompleted}/{s.courseTotal} courses · {s.catCompleted}/{s.catTotal} categories · {s.subCompleted}/{s.subTotal} subcategories · {s.taskCompleted}/{s.taskTotal} tasks</p>
                  <p className="text-xs text-charcoal/30 uppercase tracking-wider mb-3">Courses</p>
                  <div className="space-y-2">
                    {wsCourses.map(course => {
                      const colour = course.colour_hex || COURSE_COLOURS[course.name] || '#C9A96E'
                      const cats = getCatsForCourse(course.id)
                      return (
                        <button
                          key={course.id}
                          onClick={() => { setSelection({ type: 'course', id: course.id }); setExpanded(prev => new Set(prev).add(`ws-${selWorkshop.id}`).add(`c-${course.id}`)) }}
                          className="w-full card p-4 text-left hover:shadow-md transition-shadow flex items-center gap-3"
                        >
                          <span
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                            style={{ backgroundColor: colour + '20', color: colour }}
                          >
                            {course.icon}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-charcoal">{course.name}</p>
                            <p className="text-xs text-charcoal/40 mt-0.5">{cats.length} categories</p>
                          </div>
                          <span className="text-charcoal/20">&rsaquo;</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* Course view */}
        {selCourse && (
          <div className="px-5 py-6 max-w-2xl">
            <span className="text-xs text-charcoal/30 uppercase tracking-wider">Course</span>
            <h1 className="font-serif text-2xl text-charcoal mt-1 mb-3">{selCourse.name}</h1>
            {(() => { const s = courseStats(selCourse.id); return (
              <p className="text-sm text-charcoal/50 mb-4">{s.catCompleted}/{s.catTotal} categories · {s.subCompleted}/{s.subTotal} subcategories · {s.taskCompleted}/{s.taskTotal} tasks</p>
            )})()}
            <div className="space-y-2">
              {getCatsForCourse(selCourse.id).map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelection({ type: 'category', id: cat.id }); setExpanded(prev => new Set(prev).add(`c-${selCourse.id}`).add(`cat-${cat.id}`)) }}
                  className="w-full card p-4 text-left hover:shadow-md transition-shadow flex items-center gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs text-charcoal/40 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">{cat.title}</p>
                    {cat.description && <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-1">{cat.description}</p>}
                  </div>
                  <span className="text-charcoal/20">&rsaquo;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category view */}
        {selCategory && (
          <div className="px-5 py-6 max-w-2xl">
            {selCategory.course && <span className="text-xs text-charcoal/30">{(selCategory.course as Course).name}</span>}
            <h1 className="font-serif text-2xl text-charcoal mt-1 mb-2">{selCategory.title}</h1>
            {selCategory.description && <p className="text-sm text-charcoal/60 leading-relaxed mb-2">{selCategory.description}</p>}
            {(() => { const s = catStats(selCategory.id); return (
              <p className="text-sm text-charcoal/50 mb-4">{s.subCompleted}/{s.subTotal} subcategories · {s.taskCompleted}/{s.taskTotal} tasks</p>
            )})()}
            <p className="text-xs text-charcoal/30 uppercase tracking-wider mb-3">Subcategories</p>
            <div className="space-y-2">
              {getSubsForCat(selCategory.id).map((sub, i) => (
                <button
                  key={sub.id}
                  onClick={() => { setSelection({ type: 'subcategory', id: sub.id }); setExpanded(prev => new Set(prev).add(`cat-${selCategory.id}`).add(`sub-${sub.id}`)) }}
                  className="w-full card p-4 text-left hover:shadow-md transition-shadow flex items-center gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs text-charcoal/40 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">{sub.title}</p>
                    {sub.content && <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-1">{sub.content}</p>}
                  </div>
                  <span className="text-xs text-charcoal/30">{getTasksForSub(sub.id).length} tasks</span>
                  <span className="text-charcoal/20">&rsaquo;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subcategory view */}
        {selSubcategory && (() => {
          const parentCat = categories.find(c => c.id === selSubcategory.category_id)
          const tasks = getTasksForSub(selSubcategory.id)
          return (
            <div className="px-5 py-6 max-w-2xl">
              {parentCat && <span className="text-xs text-charcoal/30">{parentCat.course ? (parentCat.course as Course).name + ' › ' : ''}{parentCat.title}</span>}
              <h1 className="font-serif text-2xl text-charcoal mt-1 mb-2">{selSubcategory.title}</h1>
              {selSubcategory.content && <p className="text-sm text-charcoal/60 leading-relaxed mb-2">{selSubcategory.content}</p>}
              {(() => { const s = subStats(selSubcategory.id); return (
                <p className="text-sm text-charcoal/50 mb-4">{s.completed}/{s.total} tasks</p>
              )})()}
              <p className="text-xs text-charcoal/30 uppercase tracking-wider mb-3">Training Tasks</p>
              <div className="space-y-2">
                {tasks.map((task, i) => (
                  <button
                    key={task.id}
                    onClick={() => { setSelection({ type: 'task', id: task.id }); setExpanded(prev => new Set(prev).add(`sub-${selSubcategory.id}`)) }}
                    className={`w-full card p-4 text-left hover:shadow-md transition-shadow ${isTaskCompleted(task.id) ? 'bg-green-50 border-green-200' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs text-charcoal/40 flex-shrink-0 mt-0.5">{i + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-charcoal leading-snug">{task.title}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {task.trainer_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal/5 text-charcoal/40">{task.trainer_type}</span>}
                          {task.modality && <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal/5 text-charcoal/40">{task.modality}</span>}
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal/5 text-charcoal/40">{taskCompletedCount(task)}/{getRequiredCount(task)}</span>
                        </div>
                      </div>
                      <span className="text-charcoal/20 mt-0.5">&rsaquo;</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Training Task view */}
        {selTask && (
          <div className="px-5 py-6 max-w-2xl">
            <p className="text-xs text-charcoal/30 mb-4">
              {selTaskCat?.course && <span>{(selTaskCat.course as Course).name} &rsaquo; </span>}
              {selTaskCat && <span>{selTaskCat.title} &rsaquo; </span>}
              {selTaskSub && <span>{selTaskSub.title}</span>}
            </p>

            <h1 className="font-serif text-xl text-charcoal mb-3">{selTask.title}</h1>

            <div className="flex flex-wrap gap-2 mb-5">
              {selTask.trainer_type && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selTask.trainer_type}</span>}
              {selTask.modality && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selTask.modality}</span>}
              {selTask.priority_level && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selTask.priority_level}</span>}
            </div>

            {(() => {
              const content = getContentForTask(selTask.id)
              if (content.length === 0) return null
              return (
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
              )
            })()}

            {/* Mark as Complete */}
            <div className="mt-8 pt-6 border-t border-black/5">
              {(() => {
                const count = getCompletionCount(selTask.id)
                const required = getRequiredCount(selTask)
                const done = count >= required
                const isLast = count === required - 1

                return done ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium">
                    <Check size={16} />
                    Completed ({count}/{required})
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-charcoal/40 mb-2">Progress: {count}/{required} completion{required !== 1 ? 's' : ''}</p>
                    <button
                      onClick={() => setCompletionOverlay(selTask.id)}
                      className="w-full px-4 py-3 rounded-xl bg-gold text-white font-medium text-sm hover:bg-gold/90 transition-colors"
                    >
                      {isLast ? 'Mark as Complete' : selTask.is_recurring ? 'Record Task as Complete' : 'Mark as Complete'}
                    </button>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selection && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <BookOpen size={40} className="mx-auto text-charcoal/15 mb-3" />
              <p className="font-serif text-lg text-charcoal/40">Select an item to view details</p>
            </div>
          </div>
        )}
      </div>
      {/* Completion overlay */}
      {completionOverlay && (() => {
        const overlayTask = trainingTasks.find(t => t.id === completionOverlay)!
        const count = getCompletionCount(completionOverlay)
        const required = getRequiredCount(overlayTask)
        const taskCompletions = completions.filter(c => c.training_task_id === completionOverlay)
        const hasPreviousCertificate = taskCompletions.some(c => c.certificate_url !== null)
        return (
          <CompletionOverlay
            task={overlayTask}
            submitting={completing}
            completionNumber={count + 1}
            requiredCount={required}
            hasPreviousCertificate={hasPreviousCertificate}
            onSubmit={(data) => submitCompletion(completionOverlay, data)}
            onClose={() => setCompletionOverlay(null)}
          />
        )
      })()}
    </div>
  )
}

function CompletionOverlay({
  task,
  submitting,
  completionNumber,
  requiredCount,
  hasPreviousCertificate,
  onSubmit,
  onClose,
}: {
  task: TrainingTask
  submitting: boolean
  completionNumber: number
  requiredCount: number
  hasPreviousCertificate: boolean
  onSubmit: (data: { takeaways: string; summary: string; confidence_rating: number | null; certificate_reference: string | null; certificate_url: string | null }) => void
  onClose: () => void
}) {
  const [takeaways, setTakeaways] = useState('')
  const [summary, setSummary] = useState('')
  const [rating, setRating] = useState(0)
  const [certRef, setCertRef] = useState('')
  const [certFile, setCertFile] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const supabase = createClient()

  const isRecurring = task.is_recurring
  const needsRating = task.confidence_rating_required
  const needsCert = task.certificate_required
  const showCertUpload = needsCert && !hasPreviousCertificate
  const isLast = completionNumber >= requiredCount

  function wordCount(s: string) {
    return s.trim().split(/\s+/).filter(Boolean).length
  }

  const errors = {
    takeaways: wordCount(takeaways) < 20,
    summary: wordCount(summary) < 20,
    rating: needsRating && rating === 0,
  }

  const hasErrors = Object.values(errors).some(Boolean)

  async function handleCertUpload(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `certificates/${task.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('module-files').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('module-files').getPublicUrl(path)
      setCertFile(urlData.publicUrl)
    }
    setUploading(false)
  }

  function handleSubmit() {
    if (hasErrors) {
      setShowErrors(true)
      return
    }
    onSubmit({
      takeaways: takeaways.trim(),
      summary: summary.trim(),
      confidence_rating: needsRating ? rating : null,
      certificate_reference: needsCert && certRef.trim() ? certRef.trim() : null,
      certificate_url: showCertUpload ? certFile : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-black/5">
          <h2 className="font-serif text-lg text-charcoal">{isRecurring ? `Record Completion ${completionNumber}/${requiredCount}` : 'Complete Training Task'}</h2>
          <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-1">{task.title}</p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Question 1 */}
          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
              {isRecurring ? 'What did you observe?' : 'What were your three key takeaways?'} <span className="text-red-400">*</span>
            </label>
            <textarea
              className={`textarea text-sm ${showErrors && errors.takeaways ? 'border-red-300 bg-red-50/30' : ''}`}
              rows={5}
              value={takeaways}
              onChange={e => setTakeaways(e.target.value)}
              placeholder={isRecurring ? 'Describe what you observed... (minimum 20 words)' : 'Share your three key takeaways... (minimum 20 words)'}
            />
            <p className={`text-[10px] mt-1 ${showErrors && errors.takeaways ? 'text-red-400' : 'text-charcoal/30'}`}>{wordCount(takeaways)} / 20 words min</p>
          </div>

          {/* Question 2 */}
          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
              {isRecurring ? 'What questions do you have, or what would you like to know more about?' : 'Brief Summary'} <span className="text-red-400">*</span>
            </label>
            <textarea
              className={`textarea text-sm ${showErrors && errors.summary ? 'border-red-300 bg-red-50/30' : ''}`}
              rows={4}
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder={isRecurring ? 'Share your questions or areas of interest... (minimum 20 words)' : 'Write a brief summary of what you covered — not an essay, just the essence (minimum 20 words)'}
            />
            <p className={`text-[10px] mt-1 ${showErrors && errors.summary ? 'text-red-400' : 'text-charcoal/30'}`}>{wordCount(summary)} / 20 words min</p>
          </div>

          {/* Confidence Rating */}
          {needsRating && (
            <div>
              <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                Confidence Level <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill={star <= rating ? '#C9A96E' : 'none'}
                      stroke={star <= rating ? '#C9A96E' : '#D1D5DB'}
                      strokeWidth="1.5"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
              {showErrors && errors.rating && (
                <p className="text-[10px] text-red-400 mt-1">Please select a confidence level</p>
              )}
            </div>
          )}

          {/* Certificate */}
          {needsCert && (
            <>
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Certificate Reference Number
                </label>
                <input
                  className="input text-sm"
                  value={certRef}
                  onChange={e => setCertRef(e.target.value)}
                  placeholder="Optional — enter certificate reference number"
                />
              </div>

              {showCertUpload && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                    Certificate Upload
                  </label>
                  {certFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                      <span className="text-sm text-green-700 flex-1 truncate">Certificate uploaded</span>
                      <button onClick={() => setCertFile(null)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ) : (
                    <label className="card p-4 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-charcoal/30"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                      <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload certificate'}</p>
                      <p className="text-xs text-charcoal/25">PDF, JPG, PNG</p>
                      <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files?.[0] && handleCertUpload(e.target.files[0])} />
                    </label>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-black/5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal/50 hover:text-charcoal rounded-xl border border-charcoal/15 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : isLast ? 'Complete Task' : 'Record Completion'}
          </button>
        </div>
      </div>
    </div>
  )
}
