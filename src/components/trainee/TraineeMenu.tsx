'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import type { Course, Category, User, Workshop, WorkshopCourse, Subcategory, TrainingTask, TrainingTaskContent } from '@/types'

interface Props {
  courses: Course[]
  categories: Category[]
  currentUser: User
  workshops?: Workshop[]
  workshopCourses?: WorkshopCourse[]
  subcategories?: Subcategory[]
  trainingTasks?: TrainingTask[]
  taskContent?: TrainingTaskContent[]
}

export function TraineeMenu({ courses, categories, currentUser, workshops = [], workshopCourses = [], subcategories = [], trainingTasks = [], taskContent = [] }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const selectedTask = trainingTasks.find(t => t.id === selectedTaskId)

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

  // Find context for selected task
  const selectedSub = selectedTask ? subcategories.find(s => s.id === selectedTask.subcategory_id) : null
  const selectedCat = selectedSub ? categories.find(c => c.id === selectedSub.category_id) : null

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-120px)]">
      {/* Left sidebar */}
      <div className="lg:w-80 lg:min-h-full lg:border-r border-b lg:border-b-0 border-black/5 bg-white overflow-y-auto">
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
                    onClick={() => toggle(wsKey)}
                    className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-charcoal/3 transition-all"
                  >
                    <span className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center text-[10px] flex-shrink-0 text-gold font-serif">W</span>
                    <span className="text-sm font-medium text-charcoal flex-1">{workshop.name}</span>
                    {wsOpen ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                  </button>

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
                              onClick={() => toggle(cKey)}
                              className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-charcoal/3 transition-all"
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
                                        onClick={() => toggle(catKey)}
                                        className="w-full text-left px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-charcoal/3 transition-all"
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
                                                  onClick={() => toggle(subKey)}
                                                  className="w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 hover:bg-charcoal/3 transition-all"
                                                >
                                                  <span className="text-xs text-charcoal/40 flex-1">{sub.title}</span>
                                                  {tasks.length > 0 && (
                                                    subOpen ? <ChevronUp size={10} className="text-charcoal/15" /> : <ChevronDown size={10} className="text-charcoal/15" />
                                                  )}
                                                </button>

                                                {subOpen && tasks.length > 0 && (
                                                  <div className="ml-2 pl-3 border-l border-charcoal/5 mt-0.5 mb-1 space-y-0.5">
                                                    {tasks.map(task => {
                                                      const isSelected = selectedTaskId === task.id
                                                      return (
                                                        <button
                                                          key={task.id}
                                                          onClick={() => setSelectedTaskId(task.id)}
                                                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-all ${
                                                            isSelected
                                                              ? 'bg-gold/10 text-gold font-medium'
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
        {selectedTask && selectedSub && selectedCat ? (
          <div className="px-5 py-6 max-w-2xl">
            {/* Breadcrumb */}
            <p className="text-xs text-charcoal/30 mb-4">
              {selectedCat.course && <span>{(selectedCat.course as Course).name} &rsaquo; </span>}
              {selectedCat.title} &rsaquo; {selectedSub.title}
            </p>

            {/* Task title */}
            <h1 className="font-serif text-xl text-charcoal mb-3">{selectedTask.title}</h1>

            {/* Task meta */}
            <div className="flex flex-wrap gap-2 mb-5">
              {selectedTask.trainer_type && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selectedTask.trainer_type}</span>
              )}
              {selectedTask.modality && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selectedTask.modality}</span>
              )}
              {selectedTask.priority_level && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selectedTask.priority_level}</span>
              )}
            </div>

            {/* Task content */}
            {(() => {
              const content = getContentForTask(selectedTask.id)
              if (content.length === 0) return null

              return (
                <div className="space-y-4">
                  {content.map(c => (
                    <div key={c.id}>
                      {c.title && c.type !== 'text' && (
                        <p className="text-xs font-medium text-charcoal/50 mb-1.5">{c.title}</p>
                      )}

                      {c.type === 'text' && c.url && (
                        <div className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{c.url}</div>
                      )}

                      {c.type === 'webpage' && c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold/80 underline underline-offset-2 break-all"
                        >
                          {c.url}
                        </a>
                      )}

                      {c.type === 'image' && c.url && (
                        <img src={c.url} alt={c.title || ''} className="max-w-full rounded-lg border border-black/5" />
                      )}

                      {c.type === 'video' && c.url && (
                        isEmbeddable(c.url) ? (
                          <div className="rounded-lg overflow-hidden" style={{ height: '320px' }}>
                            <iframe
                              src={getEmbedUrl(c.url)}
                              className="w-full h-full border-0"
                              title={c.title || 'Video'}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <video src={c.url} controls className="max-w-full rounded-lg" />
                        )
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
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <BookOpen size={40} className="mx-auto text-charcoal/15 mb-3" />
              <p className="font-serif text-lg text-charcoal/40">Select a training task to view its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
