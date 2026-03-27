'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Workshop, WorkshopCourse } from '@/types'

interface Props {
  workshops: Workshop[]
  workshopCourses: WorkshopCourse[]
}

export function WorkshopList({ workshops: initialWorkshops, workshopCourses }: Props) {
  const [workshops, setWorkshops] = useState(initialWorkshops)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Workshop | null>(null)
  const [statusChanging, setStatusChanging] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const courseCount = (workshopId: string) =>
    workshopCourses.filter(wc => wc.workshop_id === workshopId).length

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('workshops').insert({
      name: name.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }).select().single()

    if (!error && data) {
      setWorkshops(prev => [data, ...prev])
      setName('')
      setTags('')
      setShowAdd(false)
    }
    setSaving(false)
  }

  async function handleDelete(workshop: Workshop) {
    const { error } = await supabase.from('workshops').delete().eq('id', workshop.id)
    if (!error) {
      setWorkshops(prev => prev.filter(w => w.id !== workshop.id))
    }
    setDeleteTarget(null)
  }

  async function toggleStatus(workshop: Workshop) {
    const newStatus = workshop.status === 'active' ? 'hidden' : 'active'
    setStatusChanging(workshop.id)
    const { error } = await supabase.from('workshops').update({ status: newStatus }).eq('id', workshop.id)
    if (!error) {
      setWorkshops(prev => prev.map(w => w.id === workshop.id ? { ...w, status: newStatus } : w))
    }
    setStatusChanging(null)
  }

  return (
    <div className="px-5 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Workshops</h1>
          <p className="text-sm text-charcoal/40 mt-1">Group courses into structured training programs</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Add Workshop
        </button>
      </div>

      {/* Add Workshop Form */}
      {showAdd && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-charcoal">New Workshop</h2>
            <button onClick={() => setShowAdd(false)} className="text-charcoal/30 hover:text-charcoal">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-charcoal/50 uppercase tracking-wide">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 4 Week Introduction"
                className="input mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-charcoal/50 uppercase tracking-wide">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="e.g. onboarding, beginner"
                className="input mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-charcoal/50 hover:text-charcoal">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!name.trim() || saving}
                className="btn-primary text-sm"
              >
                {saving ? 'Creating…' : 'Create Workshop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workshop List */}
      {workshops.length === 0 && !showAdd ? (
        <div className="card p-8 text-center">
          <p className="text-4xl mb-4">◈</p>
          <p className="font-serif text-lg text-charcoal/60">No workshops yet.</p>
          <p className="text-sm text-charcoal/40 mt-2">Create a workshop to group courses into a structured training program.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workshops.map(workshop => {
            const count = courseCount(workshop.id)
            const isHidden = workshop.status === 'hidden'

            return (
              <div
                key={workshop.id}
                className={`card px-5 py-4 flex items-center gap-4 ${isHidden ? 'opacity-50' : ''}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-charcoal text-[15px]">{workshop.name}</p>
                    {isHidden && (
                      <span className="text-[10px] font-medium text-charcoal/40 bg-charcoal/8 px-1.5 py-0.5 rounded">
                        Hidden
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs text-charcoal/40">{count} course{count !== 1 ? 's' : ''}</p>
                    {workshop.tags.length > 0 && (
                      <div className="flex gap-1.5">
                        {workshop.tags.map(tag => (
                          <span key={tag} className="text-[10px] text-charcoal/40 bg-charcoal/5 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => router.push(`/head-office/workshops/${workshop.id}`)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-gold hover:bg-gold/5 transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => toggleStatus(workshop)}
                    disabled={statusChanging === workshop.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-gold hover:bg-gold/5 transition-colors"
                    title={isHidden ? 'Show' : 'Hide'}
                  >
                    {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(workshop)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-serif text-lg text-charcoal mb-2">Delete Workshop</h3>
            <p className="text-sm text-charcoal/60 mb-5">
              Are you sure you want to delete &quot;{deleteTarget.name}&quot;? This will remove all course assignments within it. Courses themselves won&apos;t be deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm text-charcoal/50 hover:text-charcoal">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
