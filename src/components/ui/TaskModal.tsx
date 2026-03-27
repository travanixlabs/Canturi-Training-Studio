'use client'

import { useState, useMemo } from 'react'
import { X, Clock, Users, RotateCcw } from 'lucide-react'
import { CourseBadge } from './CourseBadge'
import { StarRating } from './StarRating'
import { CelebrationScreen } from './CelebrationScreen'
import { createClient } from '@/lib/supabase/client'
import type { Category, Plate, Completion, User } from '@/types'
import { todayAEDT, toDateStringAEDT } from '@/lib/dates'

interface Props {
  item: Category
  plate?: Plate | null
  existingCompletion?: Completion | null
  currentUser: User
  mode: 'trainee' | 'manager'
  onClose: () => void
  onComplete?: () => void
  onReassign?: () => void
  onCategoryCelebrationDone?: () => void
}

export function TaskModal({ item, plate, existingCompletion, currentUser, mode, onClose, onComplete, onReassign, onCategoryCelebrationDone }: Props) {
  const [traineeNotes, setTraineeNotes] = useState(existingCompletion?.trainee_notes ?? '')
  const [trainerNotes, setTrainerNotes] = useState(existingCompletion?.trainer_notes ?? '')
  const [traineeRating, setTraineeRating] = useState(existingCompletion?.trainee_rating ?? 0)
  const [trainerRating, setTrainerRating] = useState(existingCompletion?.trainer_rating ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showReassignDates, setShowReassignDates] = useState(false)
  const [reassigning, setReassigning] = useState(false)

  const isCompleted = !!existingCompletion
  const isShadowing = !plate

  const supabase = createClient()

  const upcomingDates = useMemo(() => {
    const dates: { value: string; label: string; isToday: boolean }[] = []
    const now = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      dates.push({
        value: toDateStringAEDT(d),
        label: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        isToday: i === 0,
      })
    }
    return dates
  }, [])

  async function handleReassign(date: string) {
    if (!existingCompletion) return
    setReassigning(true)

    // Delete the completion (resets all ratings, notes, completed status)
    const { error: delError } = await supabase.from('completions').delete().eq('id', existingCompletion.id)
    if (delError) {
      setError('Failed to reassign. Check permissions.')
      setReassigning(false)
      return
    }

    // Remove any existing plate for this item+trainee
    await supabase.from('plates').delete()
      .eq('trainee_id', existingCompletion.trainee_id)
      .eq('category_id', existingCompletion.category_id)

    // Create a fresh plate assignment for the selected date
    await supabase.from('plates').insert({
      trainee_id: existingCompletion.trainee_id,
      category_id: existingCompletion.category_id,
      assigned_by: currentUser.id,
      date_assigned: date,
      boutique_id: currentUser.boutique_id,
    })

    setReassigning(false)
    onReassign?.()
  }

  async function handleTraineeComplete() {
    if (traineeRating === 0) {
      setError('Please give yourself a rating before completing.')
      return
    }
    setSubmitting(true)
    setError(null)

    const completionData = {
      plate_id: plate?.id ?? null,
      category_id: item.id,
      trainee_id: currentUser.id,
      trainee_notes: traineeNotes || null,
      trainee_rating: traineeRating,
      completed_date: todayAEDT(),
      is_shadowing_moment: isShadowing,
      workshop_id: plate?.workshop_id ?? null,
    }

    const { error } = existingCompletion
      ? await supabase.from('completions').update(completionData).eq('id', existingCompletion.id)
      : await supabase.from('completions').insert(completionData)

    if (error) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    setCelebrating(true)
  }

  async function handleManagerSignOff() {
    if (!existingCompletion) return
    setSubmitting(true)
    setError(null)

    const { error } = await supabase
      .from('completions')
      .update({
        trainer_id: currentUser.id,
        trainer_notes: trainerNotes || null,
        trainer_rating: trainerRating || null,
      })
      .eq('id', existingCompletion.id)

    if (error) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    onComplete?.()
    onClose()
  }

  if (celebrating) {
    return (
      <CelebrationScreen
        traineeName={currentUser.name}
        taskTitle={item.title}
        onContinue={() => {
          setCelebrating(false)
          onComplete?.()
          if (onCategoryCelebrationDone) {
            onCategoryCelebrationDone()
          } else {
            onClose()
          }
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-4 flex items-start justify-between rounded-t-2xl">
          <div className="flex-1 pr-4">
            {item.course && (
              <CourseBadge
                courseName={item.course.name}
                icon={item.course.icon}
              />
            )}
            <h2 className="font-serif text-xl text-charcoal mt-2 leading-tight">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-charcoal/40 hover:text-charcoal p-1 -mt-1 -mr-1 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-charcoal/50">
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {item.time_needed}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {item.trainer_type}
            </span>
            {isShadowing && (
              <span className="text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                Shadowing moment
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-charcoal/70 leading-relaxed text-sm">{item.description}</p>

          {/* Tags */}
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs text-charcoal/40 bg-charcoal/5 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="h-px bg-black/5" />

          {/* TRAINEE MODE */}
          {mode === 'trainee' && (
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
                  disabled={isCompleted}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                  How confident do you feel?
                </label>
                <StarRating
                  value={traineeRating}
                  onChange={isCompleted ? undefined : setTraineeRating}
                  readonly={isCompleted}
                  size="lg"
                />
              </div>

              {isCompleted ? (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
                  <span>✓</span>
                  <span>Completed {existingCompletion?.completed_date}</span>
                </div>
              ) : (
                <>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button
                    onClick={handleTraineeComplete}
                    disabled={submitting || traineeRating === 0}
                    className="btn-gold w-full"
                  >
                    {submitting ? 'Saving…' : isShadowing ? 'Log shadowing moment' : 'Mark as complete'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* MANAGER MODE */}
          {mode === 'manager' && (
            <div className="space-y-4">
              {/* Show trainee's notes (read-only) */}
              {existingCompletion?.trainee_notes && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                    Trainee notes
                  </label>
                  <p className="text-sm text-charcoal/70 bg-ivory px-4 py-3 rounded-xl">
                    {existingCompletion.trainee_notes}
                  </p>
                </div>
              )}

              {existingCompletion?.trainee_rating && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                    Trainee self-rating
                  </label>
                  <StarRating value={existingCompletion.trainee_rating} readonly size="md" />
                </div>
              )}

              {existingCompletion && (
                <>
                  <div className="h-px bg-black/5" />

                  <div>
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                      Manager notes (not visible to trainee)
                    </label>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={trainerNotes}
                      onChange={e => setTrainerNotes(e.target.value)}
                      placeholder="Coaching notes, observations, areas to develop…"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                      Manager assessment (not visible to trainee)
                    </label>
                    <StarRating value={trainerRating} onChange={setTrainerRating} size="md" />
                  </div>

                  {error && <p className="text-sm text-red-600">{error}</p>}

                  <button
                    onClick={handleManagerSignOff}
                    disabled={submitting}
                    className="btn-gold w-full"
                  >
                    {submitting ? 'Saving…' : 'Save assessment'}
                  </button>

                  {/* Reassign option */}
                  {onReassign && (
                    <div className="pt-2 border-t border-black/5">
                      {!showReassignDates ? (
                        <button
                          onClick={() => setShowReassignDates(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-charcoal/50 hover:text-charcoal border border-charcoal/10 rounded-xl transition-colors"
                        >
                          <RotateCcw size={14} />
                          Reassign to employee
                        </button>
                      ) : (
                        <div>
                          <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">
                            Reassign to date (removes completion)
                          </p>
                          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                            {upcomingDates.map(date => (
                              <button
                                key={date.value}
                                onClick={() => handleReassign(date.value)}
                                disabled={reassigning}
                                className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all border ${
                                  date.isToday
                                    ? 'border-gold bg-gold/5 text-gold hover:bg-gold/10'
                                    : 'border-charcoal/10 text-charcoal/70 hover:border-gold hover:text-gold'
                                }`}
                              >
                                {date.label}
                                {date.isToday && <span className="block text-xs text-gold/60 mt-0.5">Today</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {!existingCompletion && (
                <div className="text-sm text-charcoal/40 text-center py-2">
                  This item hasn&apos;t been completed by the trainee yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
