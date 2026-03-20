'use client'

import { useState } from 'react'
import { ArrowLeft, Plus, Save, Trash2, ChevronUp, ChevronDown, Check, BookOpen, FileText, Globe, Image, Video, FileUp, Upload } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { MenuItem, Module, ModuleType, Category, TrainerType, DifficultyLevel } from '@/types'

const MODULE_TYPES: { value: ModuleType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Text', icon: <FileText size={16} /> },
  { value: 'webpage', label: 'Webpage', icon: <Globe size={16} /> },
  { value: 'image', label: 'Image', icon: <Image size={16} /> },
  { value: 'video', label: 'Video', icon: <Video size={16} /> },
  { value: 'pdf', label: 'PDF', icon: <FileUp size={16} /> },
]

const TRAINER_TYPES: TrainerType[] = ['Self', 'Manager', 'Self/Manager']
const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: 'introductory', label: 'Introductory' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

interface Props {
  menuItem: MenuItem
  initialModules: Module[]
  categories: Category[]
}

export function CourseContentEditor({ menuItem: initialItem, initialModules, categories }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Course fields
  const [title, setTitle] = useState(initialItem.title)
  const [description, setDescription] = useState(initialItem.description)
  const [categoryId, setCategoryId] = useState(initialItem.category_id)
  const [tags, setTags] = useState(initialItem.tags?.join(', ') ?? '')
  const [timeNeeded, setTimeNeeded] = useState(initialItem.time_needed)
  const [trainerType, setTrainerType] = useState<TrainerType>(initialItem.trainer_type)
  const [priorityLevel, setPriorityLevel] = useState<DifficultyLevel | ''>(initialItem.difficulty_level ?? '')
  const [isRecurring, setIsRecurring] = useState(initialItem.is_recurring)

  // Modules
  const [modules, setModules] = useState<Module[]>(initialModules)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(modules[0]?.id ?? null)
  const [editingCourseDetails, setEditingCourseDetails] = useState(modules.length === 0)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [uploading, setUploading] = useState(false)

  // State
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const activeModule = modules.find(m => m.id === selectedModuleId)

  async function saveCourse() {
    setSaving(true)
    await supabase.from('menu_items').update({
      title,
      description,
      category_id: categoryId,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      time_needed: timeNeeded,
      trainer_type: trainerType,
      difficulty_level: priorityLevel || null,
      is_recurring: isRecurring,
    }).eq('id', initialItem.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addModule(type: ModuleType) {
    const newOrder = modules.length
    const typeLabel = MODULE_TYPES.find(t => t.value === type)?.label ?? type
    const { data, error } = await supabase.from('modules').insert({
      menu_item_id: initialItem.id,
      title: `${typeLabel} ${newOrder + 1}`,
      type,
      content: '',
      file_url: null,
      sort_order: newOrder,
    }).select().single()

    if (!error && data) {
      setModules(prev => [...prev, data as Module])
      setSelectedModuleId(data.id)
      setEditingCourseDetails(false)
      setShowTypeSelector(false)
    }
  }

  async function handleFileUpload(moduleId: string, file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `modules/${moduleId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('module-files')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('module-files')
      .getPublicUrl(path)

    const fileUrl = urlData.publicUrl
    await updateModule(moduleId, { file_url: fileUrl })
    setUploading(false)
  }

  async function updateModule(moduleId: string, updates: Partial<Module>) {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, ...updates } : m))
    await supabase.from('modules').update(updates).eq('id', moduleId)
  }

  async function deleteModule(moduleId: string) {
    setModules(prev => prev.filter(m => m.id !== moduleId))
    await supabase.from('modules').delete().eq('id', moduleId)
    if (selectedModuleId === moduleId) {
      setSelectedModuleId(modules.find(m => m.id !== moduleId)?.id ?? null)
    }
  }

  async function moveModule(moduleId: string, direction: 'up' | 'down') {
    const idx = modules.findIndex(m => m.id === moduleId)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= modules.length - 1) return

    const newModules = [...modules]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newModules[idx], newModules[swapIdx]] = [newModules[swapIdx], newModules[idx]]

    // Update sort orders
    const updated = newModules.map((m, i) => ({ ...m, sort_order: i }))
    setModules(updated)

    await Promise.all(
      updated.map(m => supabase.from('modules').update({ sort_order: m.sort_order }).eq('id', m.id))
    )
  }

  function handleBack() {
    router.push('/head-office/courses')
  }

  const category = categories.find(c => c.id === categoryId)

  return (
    <div className="min-h-screen bg-ivory">
      {/* Top bar — mirrors CourseDetail */}
      <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3">
        <button onClick={handleBack} className="text-charcoal/50 hover:text-charcoal transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          {category && (
            <CategoryBadge categoryName={category.name} icon={category.icon} />
          )}
          <h1 className="font-serif text-lg text-charcoal leading-tight truncate mt-0.5">{title || 'Untitled Course'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveCourse}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gold text-white hover:bg-gold/90 transition-colors"
          >
            {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving…' : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Module sidebar — mirrors CourseDetail */}
        <div className="lg:w-72 lg:min-h-[calc(100vh-57px)] lg:border-r border-b lg:border-b-0 border-black/5 bg-white">
          {/* Mobile: horizontal strip */}
          <div className="lg:hidden px-4 py-3 flex gap-2 overflow-x-auto">
            <button
              onClick={() => { setEditingCourseDetails(true); setSelectedModuleId(null) }}
              className={`px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border transition-all ${
                editingCourseDetails
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-charcoal/10 text-charcoal/50'
              }`}
            >
              Course Details
            </button>
            {modules.map((mod, i) => (
              <button
                key={mod.id}
                onClick={() => { setSelectedModuleId(mod.id); setEditingCourseDetails(false) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border transition-all ${
                  selectedModuleId === mod.id && !editingCourseDetails
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-charcoal/10 text-charcoal/50'
                }`}
              >
                <span>{i + 1}</span>
                <span className="truncate max-w-[120px]">{mod.title}</span>
              </button>
            ))}
            <button
              onClick={() => setShowTypeSelector(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border border-dashed border-charcoal/15 text-charcoal/40 hover:border-gold hover:text-gold transition-all"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Desktop: vertical list */}
          <div className="hidden lg:block p-4">
            <button
              onClick={() => { setEditingCourseDetails(true); setSelectedModuleId(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all mb-3 ${
                editingCourseDetails
                  ? 'bg-gold/10 text-gold'
                  : 'hover:bg-charcoal/3 text-charcoal/70'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs">⚙</span>
              <span className="text-sm font-medium">Course Details</span>
            </button>

            <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">
              Modules · {modules.length}
            </p>

            <div className="space-y-1">
              {modules.map((mod, i) => (
                <div key={mod.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => { setSelectedModuleId(mod.id); setEditingCourseDetails(false) }}
                    className={`flex-1 text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                      selectedModuleId === mod.id && !editingCourseDetails
                        ? 'bg-gold/10 text-gold'
                        : 'hover:bg-charcoal/3 text-charcoal/70'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm truncate">{mod.title}</span>
                  </button>

                  {/* Reorder + delete (visible on hover) */}
                  <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => moveModule(mod.id, 'up')} className="p-1 text-charcoal/20 hover:text-charcoal/50">
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveModule(mod.id, 'down')} className="p-1 text-charcoal/20 hover:text-charcoal/50">
                      <ChevronDown size={12} />
                    </button>
                    <button onClick={() => deleteModule(mod.id)} className="p-1 text-charcoal/20 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowTypeSelector(true)}
              className="w-full mt-3 px-3 py-2.5 rounded-xl flex items-center gap-3 border border-dashed border-charcoal/15 text-charcoal/40 hover:border-gold hover:text-gold transition-all"
            >
              <Plus size={14} />
              <span className="text-sm">Add module</span>
            </button>

            {/* Type selector */}
            {showTypeSelector && (
              <div className="mt-2 space-y-1">
                {MODULE_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => addModule(t.value)}
                    className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 hover:bg-gold/5 text-charcoal/60 hover:text-gold transition-all"
                  >
                    {t.icon}
                    <span className="text-sm">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 px-5 py-6 max-w-3xl">
          {/* Course details editor */}
          {editingCourseDetails && (
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Category</label>
                  <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Time needed</label>
                  <input className="input" value={timeNeeded} onChange={e => setTimeNeeded(e.target.value)} placeholder="e.g. 30 min" />
                </div>
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

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`w-10 h-6 rounded-full transition-all ${isRecurring ? 'bg-gold' : 'bg-charcoal/15'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mx-1 ${isRecurring ? 'translate-x-4' : ''}`} />
                </button>
                <span className="text-sm text-charcoal/70">Recurring (revisit regularly)</span>
              </div>
            </div>
          )}

          {/* Module content editor */}
          {activeModule && !editingCourseDetails && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                {MODULE_TYPES.find(t => t.value === (activeModule.type ?? 'text'))?.icon}
                <p className="text-xs text-charcoal/40 uppercase tracking-wider">
                  {MODULE_TYPES.find(t => t.value === (activeModule.type ?? 'text'))?.label} · Module {modules.indexOf(activeModule) + 1} of {modules.length}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Module title</label>
                <input
                  className="input font-serif text-xl"
                  value={activeModule.title}
                  onChange={e => updateModule(activeModule.id, { title: e.target.value })}
                  placeholder="Module title"
                />
              </div>

              {/* Text module */}
              {(activeModule.type ?? 'text') === 'text' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Content</label>
                  <textarea
                    className="textarea font-sans text-sm leading-relaxed"
                    rows={16}
                    value={activeModule.content}
                    onChange={e => updateModule(activeModule.id, { content: e.target.value })}
                    placeholder="Write the module content here.&#10;&#10;You can use paragraphs, numbered lists, or bullet points."
                  />
                </div>
              )}

              {/* Webpage module */}
              {activeModule.type === 'webpage' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Webpage URL</label>
                  <input
                    className="input"
                    value={activeModule.content}
                    onChange={e => updateModule(activeModule.id, { content: e.target.value })}
                    placeholder="https://example.com"
                    type="url"
                  />
                  {activeModule.content && (
                    <div className="mt-4 card overflow-hidden" style={{ height: '500px' }}>
                      <iframe src={activeModule.content} className="w-full h-full border-0" title={activeModule.title} />
                    </div>
                  )}
                </div>
              )}

              {/* Image module */}
              {activeModule.type === 'image' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Image</label>
                  {activeModule.file_url ? (
                    <div className="space-y-3">
                      <img src={activeModule.file_url} alt={activeModule.title} className="max-w-full rounded-xl border border-black/5" />
                      <button
                        onClick={() => updateModule(activeModule.id, { file_url: null })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <label className="card p-8 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                      <Upload size={24} className="text-charcoal/30" />
                      <p className="text-sm text-charcoal/40">{uploading ? 'Uploading…' : 'Click to upload an image'}</p>
                      <p className="text-xs text-charcoal/25">PNG, JPEG, WebP</p>
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(activeModule.id, e.target.files[0])} />
                    </label>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Caption (optional)</label>
                    <input className="input" value={activeModule.content} onChange={e => updateModule(activeModule.id, { content: e.target.value })} placeholder="Image caption" />
                  </div>
                </div>
              )}

              {/* Video module */}
              {activeModule.type === 'video' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Video</label>
                  {activeModule.file_url ? (
                    <div className="space-y-3">
                      <video src={activeModule.file_url} controls className="max-w-full rounded-xl" />
                      <button
                        onClick={() => updateModule(activeModule.id, { file_url: null })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove video
                      </button>
                    </div>
                  ) : (
                    <label className="card p-8 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                      <Upload size={24} className="text-charcoal/30" />
                      <p className="text-sm text-charcoal/40">{uploading ? 'Uploading…' : 'Click to upload a video'}</p>
                      <p className="text-xs text-charcoal/25">MP4, WebM, MOV</p>
                      <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(activeModule.id, e.target.files[0])} />
                    </label>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Description (optional)</label>
                    <input className="input" value={activeModule.content} onChange={e => updateModule(activeModule.id, { content: e.target.value })} placeholder="Video description" />
                  </div>
                </div>
              )}

              {/* PDF module */}
              {activeModule.type === 'pdf' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">PDF Document</label>
                  {activeModule.file_url ? (
                    <div className="space-y-3">
                      <div className="card overflow-hidden" style={{ height: '600px' }}>
                        <iframe src={activeModule.file_url} className="w-full h-full border-0" title={activeModule.title} />
                      </div>
                      <button
                        onClick={() => updateModule(activeModule.id, { file_url: null })}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove PDF
                      </button>
                    </div>
                  ) : (
                    <label className="card p-8 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                      <Upload size={24} className="text-charcoal/30" />
                      <p className="text-sm text-charcoal/40">{uploading ? 'Uploading…' : 'Click to upload a PDF'}</p>
                      <p className="text-xs text-charcoal/25">PDF files only</p>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(activeModule.id, e.target.files[0])} />
                    </label>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Description (optional)</label>
                    <input className="input" value={activeModule.content} onChange={e => updateModule(activeModule.id, { content: e.target.value })} placeholder="PDF description" />
                  </div>
                </div>
              )}

              {/* Preview for text modules */}
              {(activeModule.type ?? 'text') === 'text' && activeModule.content && (
                <div className="mt-6 pt-6 border-t border-black/5">
                  <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">Preview</p>
                  <div className="card p-5">
                    <h3 className="font-serif text-lg text-charcoal mb-3">{activeModule.title}</h3>
                    <div className="prose prose-sm max-w-none text-charcoal/70 leading-relaxed whitespace-pre-wrap">
                      {activeModule.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!activeModule && !editingCourseDetails && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📖</p>
              <p className="font-serif text-lg text-charcoal/60 mb-2">No modules yet</p>
              <p className="text-sm text-charcoal/40 mb-6">Add modules to build out the course content.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {MODULE_TYPES.map(t => (
                  <button key={t.value} onClick={() => addModule(t.value)} className="btn-outline inline-flex items-center gap-2 text-sm">
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
