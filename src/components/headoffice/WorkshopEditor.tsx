'use client'

import { useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Workshop, Course, WorkshopCourse } from '@/types'

interface Props {
  workshop: Workshop
  courses: Course[]
  workshopCourses: WorkshopCourse[]
}

export function WorkshopEditor({ workshop: initialWorkshop, courses, workshopCourses: initialWC }: Props) {
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
  const [toggling, setToggling] = useState<string | null>(null)

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

  async function toggleCourse(courseId: string) {
    setToggling(courseId)
    const isAssigned = assignedCourseIds.has(courseId)

    if (isAssigned) {
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
    } else {
      const { error } = await supabase
        .from('workshop_courses')
        .insert({ workshop_id: workshop.id, course_id: courseId })
      if (!error) {
        setAssignedCourseIds(prev => new Set(prev).add(courseId))
      }
    }
    setToggling(null)
  }

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
        <p className="text-sm text-charcoal/40">Toggle courses to add or remove them from this workshop.</p>
      </div>

      <div className="space-y-2">
        {courses.map(course => {
          const assigned = assignedCourseIds.has(course.id)
          const isToggling = toggling === course.id

          return (
            <button
              key={course.id}
              onClick={() => toggleCourse(course.id)}
              disabled={isToggling}
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
              </div>
              {isToggling && (
                <span className="text-xs text-charcoal/30">…</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
