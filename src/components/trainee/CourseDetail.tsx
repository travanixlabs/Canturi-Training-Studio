'use client'

import { useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { TaskModal } from '@/components/ui/TaskModal'
import { CourseCelebrationScreen } from '@/components/ui/CourseCelebrationScreen'
import { useRouter } from 'next/navigation'
import type { Category, Completion, Plate, User } from '@/types'

interface Props {
  categoryItem: Category
  existingCompletion: Completion | null
  plate: Plate | null
  currentUser: User
  siblingItems?: Category[]
  siblingCompletions?: Completion[]
}

export function CourseDetail({ categoryItem, existingCompletion, plate, currentUser, siblingItems = [], siblingCompletions = [] }: Props) {
  const router = useRouter()

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [courseCompleted, setCourseCompleted] = useState(!!existingCompletion)
  const [showCourseCelebration, setShowCourseCelebration] = useState(false)

  // Check if completing this category finishes the entire course
  const otherSiblings = siblingItems.filter(s => s.id !== categoryItem.id && s.status === 'active')
  const otherSiblingsDone = otherSiblings.every(s => siblingCompletions.some(c => c.category_id === s.id))
  const willCompleteCourse = otherSiblings.length > 0 && otherSiblingsDone
  const courseName = categoryItem.course?.name ?? 'Course'

  function handleBack() {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/trainee')
    }
  }

  return (
    <>
      <div className="min-h-screen bg-ivory">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="text-charcoal/50 hover:text-charcoal transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            {categoryItem.course && (
              <CourseBadge courseName={categoryItem.course.name} icon={categoryItem.course.icon} />
            )}
            <h1 className="font-serif text-lg text-charcoal leading-tight truncate mt-0.5">{categoryItem.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-charcoal/40 flex-shrink-0">
            <span>{categoryItem.trainer_type}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 px-5 py-6 max-w-3xl">
          <div>
            <h2 className="font-serif text-xl text-charcoal mb-4">{categoryItem.title}</h2>
            <div className="prose prose-sm max-w-none text-charcoal/70 leading-relaxed whitespace-pre-wrap mb-4">
              {categoryItem.description}
            </div>
            {categoryItem.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-6">
                {categoryItem.tags.map(tag => (
                  <span key={tag} className="text-xs text-charcoal/40 bg-charcoal/5 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            {!courseCompleted && (
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
        </div>
      </div>

      {/* Completion popup */}
      {showCompleteModal && (
        <TaskModal
          item={categoryItem}
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
