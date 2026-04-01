'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import { COURSE_COLOURS } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Course, Category, Subcategory, TrainingTask, TrainingTaskContent, TrainingTaskCompletion, TrainingTaskAssigned, User } from '@/types'

interface Props {
  currentUser: User
  assignments: TrainingTaskAssigned[]
  trainingTasks: TrainingTask[]
  taskContent: TrainingTaskContent[]
  completions: TrainingTaskCompletion[]
  subcategories: Subcategory[]
  categories: Category[]
  courses: Course[]
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateDisplay(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00')
  const today = toDateKey(new Date())
  const label = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (dateKey === today) return `Today — ${label}`
  return label
}

export function TraineeDayPlate({ currentUser, assignments, trainingTasks, taskContent, completions: initialCompletions, subcategories, categories, courses }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [completions, setCompletions] = useState(initialCompletions)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [completionOverlay, setCompletionOverlay] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()))
  const [showCalendar, setShowCalendar] = useState(false)

  // All dates that have assignments for this trainee
  const allAssignedDates = useMemo(() => {
    const dates = new Set(assignments.map(a => a.assigned_date))
    return [...dates].sort()
  }, [assignments])

  // Tasks for selected date
  const dayAssignments = useMemo(() =>
    assignments.filter(a => a.assigned_date === selectedDate),
    [assignments, selectedDate]
  )

  const dayTaskIds = useMemo(() => dayAssignments.map(a => a.training_task_id), [dayAssignments])

  const dayTasks = useMemo(() =>
    dayTaskIds.map(id => trainingTasks.find(t => t.id === id)).filter(Boolean) as TrainingTask[],
    [dayTaskIds, trainingTasks]
  )

  // Helpers
  const getCompletionCount = (taskId: string) => completions.filter(c => c.training_task_id === taskId).length
  const getRequiredCount = (task: TrainingTask) => task.is_recurring && task.recurring_count ? task.recurring_count : 1
  const isTaskCompleted = (taskId: string) => {
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return false
    return getCompletionCount(taskId) >= getRequiredCount(task)
  }
  const isTaskCompletedOnDate = (taskId: string, dateKey: string) => {
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return false
    if (!task.is_recurring) return isTaskCompleted(taskId)
    return completions.some(c => c.training_task_id === taskId && c.completed_at.split('T')[0] === dateKey)
  }

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

  function getBreadcrumb(taskId: string) {
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return ''
    const sub = subcategories.find(s => s.id === task.subcategory_id)
    const cat = sub ? categories.find(c => c.id === sub.category_id) : null
    const course = cat ? courses.find(c => c.id === cat.course_id) : null
    return [course?.name, cat?.title, sub?.title].filter(Boolean).join(' › ')
  }

  function getCourseColour(taskId: string) {
    const task = trainingTasks.find(t => t.id === taskId)
    if (!task) return '#C9A96E'
    const sub = subcategories.find(s => s.id === task.subcategory_id)
    const cat = sub ? categories.find(c => c.id === sub.category_id) : null
    const course = cat ? courses.find(c => c.id === cat.course_id) : null
    return course?.colour_hex || COURSE_COLOURS[course?.name ?? ''] || '#C9A96E'
  }

  // Date navigation
  function goToPrevDate() {
    const idx = allAssignedDates.indexOf(selectedDate)
    if (idx > 0) setSelectedDate(allAssignedDates[idx - 1])
  }

  function goToNextDate() {
    const idx = allAssignedDates.indexOf(selectedDate)
    if (idx < allAssignedDates.length - 1) setSelectedDate(allAssignedDates[idx + 1])
  }

  const hasPrev = allAssignedDates.indexOf(selectedDate) > 0
  const hasNext = allAssignedDates.indexOf(selectedDate) < allAssignedDates.length - 1

  // Completion
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
    router.refresh()
  }

  // Selected task for detail overlay
  const selTask = selectedTaskId ? trainingTasks.find(t => t.id === selectedTaskId) : null
  const selTaskSub = selTask ? subcategories.find(s => s.id === selTask.subcategory_id) : null
  const selTaskCat = selTaskSub ? categories.find(c => c.id === selTaskSub.category_id) : null

  // Pending and completed split
  const pendingTasks = dayTasks.filter(t => !isTaskCompletedOnDate(t.id, selectedDate))
  const completedTasks = dayTasks.filter(t => isTaskCompletedOnDate(t.id, selectedDate))

  // Calendar month for picker
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  function getCalendarDays() {
    const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1)
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday start
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate()
    const days: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(calendarMonth.year, calendarMonth.month, d))
    return days
  }

  const assignedDatesSet = new Set(allAssignedDates)

  return (
    <div className="max-w-3xl mx-auto px-5 py-6">
      {/* Date header with arrows and calendar */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          onClick={goToPrevDate}
          disabled={!hasPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-charcoal/60 transition-colors disabled:opacity-20"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-charcoal/3 transition-all"
          >
            <Calendar size={16} className="text-gold" />
            <h1 className="font-serif text-lg text-charcoal">{formatDateDisplay(selectedDate)}</h1>
          </button>

          {/* Calendar picker */}
          {showCalendar && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-black/5 p-4 z-50 w-[300px]">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCalendarMonth(prev => {
                  const d = new Date(prev.year, prev.month - 1)
                  return { year: d.getFullYear(), month: d.getMonth() }
                })} className="p-1 text-charcoal/30 hover:text-charcoal/60"><ChevronLeft size={16} /></button>
                <span className="text-sm font-medium text-charcoal">
                  {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCalendarMonth(prev => {
                  const d = new Date(prev.year, prev.month + 1)
                  return { year: d.getFullYear(), month: d.getMonth() }
                })} className="p-1 text-charcoal/30 hover:text-charcoal/60"><ChevronRight size={16} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i} className="text-[10px] text-charcoal/30 py-1">{d}</span>
                ))}
                {getCalendarDays().map((day, i) => {
                  if (!day) return <span key={i} />
                  const dk = toDateKey(day)
                  const hasAssignments = assignedDatesSet.has(dk)
                  const isSelected = dk === selectedDate
                  const isToday = dk === toDateKey(new Date())
                  return (
                    <button
                      key={i}
                      onClick={() => { if (hasAssignments) { setSelectedDate(dk); setShowCalendar(false) } }}
                      disabled={!hasAssignments}
                      className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all ${
                        isSelected ? 'bg-gold text-white font-medium'
                        : hasAssignments ? 'text-charcoal hover:bg-charcoal/5 font-medium'
                        : 'text-charcoal/15'
                      } ${isToday && !isSelected ? 'ring-1 ring-gold/30' : ''}`}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={goToNextDate}
          disabled={!hasNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-charcoal/60 transition-colors disabled:opacity-20"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Close calendar on outside click */}
      {showCalendar && <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />}

      {dayTasks.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-charcoal/30">No training tasks assigned for this date</p>
        </div>
      ) : (
        <>
          {/* Pending tasks */}
          {pendingTasks.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-charcoal/30 uppercase tracking-wider mb-3">To Complete — {pendingTasks.length} remaining</p>
              <div className="space-y-2">
                {pendingTasks.map(task => {
                  const colour = getCourseColour(task.id)
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="w-full card p-4 text-left hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: colour }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-charcoal">{task.title}</p>
                          <p className="text-[10px] text-charcoal/30 mt-0.5">{getBreadcrumb(task.id)}</p>
                          <p className="text-[10px] text-charcoal/30 mt-0.5">
                            {getCompletionCount(task.id)}/{getRequiredCount(task)} completion{getRequiredCount(task) !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {task.is_recurring && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">Recurring</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div>
              <p className="text-xs text-charcoal/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Check size={12} className="text-green-600" /> Completed — {completedTasks.length}
              </p>
              <div className="space-y-2">
                {completedTasks.map(task => {
                  const colour = getCourseColour(task.id)
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="w-full card p-4 text-left hover:shadow-md transition-shadow bg-green-50/50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: colour }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-charcoal">{task.title}</p>
                          <p className="text-[10px] text-charcoal/30 mt-0.5">{getBreadcrumb(task.id)}</p>
                        </div>
                        <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Task detail overlay */}
      {selTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setSelectedTaskId(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg mx-0 sm:mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-black/5 flex items-start justify-between">
              <div>
                <p className="text-xs text-charcoal/30 mb-1">
                  {selTaskCat?.course && <span>{(selTaskCat.course as Course).name} &rsaquo; </span>}
                  {selTaskCat && <span>{selTaskCat.title} &rsaquo; </span>}
                  {selTaskSub && <span>{selTaskSub.title}</span>}
                </p>
                <h2 className="font-serif text-lg text-charcoal">{selTask.title}</h2>
              </div>
              <button onClick={() => setSelectedTaskId(null)} className="p-1 text-charcoal/30 hover:text-charcoal/60 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-5">
                {selTask.trainer_type && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selTask.trainer_type}</span>}
                {selTask.modality && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selTask.modality}</span>}
                {selTask.priority_level && <span className="text-xs px-2.5 py-1 rounded-full bg-charcoal/5 text-charcoal/50">{selTask.priority_level}</span>}
                {selTask.is_recurring && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">Recurring ×{selTask.recurring_count}</span>}
              </div>

              {/* Content */}
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
                  const done = isTaskCompletedOnDate(selTask.id, selectedDate)
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
                        onClick={() => { setSelectedTaskId(null); setCompletionOverlay(selTask.id) }}
                        className="w-full px-4 py-3 rounded-xl bg-gold text-white font-medium text-sm hover:bg-gold/90 transition-colors"
                      >
                        {isLast ? 'Mark as Complete' : selTask.is_recurring ? 'Shadow Task' : 'Mark as Complete'}
                      </button>
                    </>
                  )
                })()}
              </div>

              {/* From Your Mentor */}
              {(() => {
                const taskCompletions = completions.filter(c => c.training_task_id === selTask.id && c.manager_coaching)
                if (taskCompletions.length === 0) return null
                return (
                  <div className="mt-6 pt-6 border-t border-black/5">
                    <p className="text-xs text-charcoal/30 uppercase tracking-wider font-medium mb-3">From Your Mentor</p>
                    <div className="space-y-3">
                      {taskCompletions.map(c => (
                        <div key={c.id} className="rounded-xl bg-gold/5 border border-gold/10 p-3">
                          <p className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{c.manager_coaching}</p>
                          <p className="text-[10px] text-charcoal/30 mt-2">
                            {new Date(c.signed_off_at!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Completion overlay — reuse same pattern as TraineeMenu */}
      {completionOverlay && (() => {
        const task = trainingTasks.find(t => t.id === completionOverlay)!
        const count = getCompletionCount(completionOverlay)
        const required = getRequiredCount(task)
        const taskCompletions = completions.filter(c => c.training_task_id === completionOverlay)
        const hasPreviousCertificate = taskCompletions.some(c => c.certificate_url !== null)
        return (
          <CompletionOverlay
            task={task}
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

// Completion overlay — same as TraineeMenu
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

  function wordCount(s: string) { return s.trim().split(/\s+/).filter(Boolean).length }

  const errors = {
    takeaways: wordCount(takeaways) < 10,
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
    if (hasErrors) { setShowErrors(true); return }
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
        <div className="px-5 pt-5 pb-3 border-b border-black/5">
          <h2 className="font-serif text-lg text-charcoal">{isRecurring ? `Mark as Shadowed ${completionNumber}/${requiredCount}` : 'Complete Training Task'}</h2>
          <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-1">{task.title}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
              {isRecurring ? 'What did you observe?' : 'What were your three key takeaways?'} <span className="text-red-400">*</span>
            </label>
            <textarea className={`textarea text-sm ${showErrors && errors.takeaways ? 'border-red-300 bg-red-50/30' : ''}`} rows={5} value={takeaways} onChange={e => setTakeaways(e.target.value)} placeholder={isRecurring ? 'Describe what you observed... (minimum 10 words)' : 'Share your three key takeaways... (minimum 10 words)'} />
            <p className={`text-[10px] mt-1 ${showErrors && errors.takeaways ? 'text-red-400' : 'text-charcoal/30'}`}>{wordCount(takeaways)} / 10 words min</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
              {isRecurring ? 'What questions do you have, or what would you like to know more about?' : 'Brief Summary'} <span className="text-red-400">*</span>
            </label>
            <textarea className={`textarea text-sm ${showErrors && errors.summary ? 'border-red-300 bg-red-50/30' : ''}`} rows={4} value={summary} onChange={e => setSummary(e.target.value)} placeholder={isRecurring ? 'Share your questions or areas of interest... (minimum 20 words)' : 'Write a brief summary of what you covered (minimum 20 words)'} />
            <p className={`text-[10px] mt-1 ${showErrors && errors.summary ? 'text-red-400' : 'text-charcoal/30'}`}>{wordCount(summary)} / 20 words min</p>
          </div>
          {needsRating && (
            <div>
              <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">Competence Rating <span className="text-red-400">*</span></label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className="p-1 transition-transform hover:scale-110">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill={star <= rating ? '#C9A96E' : 'none'} stroke={star <= rating ? '#C9A96E' : '#D1D5DB'} strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  </button>
                ))}
              </div>
              {showErrors && errors.rating && <p className="text-[10px] text-red-400 mt-1">Please select a competence rating</p>}
            </div>
          )}
          {needsCert && (
            <>
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Certificate Reference Number</label>
                <input className="input text-sm" value={certRef} onChange={e => setCertRef(e.target.value)} placeholder="Optional — enter certificate reference number" />
              </div>
              {showCertUpload && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Certificate Upload</label>
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

        <div className="flex gap-3 px-5 py-4 border-t border-black/5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal/50 hover:text-charcoal rounded-xl border border-charcoal/15 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-xl hover:bg-gold/90 transition-colors disabled:opacity-50">
            {submitting ? 'Submitting...' : isLast ? 'Complete Task' : 'Mark as Shadowed'}
          </button>
        </div>
      </div>
    </div>
  )
}
