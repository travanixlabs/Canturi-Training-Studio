'use client'

import { useState, useMemo } from 'react'
import { X, Check, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOffCompletion } from '@/app/manager/sign-off/actions'
import { COURSE_COLOURS } from '@/types'
import type { User, Course, Category, Subcategory, TrainingTask, TrainingTaskCompletion } from '@/types'

interface Props {
  manager: User
  trainees: User[]
  completions: TrainingTaskCompletion[]
  trainingTasks: TrainingTask[]
  subcategories: Subcategory[]
  categories: Category[]
  courses: Course[]
}

export function ManagerSignOff({ manager, trainees, completions: initialCompletions, trainingTasks, subcategories, categories, courses }: Props) {
  const router = useRouter()
  const sortedTrainees = useMemo(() => [...trainees].sort((a, b) => a.name.localeCompare(b.name)), [trainees])
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(sortedTrainees[0]?.id ?? '')
  const [completions, setCompletions] = useState(initialCompletions)
  const [overlayCompletionId, setOverlayCompletionId] = useState<string | null>(null)

  // Task lookup
  const taskMap = useMemo(() => {
    const m = new Map<string, TrainingTask>()
    for (const t of trainingTasks) m.set(t.id, t)
    return m
  }, [trainingTasks])

  // Breadcrumb for a task
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

  // Filter completions for selected trainee
  const traineeCompletions = useMemo(() =>
    completions.filter(c => c.trainee_id === selectedTraineeId).sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()),
    [completions, selectedTraineeId]
  )

  // Only show completions for tasks that require sign off (trainer_type !== 'Self Directed')
  const signOffCompletions = traineeCompletions.filter(c => {
    const task = taskMap.get(c.training_task_id)
    return task && task.trainer_type !== 'Self Directed'
  })
  const pendingCompletions = signOffCompletions.filter(c => !c.signed_off_at)
  const signedOffCompletions = signOffCompletions.filter(c => c.signed_off_at)

  const overlayCompletion = overlayCompletionId ? completions.find(c => c.id === overlayCompletionId) : null
  const overlayTask = overlayCompletion ? taskMap.get(overlayCompletion.training_task_id) : null

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-6">
      {/* Trainee pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {sortedTrainees.map(trainee => (
          <button
            key={trainee.id}
            onClick={() => setSelectedTraineeId(trainee.id)}
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

      {/* Pending Sign Off */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-gold" />
          <h2 className="font-serif text-lg text-charcoal">Pending Sign Off</h2>
          <span className="text-xs text-charcoal/30 ml-1">{pendingCompletions.length}</span>
        </div>
        {pendingCompletions.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-charcoal/30">No completions awaiting sign off</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingCompletions.map(c => {
              const task = taskMap.get(c.training_task_id)
              const colour = getCourseColour(c.training_task_id)
              return (
                <button
                  key={c.id}
                  onClick={() => setOverlayCompletionId(c.id)}
                  className="w-full card p-4 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ backgroundColor: colour }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal">{task?.title || 'Unknown Task'}</p>
                      <p className="text-[10px] text-charcoal/30 mt-0.5">{getBreadcrumb(c.training_task_id)}</p>
                      <p className="text-[10px] text-charcoal/30 mt-0.5">Completed {formatDate(c.completed_at)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {c.confidence_rating && (
                          <span className="flex items-center gap-0.5 text-[10px] text-charcoal/30">
                            Self: {[1,2,3,4,5].map(s => <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= c.confidence_rating! ? '#C9A96E' : 'none'} stroke={s <= c.confidence_rating! ? '#C9A96E' : '#D1D5DB'} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                          </span>
                        )}
                        {c.confidence_rating && c.manager_rating && <span className="text-[10px] text-charcoal/15">|</span>}
                        {c.manager_rating && (
                          <span className="flex items-center gap-0.5 text-[10px] text-charcoal/30">
                            Manager: {[1,2,3,4,5].map(s => <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= c.manager_rating! ? '#C9A96E' : 'none'} stroke={s <= c.manager_rating! ? '#C9A96E' : '#D1D5DB'} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                          </span>
                        )}
                      </div>
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
      </div>

      {/* Completed Sign Off */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Check size={16} className="text-green-600" />
          <h2 className="font-serif text-lg text-charcoal">Completed Sign Off</h2>
          <span className="text-xs text-charcoal/30 ml-1">{signedOffCompletions.length}</span>
        </div>
        {signedOffCompletions.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-charcoal/30">No signed off completions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {signedOffCompletions.map(c => {
              const task = taskMap.get(c.training_task_id)
              const colour = getCourseColour(c.training_task_id)
              return (
                <button
                  key={c.id}
                  onClick={() => setOverlayCompletionId(c.id)}
                  className="w-full card p-4 text-left hover:shadow-md transition-shadow bg-green-50/50"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ backgroundColor: colour }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal">{task?.title || 'Unknown Task'}</p>
                      <p className="text-[10px] text-charcoal/30 mt-0.5">{getBreadcrumb(c.training_task_id)}</p>
                      <p className="text-[10px] text-charcoal/30 mt-0.5">Completed {formatDate(c.completed_at)} · Signed off {formatDate(c.signed_off_at!)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {c.confidence_rating && (
                          <span className="flex items-center gap-0.5 text-[10px] text-charcoal/30">
                            Self: {[1,2,3,4,5].map(s => <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= c.confidence_rating! ? '#C9A96E' : 'none'} stroke={s <= c.confidence_rating! ? '#C9A96E' : '#D1D5DB'} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                          </span>
                        )}
                        {c.confidence_rating && c.manager_rating && <span className="text-[10px] text-charcoal/15">|</span>}
                        {c.manager_rating && (
                          <span className="flex items-center gap-0.5 text-[10px] text-charcoal/30">
                            Manager: {[1,2,3,4,5].map(s => <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= c.manager_rating! ? '#C9A96E' : 'none'} stroke={s <= c.manager_rating! ? '#C9A96E' : '#D1D5DB'} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sign Off Overlay */}
      {overlayCompletion && overlayTask && (
        <SignOffOverlay
          completion={overlayCompletion}
          task={overlayTask}
          breadcrumb={getBreadcrumb(overlayCompletion.training_task_id)}
          onClose={() => setOverlayCompletionId(null)}
          onSignOff={async (data) => {
            const result = await signOffCompletion(overlayCompletion.id, data)
            if (result.error) {
              alert('Failed to sign off: ' + result.error)
              return
            }
            setCompletions(prev => prev.map(c =>
              c.id === overlayCompletion.id
                ? { ...c, ...data, signed_off_at: new Date().toISOString(), signed_off_by: manager.id }
                : c
            ))
            setOverlayCompletionId(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function SignOffOverlay({
  completion,
  task,
  breadcrumb,
  onClose,
  onSignOff,
}: {
  completion: TrainingTaskCompletion
  task: TrainingTask
  breadcrumb: string
  onClose: () => void
  onSignOff: (data: { manager_notes: string; manager_coaching: string; manager_rating: number | null }) => void
}) {
  const [notes, setNotes] = useState(completion.manager_notes ?? '')
  const [coaching, setCoaching] = useState(completion.manager_coaching ?? '')
  const [rating, setRating] = useState(completion.manager_rating ?? 0)
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isAlreadySignedOff = !!completion.signed_off_at
  const isRecurring = task.is_recurring
  const needsRating = task.confidence_rating_required

  function wordCount(s: string) {
    return s.trim().split(/\s+/).filter(Boolean).length
  }

  const errors = {
    notes: wordCount(notes) < 20,
    coaching: wordCount(coaching) < 20,
    rating: needsRating && rating === 0,
  }

  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSubmit() {
    if (hasErrors) { setShowErrors(true); return }
    setSubmitting(true)
    await onSignOff({
      manager_notes: notes.trim(),
      manager_coaching: coaching.trim(),
      manager_rating: needsRating ? rating : null,
    })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-black/5 flex items-start justify-between">
          <div>
            <p className="text-xs text-charcoal/30 mb-1">{breadcrumb}</p>
            <h2 className="font-serif text-lg text-charcoal">{task.title}</h2>
            {isAlreadySignedOff && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-600 mt-1">
                <Check size={10} /> Signed off
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-charcoal/30 hover:text-charcoal/60 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Task info pills */}
          <div className="flex flex-wrap gap-2">
            {task.trainer_type && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.trainer_type}</span>}
            {task.modality && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.modality}</span>}
            {task.is_recurring && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">Recurring ×{task.recurring_count}</span>}
          </div>

          {/* Trainee's answers — read only */}
          <div className="border-t border-black/5 pt-4">
            <p className="text-[10px] text-charcoal/30 uppercase tracking-wider font-medium mb-3">Trainee Submission</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal/50 mb-1">
                  {isRecurring ? 'What did you observe?' : 'Key Takeaways'}
                </label>
                <div className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{completion.takeaways}</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/50 mb-1">
                  {isRecurring ? 'Questions / Want to know more' : 'Summary'}
                </label>
                <div className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{completion.summary}</div>
              </div>

              {completion.confidence_rating && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 mb-1">Competence Rating</label>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <svg key={star} width="20" height="20" viewBox="0 0 24 24"
                        fill={star <= completion.confidence_rating! ? '#C9A96E' : 'none'}
                        stroke={star <= completion.confidence_rating! ? '#C9A96E' : '#D1D5DB'}
                        strokeWidth="1.5"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                </div>
              )}

              {completion.certificate_reference && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 mb-1">Certificate Reference</label>
                  <p className="text-sm text-charcoal/70">{completion.certificate_reference}</p>
                </div>
              )}

              {completion.certificate_url && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 mb-1">Certificate</label>
                  <a href={completion.certificate_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:text-gold/80 underline">View certificate</a>
                </div>
              )}

              <p className="text-[10px] text-charcoal/30">
                Completed {new Date(completion.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Manager sign off fields */}
          <div className="border-t border-black/5 pt-4">
            <p className="text-[10px] text-charcoal/30 uppercase tracking-wider font-medium mb-3">Manager Sign Off</p>

            <div className="space-y-4">
              {/* Manager Notes */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Manager Notes <span className="text-red-400">*</span>
                </label>
                {isAlreadySignedOff ? (
                  <div className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{completion.manager_notes}</div>
                ) : (
                  <>
                    <textarea
                      className={`textarea text-sm ${showErrors && errors.notes ? 'border-red-300 bg-red-50/30' : ''}`}
                      rows={4}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Your notes on this completion... (minimum 20 words)"
                    />
                    <p className={`text-[10px] mt-1 ${showErrors && errors.notes ? 'text-red-400' : 'text-charcoal/30'}`}>{wordCount(notes)} / 20 words min</p>
                  </>
                )}
              </div>

              {/* Manager Coaching Sentence */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Manager Coaching Sentence <span className="text-red-400">*</span>
                </label>
                {isAlreadySignedOff ? (
                  <div className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{completion.manager_coaching}</div>
                ) : (
                  <>
                    <textarea
                      className={`textarea text-sm ${showErrors && errors.coaching ? 'border-red-300 bg-red-50/30' : ''}`}
                      rows={4}
                      value={coaching}
                      onChange={e => setCoaching(e.target.value)}
                      placeholder="Your coaching feedback... (minimum 20 words)"
                    />
                    <p className={`text-[10px] mt-1 ${showErrors && errors.coaching ? 'text-red-400' : 'text-charcoal/30'}`}>{wordCount(coaching)} / 20 words min</p>
                  </>
                )}
              </div>

              {/* Manager Rating — only if trainee has competence rating */}
              {needsRating && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                    Manager Rating <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => { if (!isAlreadySignedOff) setRating(star) }}
                        className={`p-1 transition-transform ${isAlreadySignedOff ? '' : 'hover:scale-110'}`}
                        disabled={isAlreadySignedOff}
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
                    <p className="text-[10px] text-red-400 mt-1">Please select a rating</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isAlreadySignedOff && (
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
              {submitting ? 'Signing Off...' : 'Sign Off'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
