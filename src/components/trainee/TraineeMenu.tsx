'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set())

  const selectedCategory = categories.find(c => c.id === selectedCategoryId)

  // Build flat course → category hierarchy (first workshop that has courses)
  const courseHierarchy = useMemo(() => {
    const allCourseIds = new Set(workshopCourses.map(wc => wc.course_id))
    return courses
      .filter(c => allCourseIds.has(c.id))
      .map(course => ({
        course,
        categories: categories
          .filter(cat => cat.course_id === course.id)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      }))
      .filter(ch => ch.categories.length > 0)
  }, [courses, categories, workshopCourses])

  function toggleCourse(id: string) {
    setExpandedCourses(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Helpers for selected category content
  const getSubcategories = (catId: string) =>
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

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-120px)]">
      {/* Left sidebar */}
      <div className="lg:w-80 lg:min-h-full lg:border-r border-b lg:border-b-0 border-black/5 bg-white overflow-y-auto">
        <div className="p-4">
          <h1 className="font-serif text-xl text-charcoal mb-1">Training Menu</h1>
          <p className="text-xs text-charcoal/40 mb-4">Browse all training topics</p>

          <div className="space-y-1">
            {courseHierarchy.map(({ course, categories: cats }) => {
              const isExpanded = expandedCourses.has(course.id)
              const colour = course.colour_hex || COURSE_COLOURS[course.name] || '#C9A96E'

              return (
                <div key={course.id}>
                  {/* Course header */}
                  <button
                    onClick={() => toggleCourse(course.id)}
                    className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-charcoal/3 transition-all"
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ backgroundColor: colour + '20', color: colour }}
                    >
                      {course.icon}
                    </span>
                    <span className="text-sm font-medium text-charcoal flex-1">{course.name}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                  </button>

                  {/* Categories inside course */}
                  {isExpanded && (
                    <div className="ml-4 pl-3 border-l border-charcoal/10 mt-1 mb-2 space-y-0.5">
                      {cats.map(cat => {
                        const isSelected = selectedCategoryId === cat.id
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryId(cat.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                              isSelected
                                ? 'bg-gold/10 text-gold font-medium'
                                : 'text-charcoal/60 hover:bg-charcoal/3 hover:text-charcoal'
                            }`}
                          >
                            {cat.title}
                          </button>
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
        {selectedCategory ? (
          <div className="px-5 py-6 max-w-2xl">
            {/* Category header */}
            {selectedCategory.course && (
              <div className="mb-3">
                <CourseBadge courseName={(selectedCategory.course as Course).name} icon={(selectedCategory.course as Course).icon} />
              </div>
            )}
            <h1 className="font-serif text-2xl text-charcoal mb-2">{selectedCategory.title}</h1>
            {selectedCategory.description && (
              <p className="text-sm text-charcoal/60 leading-relaxed mb-6">{selectedCategory.description}</p>
            )}

            {/* Subcategories + Tasks */}
            {getSubcategories(selectedCategory.id).map((sub, subIdx) => {
              const subTasks = getTasksForSub(sub.id)

              return (
                <div key={sub.id} className="mb-8">
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-xs font-medium text-charcoal/30 uppercase tracking-wider flex-shrink-0">
                      {subIdx + 1}
                    </span>
                    <h2 className="font-serif text-lg text-charcoal">{sub.title}</h2>
                  </div>

                  {sub.content && (
                    <p className="text-sm text-charcoal/60 leading-relaxed mb-4 ml-7">{sub.content}</p>
                  )}

                  {subTasks.length > 0 && (
                    <div className="ml-7 space-y-4">
                      {subTasks.map((task, taskIdx) => {
                        const content = getContentForTask(task.id)

                        return (
                          <div key={task.id} className="card p-4">
                            <div className="flex items-start gap-3 mb-2">
                              <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-[10px] text-charcoal/40 flex-shrink-0 mt-0.5">
                                {taskIdx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-charcoal leading-snug">{task.title}</p>
                                {task.trainer_type && (
                                  <p className="text-xs text-charcoal/40 mt-0.5">{task.trainer_type}</p>
                                )}
                              </div>
                            </div>

                            {content.length > 0 && (
                              <div className="ml-9 space-y-3 mt-3">
                                {content.map(c => (
                                  <div key={c.id}>
                                    {c.title && c.type !== 'text' && (
                                      <p className="text-xs font-medium text-charcoal/50 mb-1">{c.title}</p>
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
                                        <div className="rounded-lg overflow-hidden" style={{ height: '280px' }}>
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
                                      <div className="rounded-lg overflow-hidden border border-black/5" style={{ height: '350px' }}>
                                        <iframe src={c.url} className="w-full h-full border-0" title={c.title || 'PDF'} />
                                      </div>
                                    )}
                                  </div>
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
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <BookOpen size={40} className="mx-auto text-charcoal/15 mb-3" />
              <p className="font-serif text-lg text-charcoal/40">Select a category to view its content</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
