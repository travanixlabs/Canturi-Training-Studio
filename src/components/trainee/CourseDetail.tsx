'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, Check, BookOpen } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { TaskModal } from '@/components/ui/TaskModal'
import { CourseCelebrationScreen } from '@/components/ui/CourseCelebrationScreen'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { MenuItem, Module, ModuleCompletion, Completion, Plate, User, RecurringTaskCompletion } from '@/types'
import { todayAEDT } from '@/lib/dates'

interface Props {
  menuItem: MenuItem
  modules: Module[]
  moduleCompletions: ModuleCompletion[]
  existingCompletion: Completion | null
  plate: Plate | null
  currentUser: User
  recurringCompletions?: RecurringTaskCompletion[]
  siblingItems?: MenuItem[]
  siblingCompletions?: Completion[]
  allPlates?: Plate[]
}

export function CourseDetail({ menuItem, modules, moduleCompletions: initialMC, existingCompletion, plate, currentUser, recurringCompletions: initialRC = [], siblingItems = [], siblingCompletions = [], allPlates = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [completedModules, setCompletedModules] = useState<ModuleCompletion[]>(initialMC)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [courseCompleted, setCourseCompleted] = useState(!!existingCompletion)
  const [recurringComps, setRecurringComps] = useState<RecurringTaskCompletion[]>(initialRC)
  const [markingRecurring, setMarkingRecurring] = useState(false)
  const [showCourseCelebration, setShowCourseCelebration] = useState(false)
  const [viewingRecurringTask, setViewingRecurringTask] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')

  const hasModules = modules.length > 0

  // Check if completing this category finishes the entire course
  const otherSiblings = siblingItems.filter(s => s.id !== menuItem.id && s.status === 'active')
  const otherSiblingsDone = otherSiblings.every(s => siblingCompletions.some(c => c.menu_item_id === s.id))
  const willCompleteCourse = otherSiblings.length > 0 && otherSiblingsDone
  const courseName = menuItem.category?.name ?? 'Course'

  // Session state
  const isRecurringItem = menuItem.is_recurring && !!menuItem.recurring_amount
  const recurringTotal = menuItem.recurring_amount ?? 0
  const recurringDone = recurringComps.length
  const recurringFullyComplete = isRecurringItem && recurringDone >= recurringTotal
  const todayStr = todayAEDT()
  const assignedPlateDates = allPlates.filter(p => p.menu_item_id === menuItem.id && p.trainee_id === currentUser.id).map(p => p.date_assigned)
  const assignedSessionCount = recurringComps.filter(rc => assignedPlateDates.includes(rc.completed_date)).length
  const shadowedSessionCount = recurringDone - assignedSessionCount

  const isModuleComplete = (moduleId: string) =>
    completedModules.some(mc => mc.module_id === moduleId && mc.trainee_id === currentUser.id)

  const completedCount = useMemo(
    () => modules.filter(m => isModuleComplete(m.id)).length,
    [completedModules, modules]
  )
  const allModulesComplete = hasModules ? completedCount === modules.length : true

  const activeModule = useMemo(() => {
    if (!hasModules) return null
    if (viewingRecurringTask) return null
    if (selectedModuleId) return modules.find(m => m.id === selectedModuleId) ?? modules[0]
    const firstIncomplete = modules.find(m => !isModuleComplete(m.id))
    return firstIncomplete ?? modules[0]
  }, [selectedModuleId, modules, completedModules, viewingRecurringTask])

  async function toggleModuleComplete(moduleId: string) {
    const existing = completedModules.find(mc => mc.module_id === moduleId && mc.trainee_id === currentUser.id)

    if (existing) {
      setCompletedModules(prev => prev.filter(mc => mc.id !== existing.id))
      await supabase.from('module_completions').delete().eq('id', existing.id)
    } else {
      const { data, error } = await supabase.from('module_completions').insert({
        module_id: moduleId,
        trainee_id: currentUser.id,
        workshop_id: plate?.workshop_id ?? null,
      }).select().single()

      if (!error && data) {
        setCompletedModules(prev => [...prev, data as ModuleCompletion])
        // Auto-advance to next incomplete module
        const currentIdx = modules.findIndex(m => m.id === moduleId)
        const nextIncomplete = modules.find((m, i) => i > currentIdx && !isModuleComplete(m.id) && m.id !== moduleId)
        if (nextIncomplete) setSelectedModuleId(nextIncomplete.id)
      }
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/trainee')
    }
  }

  async function markSessionDone() {
    if (markingRecurring || !sessionNotes.trim()) return
    setMarkingRecurring(true)
    const { data, error } = await supabase.from('recurring_task_completions').insert({
      trainee_id: currentUser.id,
      menu_item_id: menuItem.id,
      completed_date: todayStr,
      notes: sessionNotes.trim(),
      workshop_id: plate?.workshop_id ?? null,
    }).select().single()
    if (!error && data) {
      setRecurringComps(prev => [...prev, data as RecurringTaskCompletion])
      setSessionNotes('')
    } else if (error) {
      alert('Failed to save session: ' + error.message)
    }
    setMarkingRecurring(false)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Session history sorted most recent first
  const sessionHistory = useMemo(
    () => [...recurringComps].sort((a, b) => b.completed_date.localeCompare(a.completed_date) || b.created_at.localeCompare(a.created_at)),
    [recurringComps]
  )

  return (
    <>
      <div className="min-h-screen bg-ivory">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="text-charcoal/50 hover:text-charcoal transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            {menuItem.category && (
              <CategoryBadge categoryName={menuItem.category.name} icon={menuItem.category.icon} />
            )}
            <h1 className="font-serif text-lg text-charcoal leading-tight truncate mt-0.5">{menuItem.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-charcoal/40 flex-shrink-0">
            <span>{menuItem.time_needed}</span>
            <span>·</span>
            <span>{menuItem.trainer_type}</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Module sidebar */}
          {hasModules && (
            <div className="lg:w-72 lg:min-h-[calc(100vh-57px)] lg:border-r border-b lg:border-b-0 border-black/5 bg-white">
              {/* Mobile: horizontal strip */}
              <div className="lg:hidden px-4 py-3 flex gap-2 overflow-x-auto">
                {modules.map((mod, i) => {
                  const done = isModuleComplete(mod.id)
                  const active = activeModule?.id === mod.id && !viewingRecurringTask
                  return (
                    <button
                      key={mod.id}
                      onClick={() => { setSelectedModuleId(mod.id); setViewingRecurringTask(false) }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border transition-all ${
                        active
                          ? 'border-gold bg-gold/10 text-gold'
                          : done
                          ? 'border-green-200 bg-green-50 text-green-600'
                          : 'border-charcoal/10 text-charcoal/50'
                      }`}
                    >
                      {done ? <Check size={12} /> : <span className="text-charcoal/30">{i + 1}</span>}
                      <span className="truncate max-w-[120px]">{mod.title}</span>
                    </button>
                  )
                })}
                {isRecurringItem && (
                  <button
                    onClick={() => { if (allModulesComplete) { setViewingRecurringTask(true); setSelectedModuleId(null) } }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border transition-all ${
                      viewingRecurringTask
                        ? 'border-blue-300 bg-blue-50 text-blue-600'
                        : allModulesComplete
                        ? 'border-charcoal/10 text-charcoal/50'
                        : 'border-charcoal/5 text-charcoal/20 cursor-not-allowed opacity-40'
                    }`}
                  >
                    <span>↻</span>
                    <span className="truncate max-w-[120px]">Session {recurringDone} / {recurringTotal}</span>
                  </button>
                )}
              </div>

              {/* Desktop: vertical list */}
              <div className="hidden lg:block p-4">
                <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">
                  Modules · {completedCount}/{modules.length}
                </p>
                <div className="space-y-1">
                  {modules.map((mod, i) => {
                    const done = isModuleComplete(mod.id)
                    const active = activeModule?.id === mod.id && !viewingRecurringTask
                    return (
                      <button
                        key={mod.id}
                        onClick={() => { setSelectedModuleId(mod.id); setViewingRecurringTask(false) }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                          active
                            ? 'bg-gold/10 text-gold'
                            : 'hover:bg-charcoal/3 text-charcoal/70'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                          done
                            ? 'bg-green-500 text-white'
                            : active
                            ? 'bg-gold/20 text-gold border border-gold/30'
                            : 'bg-charcoal/8 text-charcoal/40'
                        }`}>
                          {done ? <Check size={12} /> : i + 1}
                        </span>
                        <span className={`text-sm ${done ? 'line-through opacity-50' : ''}`}>{mod.title}</span>
                      </button>
                    )
                  })}

                  {/* Session sidebar item */}
                  {isRecurringItem && (
                    <>
                      <div className="border-t border-black/5 my-2" />
                      <button
                        onClick={() => { if (allModulesComplete) { setViewingRecurringTask(true); setSelectedModuleId(null) } }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                          viewingRecurringTask
                            ? 'bg-blue-50 text-blue-600'
                            : allModulesComplete
                            ? 'hover:bg-charcoal/3 text-charcoal/70'
                            : 'text-charcoal/20 cursor-not-allowed'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                          viewingRecurringTask ? 'bg-blue-500 text-white' : allModulesComplete ? 'bg-charcoal/8 text-charcoal/40' : 'bg-charcoal/5 text-charcoal/15'
                        }`}>↻</span>
                        <span className="text-sm">Session {recurringDone} / {recurringTotal}</span>
                        {!allModulesComplete && <span className="text-[10px] text-charcoal/20 ml-auto">Complete modules first</span>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex-1 px-5 py-6 max-w-3xl">
            {activeModule ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={14} className="text-charcoal/30" />
                  <p className="text-xs text-charcoal/40 uppercase tracking-wider">
                    Module {modules.indexOf(activeModule) + 1} of {modules.length}
                  </p>
                </div>
                <h2 className="font-serif text-xl text-charcoal mb-4">{activeModule.title}</h2>

                <div className="prose prose-sm max-w-none text-charcoal/70 leading-relaxed whitespace-pre-wrap mb-6">
                  {activeModule.content || 'No content added yet.'}
                </div>

                {/* Module completion toggle */}
                {!courseCompleted && (
                  <button
                    onClick={() => toggleModuleComplete(activeModule.id)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all ${
                      isModuleComplete(activeModule.id)
                        ? 'bg-green-50 text-green-600 border border-green-200'
                        : 'btn-gold'
                    }`}
                  >
                    {isModuleComplete(activeModule.id) ? (
                      <><Check size={16} /> Module completed</>
                    ) : (
                      <>Mark module as done</>
                    )}
                  </button>
                )}

                {/* Show complete course button when all modules done (non-recurring only) */}
                {!courseCompleted && allModulesComplete && !isRecurringItem && (
                  <div className="mt-8 pt-6 border-t border-black/5">
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      className="btn-gold w-full"
                    >
                      Mark as complete
                    </button>
                  </div>
                )}
              </div>
            ) : !hasModules ? (
              /* No modules — show description + complete button */
              <div>
                <h2 className="font-serif text-xl text-charcoal mb-4">{menuItem.title}</h2>
                <div className="prose prose-sm max-w-none text-charcoal/70 leading-relaxed whitespace-pre-wrap mb-4">
                  {menuItem.description}
                </div>
                {menuItem.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {menuItem.tags.map(tag => (
                      <span key={tag} className="text-xs text-charcoal/40 bg-charcoal/5 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}

                {!courseCompleted && !isRecurringItem && (
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    className="btn-gold w-full"
                  >
                    Mark as complete
                  </button>
                )}
                {!courseCompleted && isRecurringItem && !viewingRecurringTask && (
                  <button
                    onClick={() => setViewingRecurringTask(true)}
                    className="btn-gold w-full"
                  >
                    Session Details
                  </button>
                )}
              </div>
            ) : null}

            {/* Session Details — inline */}
            {viewingRecurringTask && isRecurringItem && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-charcoal/30">↻</span>
                  <p className="text-xs text-charcoal/40 uppercase tracking-wider">Session</p>
                </div>
                <h2 className="font-serif text-xl text-charcoal mb-4">Session Details</h2>

                {menuItem.recurring_task_content && (
                  <div className="prose prose-sm max-w-none text-charcoal/70 leading-relaxed whitespace-pre-wrap mb-6">
                    {menuItem.recurring_task_content}
                  </div>
                )}

                {/* Progress */}
                <div className="card p-4 mb-6">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-charcoal/60">Session progress</span>
                    <span className={`font-medium ${recurringFullyComplete ? 'text-green-600' : recurringDone > 0 ? 'text-blue-600' : 'text-charcoal'}`}>
                      {recurringDone}/{recurringTotal}
                    </span>
                  </div>
                  <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${recurringFullyComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${recurringTotal > 0 ? Math.min((recurringDone / recurringTotal) * 100, 100) : 0}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-2 ${recurringFullyComplete ? 'text-green-600' : 'text-charcoal/40'}`}>
                    {recurringDone} out of {recurringTotal} sessions completed
                    {recurringDone > 0 && (
                      <span className="ml-1">
                        | {shadowedSessionCount > 0 && <span className="text-blue-600">{shadowedSessionCount} shadowed</span>}{assignedSessionCount > 0 && shadowedSessionCount > 0 && <span className="text-charcoal/30"> / </span>}{assignedSessionCount > 0 && <span className="text-green-600">{assignedSessionCount} completed</span>}
                      </span>
                    )}
                  </p>
                </div>

                {/* Session history log */}
                {sessionHistory.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">Session History</p>
                    <div className="space-y-2">
                      {sessionHistory.map((entry, idx) => {
                        const sessionNum = sessionHistory.length - idx
                        return (
                        <div key={entry.id} className="card p-4">
                          <p className="text-xs font-medium text-charcoal/50 mb-1">
                            <span className="text-charcoal font-semibold">Session {sessionNum}</span>
                            {' · '}
                            {new Date(entry.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                            {' '}
                            <span className="text-charcoal/30">{new Date(entry.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </p>
                          {entry.notes ? (
                            <p className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{entry.notes}</p>
                          ) : (
                            <p className="text-sm text-charcoal/30 italic">No notes recorded</p>
                          )}
                        </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Notes textarea + Mark session as done */}
                {!courseCompleted && !recurringFullyComplete && (
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                      Session Notes <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      className="textarea font-sans text-sm leading-relaxed mb-3"
                      rows={4}
                      value={sessionNotes}
                      onChange={e => setSessionNotes(e.target.value)}
                      placeholder="What did you observe or practise today?"
                    />
                    <button
                      onClick={markSessionDone}
                      disabled={markingRecurring || !sessionNotes.trim()}
                      className={`btn-gold w-full ${!sessionNotes.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {markingRecurring ? 'Saving...' : 'Mark session as done'}
                    </button>
                  </div>
                )}

                {!courseCompleted && recurringFullyComplete && (
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    className="btn-gold w-full"
                  >
                    Mark as complete
                  </button>
                )}

                {courseCompleted && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
                    <Check size={16} />
                    <span>Completed {existingCompletion?.completed_date ?? 'today'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Already completed */}
            {courseCompleted && !viewingRecurringTask && (
              <div className={`${hasModules ? 'mt-8 pt-6 border-t border-black/5' : ''}`}>
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
                  <Check size={16} />
                  <span>Completed {existingCompletion?.completed_date ?? 'today'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Details — inline in main content area is handled above */}

      {/* Completion popup */}
      {showCompleteModal && (
        <TaskModal
          item={menuItem}
          plate={plate}
          existingCompletion={existingCompletion}
          currentUser={currentUser}
          mode="trainee"
          onClose={() => setShowCompleteModal(false)}
          onComplete={() => {
            setCourseCompleted(true)
            setShowCompleteModal(false)
            router.refresh()
          }}
          onCategoryCelebrationDone={willCompleteCourse ? () => {
            setShowCompleteModal(false)
            setShowCourseCelebration(true)
          } : undefined}
        />
      )}

      {showCourseCelebration && (
        <CourseCelebrationScreen
          traineeName={currentUser.name}
          courseTitle={courseName}
          onContinue={() => {
            setShowCourseCelebration(false)
            router.push('/trainee/menu')
          }}
        />
      )}
    </>
  )
}
