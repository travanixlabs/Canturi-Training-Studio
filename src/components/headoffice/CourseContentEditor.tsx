'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Globe, Upload, FileText } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category, Course, Subcategory, TrainingTask, TrainingTaskAttachment, AttachmentType } from '@/types'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'

interface Props {
  categoryItem: Category
  courses: Course[]
  subcategories: Subcategory[]
  trainingTasks: TrainingTask[]
  attachments: TrainingTaskAttachment[]
}

export function CourseContentEditor({ categoryItem: initialItem, courses, subcategories: initialSubcategories, trainingTasks: initialTrainingTasks, attachments: initialAttachments }: Props) {
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
  const [attachments, setAttachments] = useState<TrainingTaskAttachment[]>(initialAttachments)

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

  const getAttachmentsForTask = (taskId: string) =>
    attachments.filter(a => a.training_task_id === taskId).sort((a, b) => a.sort_order - b.sort_order)

  async function addAttachment(taskId: string, type: AttachmentType, url: string, insertAtIndex?: number) {
    const existing = getAttachmentsForTask(taskId)
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
    const sortOrder = insertAtIndex ?? existing.length

    // If inserting in between, bump sort_orders of items at or after this position
    if (insertAtIndex != null) {
      const toUpdate = existing.filter(a => a.sort_order >= sortOrder)
      for (const a of toUpdate) {
        await supabase.from('training_task_attachments').update({ sort_order: a.sort_order + 1 }).eq('id', a.id)
      }
      setAttachments(prev => prev.map(a =>
        a.training_task_id === taskId && a.sort_order >= sortOrder
          ? { ...a, sort_order: a.sort_order + 1 }
          : a
      ))
    }

    const { data, error } = await supabase.from('training_task_attachments').insert({
      training_task_id: taskId,
      type,
      title: `${typeLabel} ${existing.length + 1}`,
      url,
      sort_order: sortOrder,
    }).select().single()
    if (!error && data) {
      setAttachments(prev => [...prev, data as TrainingTaskAttachment])
    }
  }

  async function removeAttachment(id: string) {
    await supabase.from('training_task_attachments').delete().eq('id', id)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  async function updateAttachment(id: string, updates: Partial<TrainingTaskAttachment>) {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    await supabase.from('training_task_attachments').update(updates).eq('id', id)
  }

  async function handleAttachmentUpload(taskId: string, file: File, type: AttachmentType) {
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

    await addAttachment(taskId, type, urlData.publicUrl)
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
                const subTasks = getTasksForSubcategory(sub.id)
                const hasSelectedTask = selectedTrainingTaskId != null && subTasks.some(t => t.id === selectedTrainingTaskId)
                const isSelected = selectedSubcategoryId === sub.id && !editingCategoryDetails && !selectedTrainingTaskId
                const isExpanded = selectedSubcategoryId === sub.id || hasSelectedTask

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
              attachments={getAttachmentsForTask(activeTrainingTask.id)}
              uploading={uploading}
              onUpdate={(updates) => updateTrainingTask(activeTrainingTask.id, updates)}
              onAddAttachment={(type, url, insertAt) => addAttachment(activeTrainingTask.id, type, url, insertAt)}
              onUpdateAttachment={updateAttachment}
              onRemoveAttachment={removeAttachment}
              onFileUpload={(file, type) => handleAttachmentUpload(activeTrainingTask.id, file, type)}
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
  attachments,
  uploading,
  onUpdate,
  onAddAttachment,
  onUpdateAttachment,
  onRemoveAttachment,
  onFileUpload,
}: {
  task: TrainingTask
  attachments: TrainingTaskAttachment[]
  uploading: boolean
  onUpdate: (updates: Partial<TrainingTask>) => void
  onAddAttachment: (type: AttachmentType, url: string, insertAtIndex?: number) => void
  onUpdateAttachment: (id: string, updates: Partial<TrainingTaskAttachment>) => void
  onRemoveAttachment: (id: string) => void
  onFileUpload: (file: File, type: AttachmentType) => void
}) {
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [webpageUrlInput, setWebpageUrlInput] = useState('')
  const [addingType, setAddingType] = useState<AttachmentType | null>(null)

  function getEmbedUrl(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return url
  }

  function isEmbeddable(url: string) {
    return url.includes('youtube') || url.includes('vimeo') || url.includes('youtu.be')
  }

  const ATTACHMENT_OPTIONS: { value: AttachmentType; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: 'Text', icon: <FileText size={14} /> },
    { value: 'webpage', label: 'Webpage', icon: <Globe size={14} /> },
    { value: 'image', label: 'Image', icon: <Upload size={14} /> },
    { value: 'video', label: 'Video', icon: <Upload size={14} /> },
    { value: 'pdf', label: 'PDF', icon: <Upload size={14} /> },
  ]

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

      {/* Content */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-3">Content</label>

        {attachments.length > 0 && (
          <div className="space-y-3 mb-4">
            {attachments.map(att => (
              <div key={att.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      className="flex-1 text-xs font-medium text-charcoal/70 bg-transparent border-b border-transparent hover:border-charcoal/15 focus:border-gold focus:outline-none py-0.5 transition-colors"
                      value={att.title}
                      onChange={e => onUpdateAttachment(att.id, { title: e.target.value })}
                      placeholder="Title..."
                    />
                    <span className="text-[10px] text-charcoal/25 uppercase flex-shrink-0">{att.type}</span>
                    <button onClick={() => onRemoveAttachment(att.id)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">Remove</button>
                  </div>

                  {att.type === 'text' && (
                    <RichTextEditor
                      content={att.url}
                      onChange={(html: string) => onUpdateAttachment(att.id, { url: html })}
                    />
                  )}

                  {att.type === 'webpage' && (
                    <div className="flex items-center gap-3">
                      <Globe size={14} className="text-charcoal/30 flex-shrink-0" />
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:text-gold/80 underline underline-offset-2 truncate">
                        {att.url}
                      </a>
                      <span className="text-xs text-charcoal/30 flex-shrink-0">Opens in new tab</span>
                    </div>
                  )}

                  {att.type === 'image' && (
                    <img src={att.url} alt="Attachment" className="max-w-full rounded-lg border border-black/5" />
                  )}

                  {att.type === 'video' && (
                    isEmbeddable(att.url) ? (
                      <div className="rounded-lg overflow-hidden" style={{ height: '300px' }}>
                        <iframe src={getEmbedUrl(att.url)} className="w-full h-full border-0" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      </div>
                    ) : (
                      <video src={att.url} controls className="max-w-full rounded-lg" />
                    )
                  )}

                  {att.type === 'pdf' && (
                    <div className="rounded-lg overflow-hidden" style={{ height: '300px' }}>
                      <iframe src={att.url} className="w-full h-full border-0" title="PDF" />
                    </div>
                  )}
                </div>
            ))}
          </div>
        )}

        {/* Add content inline form */}
        {addingType === 'webpage' && (
          <div className="card p-4 mb-3 space-y-2">
            <p className="text-xs font-medium text-charcoal/50">Add Webpage</p>
            <input
              className="input"
              value={webpageUrlInput}
              onChange={e => setWebpageUrlInput(e.target.value)}
              placeholder="https://example.com"
              type="url"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (webpageUrlInput.trim()) { onAddAttachment('webpage', webpageUrlInput.trim()); setWebpageUrlInput(''); setAddingType(null) } }}
                disabled={!webpageUrlInput.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-gold text-white rounded-lg hover:bg-gold/90 disabled:opacity-40"
              >
                Add
              </button>
              <button onClick={() => { setAddingType(null); setWebpageUrlInput('') }} className="px-3 py-1.5 text-xs text-charcoal/50">Cancel</button>
            </div>
          </div>
        )}

        {addingType === 'video' && (
          <div className="card p-4 mb-3 space-y-2">
            <p className="text-xs font-medium text-charcoal/50">Add Video</p>
            <input
              className="input"
              value={videoUrlInput}
              onChange={e => setVideoUrlInput(e.target.value)}
              placeholder="Paste a YouTube, Vimeo, or video URL..."
              type="url"
              autoFocus
            />
            <div className="flex gap-2 items-center">
              <button
                onClick={() => { if (videoUrlInput.trim()) { onAddAttachment('video', videoUrlInput.trim()); setVideoUrlInput(''); setAddingType(null) } }}
                disabled={!videoUrlInput.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-gold text-white rounded-lg hover:bg-gold/90 disabled:opacity-40"
              >
                Add Link
              </button>
              <span className="text-xs text-charcoal/25">or</span>
              <label className="px-3 py-1.5 text-xs font-medium text-gold hover:text-gold/80 cursor-pointer">
                Upload file
                <input type="file" accept="video/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { onFileUpload(e.target.files[0], 'video'); setAddingType(null) } }} />
              </label>
              <button onClick={() => { setAddingType(null); setVideoUrlInput('') }} className="px-3 py-1.5 text-xs text-charcoal/50 ml-auto">Cancel</button>
            </div>
          </div>
        )}

        {addingType === 'image' && (
          <div className="card p-4 mb-3">
            <p className="text-xs font-medium text-charcoal/50 mb-2">Add Image</p>
            <label className="card p-6 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow">
              <Upload size={20} className="text-charcoal/30" />
              <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload an image'}</p>
              <p className="text-xs text-charcoal/25">PNG, JPEG, WebP</p>
              <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { onFileUpload(e.target.files[0], 'image'); setAddingType(null) } }} />
            </label>
            <button onClick={() => setAddingType(null)} className="text-xs text-charcoal/50 mt-2">Cancel</button>
          </div>
        )}

        {addingType === 'pdf' && (
          <div className="card p-4 mb-3">
            <p className="text-xs font-medium text-charcoal/50 mb-2">Add PDF</p>
            <label className="card p-6 flex flex-col items-center gap-2 cursor-pointer hover:shadow-md transition-shadow">
              <Upload size={20} className="text-charcoal/30" />
              <p className="text-sm text-charcoal/40">{uploading ? 'Uploading...' : 'Click to upload a PDF'}</p>
              <p className="text-xs text-charcoal/25">PDF files only</p>
              <input type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) { onFileUpload(e.target.files[0], 'pdf'); setAddingType(null) } }} />
            </label>
            <button onClick={() => setAddingType(null)} className="text-xs text-charcoal/50 mt-2">Cancel</button>
          </div>
        )}

        {/* Add attachment button */}
        {!addingType && (
          <div className="relative">
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-charcoal/15 text-charcoal/40 hover:border-gold hover:text-gold transition-all text-sm"
            >
              <Plus size={14} />
              <span>Add content</span>
            </button>
            {showAttachmentMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAttachmentMenu(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white border border-charcoal/10 rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                  {ATTACHMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setShowAttachmentMenu(false)
                        if (opt.value === 'text') {
                          onAddAttachment('text', '')
                        } else {
                          setAddingType(opt.value)
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-charcoal/5 text-charcoal/70 transition-colors"
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Preview */}
      {(task.title || task.description || attachments.length > 0) && (
        <div className="pt-6 border-t border-black/5">
          <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-4">Preview</p>
          <div className="card p-5 space-y-4">
            {task.title && (
              <h3 className="font-serif text-lg text-charcoal">{task.title}</h3>
            )}
            {task.description && (
              <p className="text-sm text-charcoal/60 leading-relaxed">{task.description}</p>
            )}
            {attachments.length > 0 && (
              <div className="space-y-3 pt-2">
                {attachments.map(att => (
                  <div key={att.id}>
                    {att.title && <p className="text-xs font-medium text-charcoal/50 mb-1.5">{att.title}</p>}
                    {att.type === 'text' && att.url && (
                      <div className="prose prose-sm max-w-none text-charcoal/70" dangerouslySetInnerHTML={{ __html: att.url }} />
                    )}
                    {att.type === 'webpage' && (
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gold hover:text-gold/80 underline underline-offset-2">
                        <Globe size={14} />
                        {att.url}
                      </a>
                    )}
                    {att.type === 'image' && (
                      <img src={att.url} alt={att.title} className="max-w-full rounded-lg border border-black/5" />
                    )}
                    {att.type === 'video' && (
                      isEmbeddable(att.url) ? (
                        <div className="rounded-lg overflow-hidden" style={{ height: '300px' }}>
                          <iframe src={getEmbedUrl(att.url)} className="w-full h-full border-0" title={att.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                      ) : (
                        <video src={att.url} controls className="max-w-full rounded-lg" />
                      )
                    )}
                    {att.type === 'pdf' && (
                      <div className="rounded-lg overflow-hidden border border-black/5" style={{ height: '400px' }}>
                        <iframe src={att.url} className="w-full h-full border-0" title={att.title} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RichTextEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: 'Start writing...' }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange(e.getHTML())
      }, 600)
    },
  })

  if (!editor) return null

  return (
    <div className="border border-charcoal/10 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-charcoal/10 bg-charcoal/[0.02]">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded text-xs font-bold transition-colors ${editor.isActive('bold') ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded text-xs italic transition-colors ${editor.isActive('italic') ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`px-2 py-1 rounded text-xs underline transition-colors ${editor.isActive('underline') ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          U
        </button>
        <span className="w-px h-4 bg-charcoal/10 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${editor.isActive('bulletList') ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${editor.isActive('orderedList') ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          1. List
        </button>
        <span className="w-px h-4 bg-charcoal/10 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 rounded text-xs transition-colors ${editor.isActive('blockquote') ? 'bg-gold/10 text-gold' : 'text-charcoal/40 hover:text-charcoal/70'}`}
        >
          &ldquo;
        </button>
      </div>
      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-4 py-3 min-h-[200px] text-charcoal/80 focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[180px] [&_.is-editor-empty:first-child::before]:text-charcoal/30 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  )
}
