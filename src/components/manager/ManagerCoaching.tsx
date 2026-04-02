'use client'

import { useState, useMemo } from 'react'
import { X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { coachingAddToPlate, coachingNotNow, coachingDismiss } from '@/app/manager/coaching/actions'
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

export function ManagerCoaching({ manager, trainees, completions: initialCompletions, trainingTasks, subcategories, categories, courses }: Props) {
  const router = useRouter()
  const sortedTrainees = useMemo(() => [...trainees].sort((a, b) => a.name.localeCompare(b.name)), [trainees])
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(sortedTrainees[0]?.id ?? '')
  const [completions, setCompletions] = useState(initialCompletions)
  const [overlayCompletionId, setOverlayCompletionId] = useState<string | null>(null)
  const [competenceRange, setCompetenceRange] = useState<[number, number]>([1, 3])
  const [managerRange, setManagerRange] = useState<[number, number]>([1, 3])
  const [filterMode, setFilterMode] = useState<'and' | 'or'>('or')

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

  // Filter completions by trainee and rating ranges, exclude dismissed and added_to_plate
  const matchesRating = (c: TrainingTaskCompletion) => {
    const matchesCompetence = c.confidence_rating !== null && c.confidence_rating >= competenceRange[0] && c.confidence_rating <= competenceRange[1]
    const matchesManager = c.manager_rating !== null && c.manager_rating >= managerRange[0] && c.manager_rating <= managerRange[1]
    if (filterMode === 'and') return matchesCompetence && matchesManager
    return matchesCompetence || matchesManager
  }

  const traineeItems = useMemo(() =>
    completions
      .filter(c => c.trainee_id === selectedTraineeId && c.coaching_status !== 'dismissed' && c.coaching_status !== 'added_to_plate' && !c.reset_at)
      .filter(matchesRating)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()),
    [completions, selectedTraineeId, competenceRange, managerRange, filterMode]
  )

  const pendingReview = traineeItems.filter(c => !c.coaching_status || c.coaching_status === 'pending')
  const toBeReviewedLater = traineeItems.filter(c => c.coaching_status === 'not_now')
  const totalItems = pendingReview.length + toBeReviewedLater.length

  const overlayCompletion = overlayCompletionId ? completions.find(c => c.id === overlayCompletionId) : null
  const overlayTask = overlayCompletion ? taskMap.get(overlayCompletion.training_task_id) : null

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const stars = (rating: number) => [1, 2, 3, 4, 5].map(s => (
    <svg key={s} width="10" height="10" viewBox="0 0 24 24" fill={s <= rating ? '#C9A96E' : 'none'} stroke={s <= rating ? '#C9A96E' : '#D1D5DB'} strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
  ))

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
      </div>

      {/* Rating filters */}
      <div className="card p-4 mb-6">
        <div className="flex items-start gap-4">
          {/* Competence Rating */}
          <div className="flex-1">
            <p className="text-xs text-charcoal/40 uppercase tracking-wider font-medium mb-3">Competence Rating</p>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-medium text-charcoal/50 w-4 text-center">{competenceRange[0]}</span>
              <span className="text-xs text-charcoal/20">to</span>
              <span className="text-xs font-medium text-charcoal/50 w-4 text-center">{competenceRange[1]}</span>
            </div>
            <RangeSlider min={1} max={5} value={competenceRange} onChange={setCompetenceRange} />
          </div>

          {/* AND / OR toggle */}
          <div className="flex flex-col items-center pt-7">
            <button
              onClick={() => setFilterMode(prev => prev === 'and' ? 'or' : 'and')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider transition-all ${
                filterMode === 'and'
                  ? 'bg-charcoal/10 text-charcoal/60'
                  : 'bg-gold/10 text-gold'
              }`}
            >
              {filterMode.toUpperCase()}
            </button>
          </div>

          {/* Manager Rating */}
          <div className="flex-1">
            <p className="text-xs text-charcoal/40 uppercase tracking-wider font-medium mb-3">Manager Rating</p>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-medium text-charcoal/50 w-4 text-center">{managerRange[0]}</span>
              <span className="text-xs text-charcoal/20">to</span>
              <span className="text-xs font-medium text-charcoal/50 w-4 text-center">{managerRange[1]}</span>
            </div>
            <RangeSlider min={1} max={5} value={managerRange} onChange={setManagerRange} />
          </div>
        </div>
        <p className="text-[10px] text-charcoal/30 text-center mt-3">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
      </div>

      {/* Pending Review */}
      <div className="mb-8">
        <h2 className="font-serif text-lg text-charcoal mb-3">Consider revisiting this topic with {sortedTrainees.find(t => t.id === selectedTraineeId)?.name.split(' ')[0] ?? 'trainee'}</h2>
        {pendingReview.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-charcoal/30">No items pending review</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingReview.map(c => <CoachingListItem key={c.id} completion={c} taskMap={taskMap} getBreadcrumb={getBreadcrumb} getCourseColour={getCourseColour} formatDate={formatDate} stars={stars} onClick={() => setOverlayCompletionId(c.id)} />)}
          </div>
        )}
      </div>

      {/* To Be Reviewed Later */}
      {toBeReviewedLater.length > 0 && (
        <div className="mb-8">
          <h2 className="font-serif text-lg text-charcoal/40 mb-3">To Be Reviewed Later <span className="text-xs text-charcoal/30">{toBeReviewedLater.length}</span></h2>
          <div className="space-y-2">
            {toBeReviewedLater.map(c => <CoachingListItem key={c.id} completion={c} taskMap={taskMap} getBreadcrumb={getBreadcrumb} getCourseColour={getCourseColour} formatDate={formatDate} stars={stars} onClick={() => setOverlayCompletionId(c.id)} deferred />)}
          </div>
        </div>
      )}

      {/* Coaching overlay */}
      {overlayCompletion && overlayTask && (
        <CoachingOverlay
          completion={overlayCompletion}
          task={overlayTask}
          breadcrumb={getBreadcrumb(overlayCompletion.training_task_id)}
          onClose={() => setOverlayCompletionId(null)}
          onAddToPlate={async () => {
            const result = await coachingAddToPlate(overlayCompletion.id, selectedTraineeId)
            if (result.error) { alert(result.error); return }
            setCompletions(prev => prev.map(c =>
              c.id === overlayCompletion.id ? { ...c, coaching_status: 'added_to_plate' as const, reset_at: new Date().toISOString() } : c
            ))
            setOverlayCompletionId(null)
            router.refresh()
          }}
          onNotNow={async () => {
            const result = await coachingNotNow(overlayCompletion.id, selectedTraineeId)
            if (result.error) { alert(result.error); return }
            setCompletions(prev => prev.map(c =>
              c.id === overlayCompletion.id ? { ...c, coaching_status: 'not_now' as const, coaching_not_now_until: result.reviewDate ?? null } : c
            ))
            setOverlayCompletionId(null)
          }}
          onDismiss={async () => {
            const result = await coachingDismiss(overlayCompletion.id)
            if (result.error) { alert(result.error); return }
            setCompletions(prev => prev.map(c =>
              c.id === overlayCompletion.id ? { ...c, coaching_status: 'dismissed' as const } : c
            ))
            setOverlayCompletionId(null)
          }}
        />
      )}
    </div>
  )
}

function CoachingListItem({ completion: c, taskMap, getBreadcrumb, getCourseColour, formatDate, stars, onClick, deferred }: {
  completion: TrainingTaskCompletion
  taskMap: Map<string, TrainingTask>
  getBreadcrumb: (id: string) => string
  getCourseColour: (id: string) => string
  formatDate: (s: string) => string
  stars: (r: number) => React.ReactNode[]
  onClick: () => void
  deferred?: boolean
}) {
  const task = taskMap.get(c.training_task_id)
  const colour = getCourseColour(c.training_task_id)
  return (
    <button
      onClick={onClick}
      className={`w-full card p-4 text-left hover:shadow-md transition-shadow ${deferred ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: colour }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-charcoal">{task?.title || 'Unknown Task'}</p>
          <p className="text-[10px] text-charcoal/30 mt-0.5">{getBreadcrumb(c.training_task_id)}</p>
          <p className="text-[10px] text-charcoal/30 mt-0.5">Completed {formatDate(c.completed_at)}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {c.confidence_rating && <span className="flex items-center gap-0.5 text-[10px] text-charcoal/30">{stars(c.confidence_rating)}</span>}
            {c.manager_rating && (
              <>
                <span className="text-[10px] text-charcoal/15">|</span>
                <span className="flex items-center gap-0.5 text-[10px] text-charcoal/30">Mgr: {stars(c.manager_rating)}</span>
              </>
            )}
            {task?.is_recurring && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Recurring</span>}
          </div>
          {deferred && c.coaching_not_now_until && (
            <p className="text-[10px] text-charcoal/25 mt-1">Review after {new Date(c.coaching_not_now_until + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
          )}
        </div>
      </div>
    </button>
  )
}

function CoachingOverlay({
  completion,
  task,
  breadcrumb,
  onClose,
  onAddToPlate,
  onNotNow,
  onDismiss,
}: {
  completion: TrainingTaskCompletion
  task: TrainingTask
  breadcrumb: string
  onClose: () => void
  onAddToPlate: () => void
  onNotNow: () => void
  onDismiss: () => void
}) {
  const [acting, setActing] = useState(false)
  const isRecurring = task.is_recurring

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30" />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-black/5 flex items-start justify-between">
          <div>
            <p className="text-xs text-charcoal/30 mb-1">{breadcrumb}</p>
            <h2 className="font-serif text-lg text-charcoal">{task.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-charcoal/30 hover:text-charcoal/60 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex flex-wrap gap-2">
            {task.trainer_type && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.trainer_type}</span>}
            {task.modality && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{task.modality}</span>}
            {task.is_recurring && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">Recurring ×{task.recurring_count}</span>}
          </div>

          {/* Trainee submission */}
          <div className="border-t border-black/5 pt-4">
            <p className="text-[10px] text-charcoal/30 uppercase tracking-wider font-medium mb-3">Trainee Submission</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-charcoal/50 mb-1">{isRecurring ? 'What did you observe?' : 'Key Takeaways'}</label>
                <div className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{completion.takeaways}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-charcoal/50 mb-1">{isRecurring ? 'Questions / Want to know more' : 'Summary'}</label>
                <div className="text-sm text-charcoal/70 leading-relaxed bg-charcoal/[0.02] rounded-xl p-3 whitespace-pre-wrap">{completion.summary}</div>
              </div>
              {completion.confidence_rating && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 mb-1">Competence Rating</label>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <svg key={star} width="20" height="20" viewBox="0 0 24 24" fill={star <= completion.confidence_rating! ? '#C9A96E' : 'none'} stroke={star <= completion.confidence_rating! ? '#C9A96E' : '#D1D5DB'} strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    ))}
                  </div>
                </div>
              )}
              {completion.manager_coaching && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 mb-1">Manager Coaching</label>
                  <div className="text-sm text-charcoal/70 leading-relaxed bg-gold/5 border border-gold/10 rounded-xl p-3 whitespace-pre-wrap">{completion.manager_coaching}</div>
                </div>
              )}
              <p className="text-[10px] text-charcoal/30">
                Completed {new Date(completion.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-black/5 space-y-2">
          <button
            onClick={async () => { setActing(true); await onAddToPlate(); setActing(false) }}
            disabled={acting}
            className="w-full px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            Add to Plate
          </button>
          <div className="flex gap-2">
            <button
              onClick={async () => { setActing(true); await onNotNow(); setActing(false) }}
              disabled={acting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal/50 hover:text-charcoal rounded-xl border border-charcoal/15 transition-colors disabled:opacity-50"
            >
              Not Now
            </button>
            <button
              onClick={async () => { setActing(true); await onDismiss(); setActing(false) }}
              disabled={acting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal/30 hover:text-charcoal/50 rounded-xl border border-charcoal/10 transition-colors disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RangeSlider({ min, max, value, onChange }: {
  min: number
  max: number
  value: [number, number]
  onChange: (v: [number, number]) => void
}) {
  const steps = max - min
  const leftPct = ((value[0] - min) / steps) * 100
  const rightPct = ((value[1] - min) / steps) * 100

  return (
    <div className="relative h-8 flex items-center">
      {/* Track background */}
      <div className="absolute left-0 right-0 h-1.5 bg-charcoal/10 rounded-full" />
      {/* Active track */}
      <div
        className="absolute h-1.5 bg-gold rounded-full"
        style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
      />
      {/* Tick marks */}
      {Array.from({ length: steps + 1 }, (_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-3 bg-charcoal/10 rounded-full -translate-x-1/2"
          style={{ left: `${(i / steps) * 100}%` }}
        />
      ))}
      {/* Min thumb */}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value[0]}
        onChange={e => {
          const v = parseInt(e.target.value)
          onChange([Math.min(v, value[1]), value[1]])
        }}
        className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
        style={{ zIndex: value[0] === value[1] ? 2 : 1 }}
      />
      {/* Max thumb */}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value[1]}
        onChange={e => {
          const v = parseInt(e.target.value)
          onChange([value[0], Math.max(v, value[0])])
        }}
        className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gold [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-gold [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
        style={{ zIndex: 2 }}
      />
      {/* Labels */}
      <div className="absolute -bottom-3 left-0 right-0 flex justify-between">
        {Array.from({ length: steps + 1 }, (_, i) => (
          <span key={i} className="text-[9px] text-charcoal/25 -translate-x-1/2" style={{ left: `${(i / steps) * 100}%`, position: 'absolute' }}>{min + i}</span>
        ))}
      </div>
    </div>
  )
}
