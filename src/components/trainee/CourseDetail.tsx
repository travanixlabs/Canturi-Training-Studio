'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, Check, BookOpen, Save } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { StarRating } from '@/components/ui/StarRating'
import { CelebrationScreen } from '@/components/ui/CelebrationScreen'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { MenuItem, Module, ModuleCompletion, Completion, Plate, User } from '@/types'

interface Props {
  menuItem: MenuItem
  modules: Module[]
  moduleCompletions: ModuleCompletion[]
  existingCompletion: Completion | null
  plate: Plate | null
  currentUser: User
}

export function CourseDetail({ menuItem, modules, moduleCompletions: initialMC, existingCompletion, plate, currentUser }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [completedModules, setCompletedModules] = useState<ModuleCompletion[]>(initialMC)
  const [traineeNotes, setTraineeNotes] = useState(existingCompletion?.trainee_notes ?? '')
  const [traineeRating, setTraineeRating] = useState(existingCompletion?.trainee_rating ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [courseCompleted, setCourseCompleted] = useState(!!existingCompletion)

  const hasModules = modules.length > 0
  const isShadowing = !plate

  const isModuleComplete = (moduleId: string) =>
    completedModules.some(mc => mc.module_id === moduleId && mc.trainee_id === currentUser.id)

  const completedCount = useMemo(
    () => modules.filter(m => isModuleComplete(m.id)).length,
    [completedModules, modules]
  )
  const allModulesComplete = hasModules ? completedCount === modules.length : true

  // Auto-select first incomplete module, or first module
  const activeModule = useMemo(() => {
    if (!hasModules) return null
    if (selectedModuleId) return modules.find(m => m.id === selectedModuleId) ?? modules[0]
    const firstIncomplete = modules.find(m => !isModuleComplete(m.id))
    return firstIncomplete ?? modules[0]
  }, [selectedModuleId, modules, completedModules])

  async function toggleModuleComplete(moduleId: string) {
    const existing = completedModules.find(mc => mc.module_id === moduleId && mc.trainee_id === currentUser.id)

    if (existing) {
      setCompletedModules(prev => prev.filter(mc => mc.id !== existing.id))
      await supabase.from('module_completions').delete().eq('id', existing.id)
    } else {
      const { data, error } = await supabase.from('module_completions').insert({
        module_id: moduleId,
        trainee_id: currentUser.id,
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

  async function handleSave() {
    setSaving(true)
    setSaved(false)

    // Save notes as a draft completion (without completing)
    if (existingCompletion) {
      await supabase.from('completions').update({
        trainee_notes: traineeNotes || null,
        trainee_rating: traineeRating || null,
      }).eq('id', existingCompletion.id)
    } else if (traineeNotes.trim()) {
      // Create a partial save — we store notes in a temporary way
      // For now, we'll use localStorage since we don't want to create a completion record yet
      try {
        localStorage.setItem(`draft-${menuItem.id}`, JSON.stringify({
          notes: traineeNotes,
          rating: traineeRating,
        }))
      } catch { /* ignore */ }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Load draft on mount
  useState(() => {
    if (!existingCompletion) {
      try {
        const draft = localStorage.getItem(`draft-${menuItem.id}`)
        if (draft) {
          const { notes, rating } = JSON.parse(draft)
          if (notes) setTraineeNotes(notes)
          if (rating) setTraineeRating(rating)
        }
      } catch { /* ignore */ }
    }
  })

  async function handleComplete() {
    if (traineeRating === 0) {
      setError('Please give yourself a rating before completing.')
      return
    }
    setSubmitting(true)
    setError(null)

    const completionData = {
      plate_id: plate?.id ?? null,
      menu_item_id: menuItem.id,
      trainee_id: currentUser.id,
      trainee_notes: traineeNotes || null,
      trainee_rating: traineeRating,
      completed_date: new Date().toISOString().split('T')[0],
      is_shadowing_moment: isShadowing,
    }

    const { error: dbError } = existingCompletion
      ? await supabase.from('completions').update(completionData).eq('id', existingCompletion.id)
      : await supabase.from('completions').insert(completionData)

    if (dbError) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    // Clear draft
    try { localStorage.removeItem(`draft-${menuItem.id}`) } catch { /* ignore */ }

    setCelebrating(true)
  }

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/trainee')
    }
  }

  if (celebrating) {
    return (
      <CelebrationScreen
        traineeName={currentUser.name}
        taskTitle={menuItem.title}
        onContinue={() => {
          setCelebrating(false)
          setCourseCompleted(true)
          router.back()
        }}
      />
    )
  }

  return (
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
        {/* Module sidebar / progress strip */}
        {hasModules && (
          <div className="lg:w-72 lg:min-h-[calc(100vh-57px)] lg:border-r border-b lg:border-b-0 border-black/5 bg-white">
            {/* Mobile: horizontal strip */}
            <div className="lg:hidden px-4 py-3 flex gap-2 overflow-x-auto">
              {modules.map((mod, i) => {
                const done = isModuleComplete(mod.id)
                const active = activeModule?.id === mod.id
                return (
                  <button
                    key={mod.id}
                    onClick={() => setSelectedModuleId(mod.id)}
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
            </div>

            {/* Desktop: vertical list */}
            <div className="hidden lg:block p-4">
              <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">
                Modules · {completedCount}/{modules.length}
              </p>
              <div className="space-y-1">
                {modules.map((mod, i) => {
                  const done = isModuleComplete(mod.id)
                  const active = activeModule?.id === mod.id
                  return (
                    <button
                      key={mod.id}
                      onClick={() => setSelectedModuleId(mod.id)}
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
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 px-5 py-6 max-w-3xl">
          {/* Module content */}
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
                {activeModule.content}
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
            </div>
          ) : (
            /* No modules — show course description directly */
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
            </div>
          )}

          {/* Course completion section */}
          {!courseCompleted && (
            <div className={`mt-8 pt-6 border-t border-black/5 ${hasModules && !allModulesComplete ? 'opacity-40 pointer-events-none' : ''}`}>
              {hasModules && !allModulesComplete && (
                <p className="text-sm text-charcoal/40 mb-4">Complete all modules to unlock course completion.</p>
              )}

              <h3 className="text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-3">
                {isShadowing ? 'Log shadowing moment' : 'Complete this course'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                    Notes & observations
                  </label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={traineeNotes}
                    onChange={e => setTraineeNotes(e.target.value)}
                    placeholder="What did you observe? Any questions to follow up on?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                    How confident do you feel?
                  </label>
                  <StarRating
                    value={traineeRating}
                    onChange={setTraineeRating}
                    size="lg"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3">
                  {/* Save progress */}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-outline flex items-center gap-2"
                  >
                    {saved ? (
                      <><Check size={14} /> Saved</>
                    ) : saving ? (
                      'Saving…'
                    ) : (
                      <><Save size={14} /> Save progress</>
                    )}
                  </button>

                  {/* Complete */}
                  <button
                    onClick={handleComplete}
                    disabled={submitting || traineeRating === 0 || (hasModules && !allModulesComplete)}
                    className="btn-gold flex-1"
                  >
                    {submitting ? 'Completing…' : isShadowing ? 'Log shadowing moment' : 'Mark as complete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Already completed */}
          {courseCompleted && (
            <div className="mt-8 pt-6 border-t border-black/5">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
                <Check size={16} />
                <span>Completed {existingCompletion?.completed_date ?? 'today'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
