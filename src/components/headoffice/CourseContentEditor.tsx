'use client'

import { useState } from 'react'
import { ArrowLeft, Save, Check } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category, Course, TrainerType, DifficultyLevel } from '@/types'

const TRAINER_TYPES: TrainerType[] = ['Self', 'Manager', 'Self/Manager']
const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: 'introductory', label: 'Introductory' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

interface Props {
  categoryItem: Category
  categories: Course[]
}

export function CourseContentEditor({ categoryItem: initialItem, categories }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Course fields
  const [title, setTitle] = useState(initialItem.title)
  const [description, setDescription] = useState(initialItem.description)
  const [categoryId, setCategoryId] = useState(initialItem.course_id)
  const [tags, setTags] = useState(initialItem.tags?.join(', ') ?? '')
  const [trainerType, setTrainerType] = useState<TrainerType>(initialItem.trainer_type)
  const [priorityLevel, setPriorityLevel] = useState<DifficultyLevel | ''>(initialItem.difficulty_level ?? '')

  // State
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveCourse() {
    if (!title.trim()) { alert('Title is required.'); return }
    if (!description.trim()) { alert('Description is required.'); return }
    if (!categoryId) { alert('Course is required.'); return }
    if (!tags.trim()) { alert('Tags are required.'); return }
    if (!trainerType) { alert('Trainer type is required.'); return }
    if (!priorityLevel) { alert('Difficulty level is required.'); return }
    setSaving(true)
    await supabase.from('categories').update({
      title,
      description,
      course_id: categoryId,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      trainer_type: trainerType,
      difficulty_level: priorityLevel || null,
    }).eq('id', initialItem.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleBack() {
    router.push('/head-office/courses')
  }

  const category = categories.find(c => c.id === categoryId)

  return (
    <div className="min-h-screen bg-ivory">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3">
        <button onClick={handleBack} className="text-charcoal/50 hover:text-charcoal transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          {category && (
            <CourseBadge courseName={category.name} icon={category.icon} />
          )}
          <h1 className="font-serif text-lg text-charcoal leading-tight truncate mt-0.5">{title || 'Untitled Course'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveCourse}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gold text-white hover:bg-gold/90 transition-colors"
          >
            {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 px-5 py-6 max-w-3xl">
        <div className="space-y-5">
          <h2 className="font-serif text-xl text-charcoal">Course Details</h2>

          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Description</label>
            <textarea className="textarea" rows={4} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Course</label>
            <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Tags (comma-separated)</label>
            <input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="engraving, services, personalisation" />
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">Trainer type</label>
            <div className="flex gap-2">
              {TRAINER_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setTrainerType(t)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    trainerType === t ? 'border-gold bg-gold/10 text-gold' : 'border-charcoal/15 text-charcoal/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">Difficulty level</label>
            <div className="flex gap-2">
              {DIFFICULTY_LEVELS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPriorityLevel(priorityLevel === p.value ? '' : p.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    priorityLevel === p.value ? 'border-gold bg-gold/10 text-gold' : 'border-charcoal/15 text-charcoal/50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
