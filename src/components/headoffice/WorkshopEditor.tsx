'use client'

import { useState } from 'react'
import { ArrowLeft, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Workshop, Course, Category, WorkshopCourse } from '@/types'

interface Props {
  workshop: Workshop
  courses: Course[]
  categories: Category[]
  workshopCourses: WorkshopCourse[]
}

export function WorkshopEditor({ workshop: initialWorkshop, courses, categories, workshopCourses: initialWC }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [workshop, setWorkshop] = useState(initialWorkshop)
  const [name, setName] = useState(initialWorkshop.name)
  const [tags, setTags] = useState(initialWorkshop.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [assignedCourseIds, setAssignedCourseIds] = useState<Set<string>>(
    new Set(initialWC.map(wc => wc.course_id))
  )
  const [toggling, setToggling] = useState(false)
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null)

  const assignedCount = assignedCourseIds.size

  async function handleSaveDetails() {
    setSaving(true)
    const { error } = await supabase.from('workshops').update({
      name: name.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }).eq('id', workshop.id)

    if (!error) {
      setWorkshop(prev => ({ ...prev, name: name.trim(), tags: tags.split(',').map(t => t.trim()).filter(Boolean) }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  function handleCourseClick(course: Course) {
    const isAssigned = assignedCourseIds.has(course.id)
    if (isAssigned) {
      // Unassign immediately
      unassignCourse(course.id)
    } else {
      // Show preview overlay before assigning
      setPreviewCourse(course)
    }
  }

  async function assignCourse(courseId: string) {
    setToggling(true)
    const { error } = await supabase
      .from('workshop_courses')
      .insert({ workshop_id: workshop.id, course_id: courseId })
    if (!error) {
      setAssignedCourseIds(prev => new Set(prev).add(courseId))
    }
    setToggling(false)
    setPreviewCourse(null)
  }

  async function unassignCourse(courseId: string) {
    setToggling(true)
    const { error } = await supabase
      .from('workshop_courses')
      .delete()
      .eq('workshop_id', workshop.id)
      .eq('course_id', courseId)
    if (!error) {
      setAssignedCourseIds(prev => {
        const next = new Set(prev)
        next.delete(courseId)
        return next
      })
    }
    setToggling(false)
  }

  const courseCategories = previewCourse
    ? categories.filter(c => c.course_id === previewCourse.id)
    : []

  return (
    <div className="px-5 py-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/head-office/workshops')}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-charcoal/5 transition-colors text-charcoal/50"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-serif text-2xl text-charcoal">Edit Workshop</h1>
          <p className="text-sm text-charcoal/40 mt-0.5">{assignedCount} course{assignedCount !== 1 ? 's' : ''} assigned</p>
        </div>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>

      {/* Workshop details */}
      <div className="card p-5 mb-6">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-charcoal/50 uppercase tracking-wide">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-charcoal/50 uppercase tracking-wide">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveDetails}
              disabled={!name.trim() || saving}
              className="btn-primary text-sm"
            >
              {saving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Course assignment */}
      <div className="mb-4">
        <h2 className="font-serif text-lg text-charcoal mb-1">Assign Courses</h2>
        <p className="text-sm text-charcoal/40">Select a course to preview its categories before assigning.</p>
      </div>

      <div className="space-y-2">
        {courses.map(course => {
          const assigned = assignedCourseIds.has(course.id)
          const catCount = categories.filter(c => c.course_id === course.id).length

          return (
            <button
              key={course.id}
              onClick={() => handleCourseClick(course)}
              disabled={toggling}
              className={`w-full card px-5 py-4 flex items-center gap-3 text-left transition-colors ${
                assigned ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-charcoal/2'
              }`}
            >
              <span
                className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs border transition-colors ${
                  assigned ? 'bg-gold border-gold text-white' : 'border-charcoal/20'
                }`}
              >
                {assigned && <Check size={12} />}
              </span>
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: course.colour_hex + '20', color: course.colour_hex }}
              >
                {course.icon}
              </span>
              <div className="flex-1">
                <p className="font-medium text-charcoal text-[15px]">{course.name}</p>
                <p className="text-xs text-charcoal/40 mt-0.5">{catCount} categor{catCount !== 1 ? 'ies' : 'y'}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Course preview overlay */}
      {previewCourse && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="fixed inset-0 bg-black/20" onClick={() => setPreviewCourse(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md mx-0 sm:mx-4 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-black/5">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: previewCourse.colour_hex + '20', color: previewCourse.colour_hex }}
              >
                {previewCourse.icon}
              </span>
              <div className="flex-1">
                <h3 className="font-serif text-lg text-charcoal">{previewCourse.name}</h3>
                <p className="text-xs text-charcoal/40">{courseCategories.length} categor{courseCategories.length !== 1 ? 'ies' : 'y'}</p>
              </div>
              <button
                onClick={() => setPreviewCourse(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-charcoal/30 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {courseCategories.length === 0 ? (
                <p className="text-sm text-charcoal/40 text-center py-4">No categories in this course yet.</p>
              ) : (
                <div className="space-y-2">
                  {courseCategories.map(cat => (
                    <div key={cat.id} className="flex items-start gap-3 py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-charcoal/20 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-charcoal font-medium">{cat.title}</p>
                        {cat.description && (
                          <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-2">{cat.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-5 py-4 border-t border-black/5">
              <button
                onClick={() => setPreviewCourse(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal/50 hover:text-charcoal rounded-xl border border-charcoal/15 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => assignCourse(previewCourse.id)}
                disabled={toggling}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-xl hover:bg-gold/90 transition-colors"
              >
                {toggling ? 'Assigning…' : 'Assign Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
