'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, BookOpen, Check } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Course, Category, User, Workshop, WorkshopCourse, Subcategory, TrainingTask, TrainingTaskContent, TrainingTaskCompletion } from '@/types'

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
}

export function TraineeMenu({ courses, categories, currentUser, workshops = [], workshopCourses = [], subcategories = [], trainingTasks = [], taskContent = [], completions: initialCompletions = [] }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<{ type: 'workshop' | 'course' | 'category' | 'subcategory' | 'task'; id: string } | null>(null)
  const [completions, setCompletions] = useState<TrainingTaskCompletion[]>(initialCompletions)
  const [completing, setCompleting] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const isTaskCompleted = (taskId: string) => completions.some(c => c.training_task_id === taskId)

  async function markComplete(taskId: string) {
    setCompleting(true)
    const { data, error } = await supabase.from('training_task_completions').insert({
      training_task_id: taskId,
      trainee_id: currentUser.id,
    }).select().single()
    if (!error && data) {
      setCompletions(prev => [...prev, data as TrainingTaskCompletion])
    }
    setCompleting(false)
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
          <p className="text-xs text-charcoal/40 mb-4">Browse all training topics</p>

          <div className="space-y-1">
            {workshopHierarchy.map(({ workshop, courses: wsCourses }) => {
              const wsKey = `ws-${workshop.id}`
              const wsOpen = expanded.has(wsKey)

              return (
                <div key={workshop.id}>
                  {/* Workshop */}
                  <button
                    onClick={() => { toggle(wsKey); setSelection({ type: 'workshop', id: workshop.id }) }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                      selection?.type === 'workshop' && selection.id === workshop.id ? 'bg-gold/10' : 'hover:bg-charcoal/3'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center text-[10px] flex-shrink-0 text-gold font-serif">W</span>
                    <span className="text-sm font-medium text-charcoal flex-1">{workshop.name}</span>
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
                        const cats = getCatsForCourse(course.id)

                        return (
                          <div key={course.id}>
                            {/* Course */}
                            <button
                              onClick={() => { toggle(cKey); setSelection({ type: 'course', id: course.id }) }}
                              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                                selection?.type === 'course' && selection.id === course.id ? 'bg-gold/10' : 'hover:bg-charcoal/3'
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                                style={{ backgroundColor: colour + '20', color: colour }}
                              >
                                {course.icon}
                              </span>
                              <span className="text-sm text-charcoal/70 flex-1">{course.name}</span>
                              {cOpen ? <ChevronUp size={12} className="text-charcoal/20" /> : <ChevronDown size={12} className="text-charcoal/20" />}
                            </button>

                            {cOpen && (
                              <div className="ml-4 pl-3 border-l border-charcoal/8 mt-1 mb-1 space-y-0.5">
                                {cats.map(cat => {
                                  const catKey = `cat-${cat.id}`
                                  const catOpen = expanded.has(catKey)
                                  const subs = getSubsForCat(cat.id)

                                  return (
                                    <div key={cat.id}>
                                      {/* Category */}
                                      <button
                                        onClick={() => { toggle(catKey); setSelection({ type: 'category', id: cat.id }) }}
                                        className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                                          selection?.type === 'category' && selection.id === cat.id ? 'bg-gold/10' : 'hover:bg-charcoal/3'
                                        }`}
                                      >
                                        <span className="text-xs text-charcoal/50 flex-1">{cat.title}</span>
                                        {subs.length > 0 && (
                                          catOpen ? <ChevronUp size={10} className="text-charcoal/20" /> : <ChevronDown size={10} className="text-charcoal/20" />
                                        )}
                                      </button>

                                      {catOpen && subs.length > 0 && (
                                        <div className="ml-3 pl-3 border-l border-charcoal/5 mt-0.5 mb-1 space-y-0.5">
                                          {subs.map(sub => {
                                            const subKey = `sub-${sub.id}`
                                            const subOpen = expanded.has(subKey)
                                            const tasks = getTasksForSub(sub.id)

                                            return (
                                              <div key={sub.id}>
                                                {/* Subcategory */}
                                                <button
                                                  onClick={() => { toggle(subKey); setSelection({ type: 'subcategory', id: sub.id }) }}
                                                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                                                    selection?.type === 'subcategory' && selection.id === sub.id ? 'bg-gold/10' : 'hover:bg-charcoal/3'
                                                  }`}
                                                >
                                                  <span className="text-xs text-charcoal/40 flex-1">{sub.title}</span>
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
                                                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-all ${
                                                            selection?.type === 'task' && selection.id === task.id
                                                              ? 'bg-gold/10 text-gold font-medium'
                                                              : isTaskCompleted(task.id)
                                                              ? 'bg-green-50 text-green-700'
                                                              : 'text-charcoal/40 hover:bg-charcoal/3 hover:text-charcoal/60'
                                                          }`}
                                                        >
                                                          {task.title}
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
              const totalCats = wsCourses.reduce((sum, c) => sum + getCatsForCourse(c.id).length, 0)
              return (
                <>
                  <p className="text-sm text-charcoal/50 mb-4">{wsCourses.length} courses · {totalCats} categories</p>
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
            <p className="text-sm text-charcoal/50 mb-4">{getCatsForCourse(selCourse.id).length} categories</p>
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
            {selCategory.description && <p className="text-sm text-charcoal/60 leading-relaxed mb-4">{selCategory.description}</p>}
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
              {selSubcategory.content && <p className="text-sm text-charcoal/60 leading-relaxed mb-4">{selSubcategory.content}</p>}
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
              {isTaskCompleted(selTask.id) ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 text-green-700 text-sm font-medium">
                  <Check size={16} />
                  Completed
                </div>
              ) : (
                <button
                  onClick={() => markComplete(selTask.id)}
                  disabled={completing}
                  className="w-full px-4 py-3 rounded-xl bg-gold text-white font-medium text-sm hover:bg-gold/90 transition-colors disabled:opacity-50"
                >
                  {completing ? 'Saving...' : 'Mark as Complete'}
                </button>
              )}
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
    </div>
  )
}
