'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, FileText, Globe, Image, Video, FileUp, Upload } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category, Course, Subcategory, SubcategoryType, TrainingTask } from '@/types'

const SUBCATEGORY_TYPES: { value: SubcategoryType; label: string; icon: React.ReactNode }[] = [
  { value: 'text', label: 'Text', icon: <FileText size={16} /> },
  { value: 'webpage', label: 'Webpage', icon: <Globe size={16} /> },
  { value: 'image', label: 'Image', icon: <Image size={16} /> },
  { value: 'video', label: 'Video', icon: <Video size={16} /> },
  { value: 'pdf', label: 'PDF', icon: <FileUp size={16} /> },
]

interface Props {
  categoryItem: Category
  courses: Course[]
  subcategories: Subcategory[]
  trainingTasks: TrainingTask[]
}

export function CourseContentEditor({ categoryItem: initialItem, courses, subcategories: initialSubcategories, trainingTasks: initialTrainingTasks }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Category fields
  const [title, setTitle] = useState(initialItem.title)
  const [description, setDescription] = useState(initialItem.description)

  // Subcategories
  const [subcategories, setSubcategories] = useState<Subcategory[]>(initialSubcategories)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null)
  const [editingCategoryDetails, setEditingCategoryDetails] = useState(true)
  const [showTypeSelector, setShowTypeSelector] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Training tasks
  const [trainingTasks, setTrainingTasks] = useState<TrainingTask[]>(initialTrainingTasks)
  const [selectedTrainingTaskId, setSelectedTrainingTaskId] = useState<string | null>(null)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  const activeSubcategory = subcategories.find(s => s.id === selectedSubcategoryId)
  const activeTrainingTask = trainingTasks.find(t => t.id === selectedTrainingTaskId)
  const course = courses.find(c => c.id === initialItem.course_id)

  // Get training tasks for a specific subcategory
  const getTasksForSubcategory = (subcategoryId: string) =>
    trainingTasks.filter(t => t.subcategory_id === subcategoryId)

  function selectSubcategory(id: string) {
    setSelectedSubcategoryId(id)
    setSelectedTrainingTaskId(null)
    setEditingCategoryDetails(false)
  }

  function selectTrainingTask(id: string) {
    setSelectedTrainingTaskId(id)
    setEditingCategoryDetails(false)
  }

  function selectCategoryDetails() {
    setEditingCategoryDetails(true)
    setSelectedSubcategoryId(null)
    setSelectedTrainingTaskId(null)
  }

  const autoSave = useCallback(async () => {
    if (!title.trim() || !description.trim()) return
    setSaveStatus('saving')
    await supabase.from('categories').update({
      title,
      description,
    }).eq('id', initialItem.id)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [title, description])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { autoSave() }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [title, description])

  async function addSubcategory(type: SubcategoryType) {
    const newOrder = subcategories.length
    const typeLabel = SUBCATEGORY_TYPES.find(t => t.value === type)?.label ?? type
    const { data, error } = await supabase.from('subcategories').insert({
      category_id: initialItem.id,
      title: `${typeLabel} ${newOrder + 1}`,
      type,
      content: '',
      file_url: null,
      sort_order: newOrder,
    }).select().single()

    if (!error && data) {
      setSubcategories(prev => [...prev, data as Subcategory])
      setSelectedSubcategoryId(data.id)
      setEditingCategoryDetails(false)
      setShowTypeSelector(false)
    }
  }

  async function updateSubcategory(id: string, updates: Partial<Subcategory>) {
    setSubcategories(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    await supabase.from('subcategories').update(updates).eq('id', id)
  }

  async function deleteSubcategory(id: string) {
    setSubcategories(prev => prev.filter(s => s.id !== id))
    await supabase.from('subcategories').delete().eq('id', id)
    if (selectedSubcategoryId === id) {
      setSelectedSubcategoryId(subcategories.find(s => s.id !== id)?.id ?? null)
      if (subcategories.length <= 1) setEditingCategoryDetails(true)
    }
  }

  async function moveSubcategory(id: string, direction: 'up' | 'down') {
    const idx = subcategories.findIndex(s => s.id === id)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= subcategories.length - 1) return

    const newList = [...subcategories]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]]

    const updated = newList.map((s, i) => ({ ...s, sort_order: i }))
    setSubcategories(updated)

    await Promise.all(
      updated.map(s => supabase.from('subcategories').update({ sort_order: s.sort_order }).eq('id', s.id))
    )
  }

  async function handleFileUpload(subcategoryId: string, file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `subcategories/${subcategoryId}/${Date.now()}.${ext}`

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

    await updateSubcategory(subcategoryId, { file_url: urlData.publicUrl })
    setUploading(false)
  }

  async function addTrainingTask(subcategoryId: string) {
    const existing = getTasksForSubcategory(subcategoryId)
    const { data, error } = await supabase.from('training_tasks').insert({
      subcategory_id: subcategoryId,
      title: `Training Task ${existing.length + 1}`,
      description: '',
      sort_order: existing.length,
    }).select().single()

    if (!error && data) {
      setTrainingTasks(prev => [...prev, data as TrainingTask])
      selectTrainingTask(data.id)
    }
  }

  async function updateTrainingTask(id: string, updates: Partial<TrainingTask>) {
    setTrainingTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    await supabase.from('training_tasks').update(updates).eq('id', id)
  }

  async function deleteTrainingTask(id: string) {
    setTrainingTasks(prev => prev.filter(t => t.id !== id))
    await supabase.from('training_tasks').delete().eq('id', id)
    if (selectedTrainingTaskId === id) {
      setSelectedTrainingTaskId(null)
    }
  }

  function handleBack() {
    router.push('/head-office/courses')
  }

  return (
    <div className="min-h-screen bg-ivory">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-black/5 px-4 py-3 flex items-center gap-3">
        <button onClick={handleBack} className="text-charcoal/50 hover:text-charcoal transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          {course && (
            <CourseBadge courseName={course.name} icon={course.icon} />
          )}
          <h1 className="font-serif text-lg text-charcoal leading-tight truncate mt-0.5">{title || 'Untitled Category'}</h1>
        </div>
        {saveStatus !== 'idle' && (
          <span className="text-xs text-charcoal/40 flex-shrink-0">
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Subcategory sidebar */}
        <div className="lg:w-72 lg:min-h-[calc(100vh-57px)] lg:border-r border-b lg:border-b-0 border-black/5 bg-white">
          {/* Mobile: horizontal strip */}
          <div className="lg:hidden px-4 py-3 flex gap-2 overflow-x-auto">
            <button
              onClick={selectCategoryDetails}
              className={`px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border transition-all ${
                editingCategoryDetails
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-charcoal/10 text-charcoal/50'
              }`}
            >
              Category Details
            </button>
            {subcategories.map((sub, i) => (
              <button
                key={sub.id}
                onClick={() => selectSubcategory(sub.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0 border transition-all ${
                  selectedSubcategoryId === sub.id && !editingCategoryDetails && !selectedTrainingTaskId
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-charcoal/10 text-charcoal/50'
                }`}
              >
                <span>{i + 1}</span>
                <span className="truncate max-w-[120px]">{sub.title}</span>
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
              onClick={selectCategoryDetails}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all mb-3 ${
                editingCategoryDetails
                  ? 'bg-gold/10 text-gold'
                  : 'hover:bg-charcoal/3 text-charcoal/70'
              }`}
            >
              <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs">⚙</span>
              <span className="text-sm font-medium">Category Details</span>
            </button>

            <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">
              Subcategories · {subcategories.length}
            </p>

            <div className="space-y-1">
              {subcategories.map((sub, i) => {
                const isSelected = selectedSubcategoryId === sub.id && !editingCategoryDetails && !selectedTrainingTaskId
                const subTasks = getTasksForSubcategory(sub.id)
                const isExpanded = selectedSubcategoryId === sub.id

                return (
                  <div key={sub.id}>
                    <div className="group flex items-center gap-1">
                      <button
                        onClick={() => selectSubcategory(sub.id)}
                        className={`flex-1 text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                          isSelected
                            ? 'bg-gold/10 text-gold'
                            : 'hover:bg-charcoal/3 text-charcoal/70'
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-xs flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm truncate">{sub.title}</span>
                      </button>

                      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                        <button onClick={() => moveSubcategory(sub.id, 'up')} className="p-1 text-charcoal/20 hover:text-charcoal/50">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => moveSubcategory(sub.id, 'down')} className="p-1 text-charcoal/20 hover:text-charcoal/50">
                          <ChevronDown size={12} />
                        </button>
                        <button onClick={() => deleteSubcategory(sub.id)} className="p-1 text-charcoal/20 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Training tasks — always visible if tasks exist, add button only when selected */}
                    {(subTasks.length > 0 || isExpanded) && (
                      <div className="ml-6 pl-3 border-l border-charcoal/10 mt-1 mb-2 space-y-1">
                        {subTasks.map(task => (
                          <div key={task.id} className="group/task flex items-center gap-1">
                            <button
                              onClick={() => selectTrainingTask(task.id)}
                              className={`flex-1 text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-all text-xs ${
                                selectedTrainingTaskId === task.id
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'hover:bg-charcoal/3 text-charcoal/50'
                              }`}
                            >
                              <span className="truncate">{task.title}</span>
                            </button>
                            <button
                              onClick={() => deleteTrainingTask(task.id)}
                              className="hidden group-hover/task:block p-1 text-charcoal/20 hover:text-red-500 flex-shrink-0"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                        {isExpanded && (
                          <button
                            onClick={() => addTrainingTask(sub.id)}
                            className="w-full px-3 py-2 rounded-lg flex items-center gap-2 border border-dashed border-charcoal/10 text-charcoal/30 hover:border-blue-300 hover:text-blue-500 transition-all text-xs"
                          >
                            <Plus size={10} />
                            <span>Add training task</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setShowTypeSelector(true)}
              className="w-full mt-3 px-3 py-2.5 rounded-xl flex items-center gap-3 border border-dashed border-charcoal/15 text-charcoal/40 hover:border-gold hover:text-gold transition-all"
            >
              <Plus size={14} />
              <span className="text-sm">Add subcategory</span>
            </button>

            {/* Type selector */}
            {showTypeSelector && (
              <div className="mt-2 space-y-1">
                {SUBCATEGORY_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => addSubcategory(t.value)}
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
          {/* Category details editor */}
          {editingCategoryDetails && (
            <div className="space-y-5">
              <h2 className="font-serif text-xl text-charcoal">Category Details</h2>

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
                <select className="input bg-charcoal/3 cursor-not-allowed" value={initialItem.course_id} disabled>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

            </div>
          )}

          {/* Training task editor */}
          {activeTrainingTask && !editingCategoryDetails && (
            <TrainingTaskEditor
              task={activeTrainingTask}
              onUpdate={(updates) => updateTrainingTask(activeTrainingTask.id, updates)}
            />
          )}

          {/* Subcategory content editor */}
          {activeSubcategory && !editingCategoryDetails && !selectedTrainingTaskId && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                {SUBCATEGORY_TYPES.find(t => t.value === activeSubcategory.type)?.icon}
                <p className="text-xs text-charcoal/40 uppercase tracking-wider">
                  {SUBCATEGORY_TYPES.find(t => t.value === activeSubcategory.type)?.label} · Subcategory {subcategories.indexOf(activeSubcategory) + 1} of {subcategories.length}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Subcategory title</label>
                <input
                  className="input font-serif text-xl"
                  value={activeSubcategory.title}
                  onChange={e => updateSubcategory(activeSubcategory.id, { title: e.target.value })}
                  placeholder="Subcategory title"
                />
              </div>

              {/* Text */}
              {activeSubcategory.type === 'text' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Content</label>
                  <textarea
                    className="textarea font-sans text-sm leading-relaxed"
                    rows={16}
                    value={activeSubcategory.content}
                    onChange={e => updateSubcategory(activeSubcategory.id, { content: e.target.value })}
                    placeholder="Write the subcategory content here."
                  />
                </div>
              )}

              {/* Webpage */}
              {activeSubcategory.type === 'webpage' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Webpage URL</label>
                  <input
                    className="input"
                    value={activeSubcategory.file_url ?? ''}
                    onChange={e => updateSubcategory(activeSubcategory.id, { file_url: e.target.value || null })}
                    placeholder="https://example.com"
                    type="url"
                  />
                  {activeSubcategory.file_url && (
                    <div className="mt-4 card p-4 flex items-center gap-3">
                      <Globe size={16} className="text-charcoal/30 flex-shrink-0" />
                      <a
                        href={activeSubcategory.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gold hover:text-gold/80 underline underline-offset-2 truncate"
                      >
                        {activeSubcategory.file_url}
                      </a>
                      <span className="text-xs text-charcoal/30 flex-shrink-0">Opens in new tab</span>
                    </div>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Caption (optional)</label>
                    <input className="input" value={activeSubcategory.content} onChange={e => updateSubcategory(activeSubcategory.id, { content: e.target.value })} placeholder="Caption" />
                  </div>
                </div>
              )}

              {/* Image */}
              {activeSubcategory.type === 'image' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Image</label>
                  {activeSubcategory.file_url ? (
                    <div className="space-y-3">
                      <img src={activeSubcategory.file_url} alt={activeSubcategory.title} className="max-w-full rounded-xl border border-black/5" />
                      <button onClick={() => updateSubcategory(activeSubcategory.id, { file_url: null })} className="text-xs text-red-500 hover:text-red-700">
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <label className="card p-8 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                      <Upload size={24} className="text-charcoal/30" />
                      <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload an image'}</p>
                      <p className="text-xs text-charcoal/25">PNG, JPEG, WebP</p>
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(activeSubcategory.id, e.target.files[0])} />
                    </label>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Caption (optional)</label>
                    <input className="input" value={activeSubcategory.content} onChange={e => updateSubcategory(activeSubcategory.id, { content: e.target.value })} placeholder="Image caption" />
                  </div>
                </div>
              )}

              {/* Video */}
              {activeSubcategory.type === 'video' && (
                <VideoEditor
                  subcategory={activeSubcategory}
                  uploading={uploading}
                  onUpdate={(updates) => updateSubcategory(activeSubcategory.id, updates)}
                  onFileUpload={(file) => handleFileUpload(activeSubcategory.id, file)}
                />
              )}

              {/* PDF */}
              {activeSubcategory.type === 'pdf' && (
                <div>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">PDF Document</label>
                  {activeSubcategory.file_url ? (
                    <div className="space-y-3">
                      <div className="card overflow-hidden" style={{ height: '600px' }}>
                        <iframe src={activeSubcategory.file_url} className="w-full h-full border-0" title={activeSubcategory.title} />
                      </div>
                      <button onClick={() => updateSubcategory(activeSubcategory.id, { file_url: null })} className="text-xs text-red-500 hover:text-red-700">
                        Remove PDF
                      </button>
                    </div>
                  ) : (
                    <label className="card p-8 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
                      <Upload size={24} className="text-charcoal/30" />
                      <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload a PDF'}</p>
                      <p className="text-xs text-charcoal/25">PDF files only</p>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFileUpload(activeSubcategory.id, e.target.files[0])} />
                    </label>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Caption (optional)</label>
                    <input className="input" value={activeSubcategory.content} onChange={e => updateSubcategory(activeSubcategory.id, { content: e.target.value })} placeholder="PDF description" />
                  </div>
                </div>
              )}

              {/* Text preview */}
              {activeSubcategory.type === 'text' && activeSubcategory.content && (
                <div className="mt-6 pt-6 border-t border-black/5">
                  <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-3">Preview</p>
                  <div className="card p-5">
                    <h3 className="font-serif text-lg text-charcoal mb-3">{activeSubcategory.title}</h3>
                    <div className="prose prose-sm max-w-none text-charcoal/70 leading-relaxed whitespace-pre-wrap">
                      {activeSubcategory.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!activeSubcategory && !editingCategoryDetails && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📖</p>
              <p className="font-serif text-lg text-charcoal/60 mb-2">No subcategories yet</p>
              <p className="text-sm text-charcoal/40 mb-6">Add subcategories to build out the category content.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUBCATEGORY_TYPES.map(t => (
                  <button key={t.value} onClick={() => addSubcategory(t.value)} className="btn-outline inline-flex items-center gap-2 text-sm">
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

function VideoEditor({
  subcategory,
  uploading,
  onUpdate,
  onFileUpload,
}: {
  subcategory: Subcategory
  uploading: boolean
  onUpdate: (updates: Partial<Subcategory>) => void
  onFileUpload: (file: File) => void
}) {
  function detectMode(url: string | null): 'upload' | 'embed' {
    if (!url) return 'upload'
    if (url.includes('supabase') || url.includes('module-files')) return 'upload'
    return 'embed'
  }

  const [mode, setMode] = useState<'upload' | 'embed'>(detectMode(subcategory.file_url))

  // Sync mode when subcategory changes (navigating away and back)
  useEffect(() => {
    setMode(detectMode(subcategory.file_url))
  }, [subcategory.id])

  function switchMode(newMode: 'upload' | 'embed') {
    setMode(newMode)
    onUpdate({ file_url: null })
  }

  // Convert YouTube/Vimeo URLs to embed format
  function getEmbedUrl(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return url
  }

  return (
    <div>
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider">Video</label>
        <div className="flex bg-charcoal/5 rounded-lg p-0.5 ml-auto">
          <button
            onClick={() => switchMode('upload')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'upload' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/40 hover:text-charcoal/60'
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => switchMode('embed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'embed' ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal/40 hover:text-charcoal/60'
            }`}
          >
            Embed Link
          </button>
        </div>
      </div>

      {mode === 'upload' ? (
        <>
          {subcategory.file_url ? (
            <div className="space-y-3">
              <video src={subcategory.file_url} controls className="max-w-full rounded-xl" />
              <button onClick={() => onUpdate({ file_url: null })} className="text-xs text-red-500 hover:text-red-700">
                Remove video
              </button>
            </div>
          ) : (
            <label className="card p-8 flex flex-col items-center gap-3 cursor-pointer hover:shadow-md transition-shadow">
              <Upload size={24} className="text-charcoal/30" />
              <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload a video'}</p>
              <p className="text-xs text-charcoal/25">MP4, WebM, MOV</p>
              <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
            </label>
          )}
        </>
      ) : (
        <>
          <input
            className="input"
            value={subcategory.file_url ?? ''}
            onChange={e => onUpdate({ file_url: e.target.value || null })}
            placeholder="Paste a YouTube, Vimeo, or video URL..."
            type="url"
          />
          {subcategory.file_url && (
            <div className="mt-4 card overflow-hidden" style={{ height: '400px' }}>
              <iframe
                src={getEmbedUrl(subcategory.file_url)}
                className="w-full h-full border-0"
                title={subcategory.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </>
      )}

      <div className="mt-3">
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Caption (optional)</label>
        <input className="input" value={subcategory.content} onChange={e => onUpdate({ content: e.target.value })} placeholder="Caption" />
      </div>
    </div>
  )
}

function TrainingTaskEditor({
  task,
  onUpdate,
}: {
  task: TrainingTask
  onUpdate: (updates: Partial<TrainingTask>) => void
}) {
  const [title, setTitle] = useState(task.title)
  const [taskDescription, setTaskDescription] = useState(task.description)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const taskSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstTaskRender = useRef(true)

  // Reset state when switching between tasks
  useEffect(() => {
    setTitle(task.title)
    setTaskDescription(task.description)
    isFirstTaskRender.current = true
  }, [task.id])

  useEffect(() => {
    if (isFirstTaskRender.current) {
      isFirstTaskRender.current = false
      return
    }
    if (taskSaveTimer.current) clearTimeout(taskSaveTimer.current)
    taskSaveTimer.current = setTimeout(() => {
      if (!title.trim()) return
      setSaveStatus('saving')
      onUpdate({ title, description: taskDescription })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 800)
    return () => { if (taskSaveTimer.current) clearTimeout(taskSaveTimer.current) }
  }, [title, taskDescription])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-charcoal">Training Task</h2>
        {saveStatus !== 'idle' && (
          <span className="text-xs text-charcoal/40">
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Title</label>
        <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Training task title" />
      </div>

      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Description</label>
        <textarea className="textarea" rows={4} value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Describe what the trainee needs to do..." />
      </div>
    </div>
  )
}
