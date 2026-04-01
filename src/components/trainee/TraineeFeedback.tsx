'use client'

import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import type { Course, Category, Subcategory, TrainingTask, TrainingTaskCompletion } from '@/types'

interface Props {
  completions: TrainingTaskCompletion[]
  trainingTasks: TrainingTask[]
  subcategories: Subcategory[]
  categories: Category[]
  courses: Course[]
}

export function TraineeFeedback({ completions, trainingTasks, subcategories, categories, courses }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const taskMap = useMemo(() => {
    const m = new Map<string, TrainingTask>()
    for (const t of trainingTasks) m.set(t.id, t)
    return m
  }, [trainingTasks])

  function getBreadcrumb(taskId: string) {
    const task = taskMap.get(taskId)
    if (!task) return ''
    const sub = subcategories.find(s => s.id === task.subcategory_id)
    const cat = sub ? categories.find(c => c.id === sub.category_id) : null
    const course = cat ? courses.find(c => c.id === cat.course_id) : null
    return [course?.name, cat?.title, sub?.title].filter(Boolean).join(' › ')
  }

  function getCourseColour(taskId: string) {
    const task = taskMap.get(taskId)
    if (!task) return '#C9A96E'
    const sub = subcategories.find(s => s.id === task.subcategory_id)
    const cat = sub ? categories.find(c => c.id === sub.category_id) : null
    const course = cat ? courses.find(c => c.id === cat.course_id) : null
    return course?.colour_hex || COURSE_COLOURS[course?.name ?? ''] || '#C9A96E'
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const selected = selectedId ? completions.find(c => c.id === selectedId) : null
  const selectedTask = selected ? taskMap.get(selected.training_task_id) : null

  return (
    <div className="max-w-3xl mx-auto px-5 py-6">
      <h1 className="font-serif text-xl text-charcoal mb-1">Feedback</h1>
      <p className="text-xs text-charcoal/40 mb-6">Coaching notes from your mentor</p>

      {completions.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-charcoal/30">No feedback received yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {completions.map(c => {
            const task = taskMap.get(c.training_task_id)
            const colour = getCourseColour(c.training_task_id)
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full card p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: colour }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal">{task?.title || 'Unknown Task'}</p>
                    <p className="text-[10px] text-charcoal/30 mt-0.5">{getBreadcrumb(c.training_task_id)}</p>
                    <div className="mt-2 rounded-lg bg-gold/5 border border-gold/10 px-3 py-2">
                      <p className="text-xs text-charcoal/60 leading-relaxed line-clamp-2">{c.manager_coaching}</p>
                    </div>
                    <p className="text-[10px] text-charcoal/30 mt-1.5">{formatDate(c.signed_off_at!)}</p>
                  </div>
                  {task?.is_recurring && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">Recurring</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail overlay */}
      {selected && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedId(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-black/5 flex items-start justify-between">
              <div>
                <p className="text-xs text-charcoal/30 mb-1">{getBreadcrumb(selected.training_task_id)}</p>
                <h2 className="font-serif text-lg text-charcoal">{selectedTask.title}</h2>
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {selectedTask.trainer_type && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selectedTask.trainer_type}</span>}
                {selectedTask.modality && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selectedTask.modality}</span>}
                {selectedTask.is_recurring && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">Recurring ×{selectedTask.recurring_count}</span>}
              </div>

              {/* Your submission */}
              <div className="border-t border-black/5 pt-4">
                <p className="text-[10px] text-charcoal/30 uppercase tracking-wider font-medium mb-3">Your Submission</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-medium text-charcoal/40 mb-0.5">
                      {selectedTask.is_recurring ? 'What did you observe?' : 'Key Takeaways'}
                    </p>
                    <p className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{selected.takeaways}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-charcoal/40 mb-0.5">
                      {selectedTask.is_recurring ? 'Questions / Want to know more' : 'Summary'}
                    </p>
                    <p className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{selected.summary}</p>
                  </div>
                  {selected.confidence_rating && (
                    <div className="flex items-center gap-1">
                      <p className="text-[10px] font-medium text-charcoal/40">Competence:</p>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill={s <= selected.confidence_rating! ? '#C9A96E' : 'none'} stroke={s <= selected.confidence_rating! ? '#C9A96E' : '#D1D5DB'} strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-charcoal/30">
                    Completed {new Date(selected.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* From Your Mentor */}
              <div className="border-t border-black/5 pt-4">
                <p className="text-xs text-charcoal/30 uppercase tracking-wider font-medium mb-3">From Your Mentor</p>
                <div className="rounded-xl bg-gold/5 border border-gold/10 p-4">
                  <p className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{selected.manager_coaching}</p>
                  <p className="text-[10px] text-charcoal/30 mt-3">{formatDate(selected.signed_off_at!)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
