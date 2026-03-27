'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Globe, Upload } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category, Course, Subcategory, TrainingTask } from '@/types'

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

  async function addSubcategory() {
    const newOrder = subcategories.length
    const { data, error } = await supabase.from('subcategories').insert({
      category_id: initialItem.id,
      title: `Subcategory ${newOrder + 1}`,
      content: '',
      sort_order: newOrder,
    }).select().single()

    if (!error && data) {
      setSubcategories(prev => [...prev, data as Subcategory])
      selectSubcategory(data.id)
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

  async function addTrainingTask(subcategoryId: string) {
    const existing = getTasksForSubcategory(subcategoryId)
    const { data, error } = await supabase.from('training_tasks').insert({
      subcategory_id: subcategoryId,
      title: `Training Task ${existing.length + 1}`,
      description: '',
      content: '',
      sort_order: existing.length,
    }).select().single()

    if (!error && data) {
      setTrainingTasks(prev => [...prev, data as TrainingTask])
      selectTrainingTask(data.id)
    }
  }

  async function handleTaskFileUpload(taskId: string, file: File, field: 'image_url' | 'video_url' | 'pdf_url') {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `training-tasks/${taskId}/${Date.now()}.${ext}`

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

    await updateTrainingTask(taskId, { [field]: urlData.publicUrl })
    setUploading(false)
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
              onClick={addSubcategory}
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
              onClick={addSubcategory}
              className="w-full mt-3 px-3 py-2.5 rounded-xl flex items-center gap-3 border border-dashed border-charcoal/15 text-charcoal/40 hover:border-gold hover:text-gold transition-all"
            >
              <Plus size={14} />
              <span className="text-sm">Add subcategory</span>
            </button>
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
              uploading={uploading}
              onUpdate={(updates) => updateTrainingTask(activeTrainingTask.id, updates)}
              onFileUpload={(file, field) => handleTaskFileUpload(activeTrainingTask.id, file, field)}
            />
          )}

          {/* Subcategory content editor */}
          {activeSubcategory && !editingCategoryDetails && !selectedTrainingTaskId && (
            <div>
              <p className="text-xs text-charcoal/40 uppercase tracking-wider mb-1">
                Subcategory {subcategories.indexOf(activeSubcategory) + 1} of {subcategories.length}
              </p>

              <div className="mb-4">
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Title</label>
                <input
                  className="input font-serif text-xl"
                  value={activeSubcategory.title}
                  onChange={e => updateSubcategory(activeSubcategory.id, { title: e.target.value })}
                  placeholder="Subcategory title"
                />
              </div>

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
            </div>
          )}

          {/* Empty state */}
          {!activeSubcategory && !activeTrainingTask && !editingCategoryDetails && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📖</p>
              <p className="font-serif text-lg text-charcoal/60 mb-2">No subcategories yet</p>
              <p className="text-sm text-charcoal/40 mb-6">Add subcategories to build out the category content.</p>
              <button onClick={addSubcategory} className="btn-outline inline-flex items-center gap-2 text-sm">
                <Plus size={14} /> Add subcategory
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrainingTaskEditor({
  task,
  uploading,
  onUpdate,
  onFileUpload,
}: {
  task: TrainingTask
  uploading: boolean
  onUpdate: (updates: Partial<TrainingTask>) => void
  onFileUpload: (file: File, field: 'image_url' | 'video_url' | 'pdf_url') => void
}) {
  function getEmbedUrl(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return url
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-charcoal/40 uppercase tracking-wider">Training Task</p>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Title</label>
        <input
          className="input font-serif text-xl"
          value={task.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Training task title"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Description</label>
        <textarea
          className="textarea"
          rows={3}
          value={task.description}
          onChange={e => onUpdate({ description: e.target.value })}
          placeholder="Describe what the trainee needs to do..."
        />
      </div>

      {/* Content (text) */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Content</label>
        <textarea
          className="textarea font-sans text-sm leading-relaxed"
          rows={8}
          value={task.content}
          onChange={e => onUpdate({ content: e.target.value })}
          placeholder="Additional text content..."
        />
      </div>

      {/* Webpage URL */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Webpage URL</label>
        <input
          className="input"
          value={task.webpage_url ?? ''}
          onChange={e => onUpdate({ webpage_url: e.target.value || null })}
          placeholder="https://example.com"
          type="url"
        />
        {task.webpage_url && (
          <div className="mt-2 card p-3 flex items-center gap-3">
            <Globe size={14} className="text-charcoal/30 flex-shrink-0" />
            <a href={task.webpage_url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:text-gold/80 underline underline-offset-2 truncate">
              {task.webpage_url}
            </a>
            <span className="text-xs text-charcoal/30 flex-shrink-0">Opens in new tab</span>
          </div>
        )}
      </div>

      {/* Image */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Image</label>
        {task.image_url ? (
          <div className="space-y-3">
            <img src={task.image_url} alt={task.title} className="max-w-full rounded-xl border border-black/5" />
            <button onClick={() => onUpdate({ image_url: null })} className="text-xs text-red-500 hover:text-red-700">Remove image</button>
          </div>
        ) : (
          <label className="card p-6 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow">
            <Upload size={20} className="text-charcoal/30" />
            <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload an image'}</p>
            <p className="text-xs text-charcoal/25">PNG, JPEG, WebP</p>
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0], 'image_url')} />
          </label>
        )}
      </div>

      {/* Video */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Video</label>
        {task.video_url ? (
          <div className="space-y-3">
            {task.video_url.includes('youtube') || task.video_url.includes('vimeo') || task.video_url.includes('youtu.be') ? (
              <div className="card overflow-hidden" style={{ height: '400px' }}>
                <iframe src={getEmbedUrl(task.video_url)} className="w-full h-full border-0" title={task.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            ) : (
              <video src={task.video_url} controls className="max-w-full rounded-xl" />
            )}
            <button onClick={() => onUpdate({ video_url: null })} className="text-xs text-red-500 hover:text-red-700">Remove video</button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              className="input"
              value=""
              onChange={e => { if (e.target.value) onUpdate({ video_url: e.target.value }) }}
              placeholder="Paste a YouTube, Vimeo, or video URL..."
              type="url"
            />
            <p className="text-xs text-charcoal/25 text-center">or</p>
            <label className="card p-6 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow">
              <Upload size={20} className="text-charcoal/30" />
              <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Upload a video file'}</p>
              <p className="text-xs text-charcoal/25">MP4, WebM, MOV</p>
              <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0], 'video_url')} />
            </label>
          </div>
        )}
      </div>

      {/* PDF */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">PDF</label>
        {task.pdf_url ? (
          <div className="space-y-3">
            <div className="card overflow-hidden" style={{ height: '400px' }}>
              <iframe src={task.pdf_url} className="w-full h-full border-0" title={task.title} />
            </div>
            <button onClick={() => onUpdate({ pdf_url: null })} className="text-xs text-red-500 hover:text-red-700">Remove PDF</button>
          </div>
        ) : (
          <label className="card p-6 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow">
            <Upload size={20} className="text-charcoal/30" />
            <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload a PDF'}</p>
            <p className="text-xs text-charcoal/25">PDF files only</p>
            <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0], 'pdf_url')} />
          </label>
        )}
      </div>
    </div>
  )
}
