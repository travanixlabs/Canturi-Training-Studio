'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, Copy, ChevronUp, ChevronDown, Globe, Upload, FileText } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category, Course, Subcategory, TrainingTask, TrainingTaskContent, AttachmentType, TrainerType, Modality, RoleLevel, PriorityLevel } from '@/types'

interface Props {
  categoryItem: Category
  courses: Course[]
  subcategories: Subcategory[]
  trainingTasks: TrainingTask[]
  attachments: TrainingTaskContent[]
}

export function CourseContentEditor({ categoryItem: initialItem, courses, subcategories: initialSubcategories, trainingTasks: initialTrainingTasks, attachments: initialAttachments }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Category fields
  const [title, setTitle] = useState(initialItem.title)
  const [description, setDescription] = useState(initialItem.description)
  const [courseId, setCourseId] = useState(initialItem.course_id)

  // Subcategories
  const [subcategories, setSubcategories] = useState<Subcategory[]>(initialSubcategories)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null)
  const [editingCategoryDetails, setEditingCategoryDetails] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Training tasks
  const [trainingTasks, setTrainingTasks] = useState<TrainingTask[]>(initialTrainingTasks)
  const [selectedTrainingTaskId, setSelectedTrainingTaskId] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<TrainingTaskContent[]>(initialAttachments)

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)

  const activeSubcategory = subcategories.find(s => s.id === selectedSubcategoryId)
  const activeTrainingTask = trainingTasks.find(t => t.id === selectedTrainingTaskId)
  const course = courses.find(c => c.id === courseId)

  // Get training tasks for a specific subcategory
  const getTasksForSubcategory = (subcategoryId: string) =>
    trainingTasks.filter(t => t.subcategory_id === subcategoryId)

  // Guard: check if current task is an incomplete draft before navigating away
  function guardNavigation(proceed: () => void) {
    if (selectedTrainingTaskId) {
      const currentTask = trainingTasks.find(t => t.id === selectedTrainingTaskId)
      if (currentTask && !isTaskValid(currentTask)) {
        const confirmed = window.confirm(
          'This training task has incomplete mandatory fields.\n\nIf you leave now, the task will be deleted.\n\nAre you sure you want to leave?'
        )
        if (!confirmed) return
        // Delete the incomplete draft
        deleteTrainingTask(selectedTrainingTaskId)
      }
    }
    proceed()
  }

  function selectSubcategory(id: string) {
    guardNavigation(() => {
      setSelectedSubcategoryId(id)
      setSelectedTrainingTaskId(null)
      setEditingCategoryDetails(false)
    })
  }

  function selectTrainingTask(id: string) {
    if (id === selectedTrainingTaskId) return
    guardNavigation(() => {
      setSelectedTrainingTaskId(id)
      setEditingCategoryDetails(false)
    })
  }

  function selectCategoryDetails() {
    guardNavigation(() => {
      setEditingCategoryDetails(true)
      setSelectedSubcategoryId(null)
      setSelectedTrainingTaskId(null)
    })
  }

  const autoSave = useCallback(async () => {
    if (!title.trim() || !description.trim()) return
    setSaveStatus('saving')
    await supabase.from('categories').update({
      title,
      description,
      course_id: courseId,
    }).eq('id', initialItem.id)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [title, description, courseId])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { autoSave() }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [title, description, courseId])

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
    const now = new Date().toISOString()
    // Soft-delete the subcategory first
    const { data: updated, error } = await supabase.from('subcategories').update({ deleted_at: now }).eq('id', id).select()
    if (error || !updated || updated.length === 0) {
      alert('Failed to delete subcategory' + (error ? ': ' + error.message : ' — check database permissions.'))
      return
    }

    // Soft-delete child training tasks and their content
    const { data: childTasks } = await supabase.from('training_tasks').select('id').eq('subcategory_id', id).is('deleted_at', null)
    if (childTasks && childTasks.length > 0) {
      const taskIds = childTasks.map(t => t.id)
      await supabase.from('training_task_content').update({ deleted_at: now }).in('training_task_id', taskIds).is('deleted_at', null)
      await supabase.from('training_tasks').update({ deleted_at: now }).in('id', taskIds)
      setTrainingTasks(prev => prev.filter(t => !taskIds.includes(t.id)))
      setAttachments(prev => prev.filter(a => !taskIds.includes(a.training_task_id)))
    }

    setSubcategories(prev => prev.filter(s => s.id !== id))
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

  // Track which tasks are local drafts (not yet saved to DB)
  const [draftTaskIds, setDraftTaskIds] = useState<Set<string>>(new Set())

  function isTaskValid(t: TrainingTask) {
    return !!(t.title.trim() && t.trainer_type && t.modality && t.role_level && t.priority_level && (t.tags ?? []).length)
  }

  function addTrainingTask(subcategoryId: string) {
    const existing = getTasksForSubcategory(subcategoryId)
    const tempId = `draft-${Date.now()}`
    const draft: TrainingTask = {
      id: tempId,
      subcategory_id: subcategoryId,
      title: '',
      trainer_type: '',
      modality: '',
      role_level: '',
      priority_level: '',
      prerequisites: [],
      is_recurring: false,
      recurring_count: null,
      certificate_required: false,
      rewards_eligible: false,
      confidence_rating_required: true,
      tags: [],
      sort_order: existing.length,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }
    setTrainingTasks(prev => [...prev, draft])
    setDraftTaskIds(prev => new Set(prev).add(tempId))
    selectTrainingTask(tempId)
  }

  const getAttachmentsForTask = (taskId: string) =>
    attachments.filter(a => a.training_task_id === taskId).sort((a, b) => a.sort_order - b.sort_order)

  async function addAttachment(taskId: string, type: AttachmentType, url: string, insertAtIndex?: number) {
    if (draftTaskIds.has(taskId)) {
      alert('Please fill in all mandatory fields and save the training task before adding content.')
      return
    }
    const existing = getAttachmentsForTask(taskId)
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1)
    const sortOrder = insertAtIndex ?? existing.length

    // If inserting in between, bump sort_orders of items at or after this position
    if (insertAtIndex != null) {
      const toUpdate = existing.filter(a => a.sort_order >= sortOrder)
      for (const a of toUpdate) {
        await supabase.from('training_task_content').update({ sort_order: a.sort_order + 1 }).eq('id', a.id)
      }
      setAttachments(prev => prev.map(a =>
        a.training_task_id === taskId && a.sort_order >= sortOrder
          ? { ...a, sort_order: a.sort_order + 1 }
          : a
      ))
    }

    const { data, error } = await supabase.from('training_task_content').insert({
      training_task_id: taskId,
      type,
      title: `${typeLabel} ${existing.length + 1}`,
      url,
      sort_order: sortOrder,
    }).select().single()
    if (error) {
      alert('Failed to add content: ' + error.message)
      return
    }
    if (data) {
      setAttachments(prev => [...prev, data as TrainingTaskContent])
    }
  }

  async function removeAttachment(id: string) {
    await supabase.from('training_task_content').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  async function updateAttachment(id: string, updates: Partial<TrainingTaskContent>) {
    setAttachments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    await supabase.from('training_task_content').update(updates).eq('id', id)
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
    // Compute updated task synchronously from current state
    const currentTask = trainingTasks.find(t => t.id === id)
    if (!currentTask) return
    const updatedTask = { ...currentTask, ...updates }

    // Update local state
    setTrainingTasks(prev => prev.map(t => t.id === id ? updatedTask : t))

    if (!isTaskValid(updatedTask)) return

    const isDraft = draftTaskIds.has(id)
    if (isDraft) {
      // First time valid — insert into DB
      const { id: _tempId, created_at: _ca, ...payload } = updatedTask
      const { data, error } = await supabase.from('training_tasks').insert(payload).select().single()
      if (!error && data) {
        // Replace temp ID with real DB ID
        setTrainingTasks(prev => prev.map(t => t.id === id ? (data as TrainingTask) : t))
        setDraftTaskIds(prev => { const next = new Set(prev); next.delete(id); return next })
        if (selectedTrainingTaskId === id) setSelectedTrainingTaskId(data.id)
      }
    } else {
      // Already in DB — update
      await supabase.from('training_tasks').update(updates).eq('id', id)
    }
  }

  async function deleteTrainingTask(id: string) {
    setTrainingTasks(prev => prev.filter(t => t.id !== id))
    if (draftTaskIds.has(id)) {
      setDraftTaskIds(prev => { const next = new Set(prev); next.delete(id); return next })
    } else {
      const now = new Date().toISOString()
      // Soft-delete child training task content
      await supabase.from('training_task_content').update({ deleted_at: now }).eq('training_task_id', id).is('deleted_at', null)
      await supabase.from('training_tasks').update({ deleted_at: now }).eq('id', id)
      setAttachments(prev => prev.filter(a => a.training_task_id !== id))
    }
    if (selectedTrainingTaskId === id) {
      setSelectedTrainingTaskId(null)
    }
  }

  async function copyTrainingTask(id: string) {
    const source = trainingTasks.find(t => t.id === id)
    if (!source || draftTaskIds.has(id)) return

    const siblingTasks = getTasksForSubcategory(source.subcategory_id)
    const sourceIndex = siblingTasks.findIndex(t => t.id === id)
    const newSortOrder = source.sort_order + 1

    // Bump sort_order for tasks after the source
    const toShift = siblingTasks.filter(t => t.sort_order >= newSortOrder)
    for (const t of toShift) {
      await supabase.from('training_tasks').update({ sort_order: t.sort_order + 1 }).eq('id', t.id)
    }
    setTrainingTasks(prev => prev.map(t =>
      t.subcategory_id === source.subcategory_id && t.sort_order >= newSortOrder
        ? { ...t, sort_order: t.sort_order + 1 }
        : t
    ))

    // Insert the copy
    const { id: _id, created_at: _ca, deleted_at: _da, ...payload } = source
    const { data, error } = await supabase.from('training_tasks').insert({
      ...payload,
      title: source.title + ' (copy)',
      sort_order: newSortOrder,
    }).select().single()
    if (error || !data) {
      alert('Failed to copy training task' + (error ? ': ' + error.message : ''))
      return
    }

    setTrainingTasks(prev => [...prev, data as TrainingTask])

    // Copy attachments
    const sourceAttachments = attachments.filter(a => a.training_task_id === id)
    for (const att of sourceAttachments) {
      const { id: _attId, created_at: _attCa, deleted_at: _attDa, training_task_id: _tid, ...attPayload } = att
      const { data: newAtt } = await supabase.from('training_task_content').insert({
        ...attPayload,
        training_task_id: data.id,
      }).select().single()
      if (newAtt) setAttachments(prev => [...prev, newAtt as TrainingTaskContent])
    }

    selectTrainingTask(data.id)
  }

  function handleBack() {
    guardNavigation(() => {
      router.push('/head-office/courses')
    })
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
        <div className="lg:w-72 lg:h-[calc(100vh-57px)] lg:overflow-y-auto lg:sticky lg:top-[57px] lg:border-r border-b lg:border-b-0 border-black/5 bg-white">
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
                <span className="line-clamp-2">{sub.title}</span>
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
                        <span className="text-sm leading-snug">{sub.title}</span>
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
                              <span className="leading-snug">{task.title}</span>
                            </button>
                            {!draftTaskIds.has(task.id) && (
                              <button
                                onClick={() => copyTrainingTask(task.id)}
                                className="hidden group-hover/task:block p-1 text-charcoal/20 hover:text-blue-500 flex-shrink-0"
                                title="Duplicate"
                              >
                                <Copy size={10} />
                              </button>
                            )}
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
                <select className="input" value={courseId} onChange={e => setCourseId(e.target.value)}>
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
              siblingTasks={(() => {
                const sub = subcategories.find(s => s.id === activeTrainingTask.subcategory_id)
                if (!sub) return []
                const catSubIds = new Set(subcategories.filter(s => s.category_id === sub.category_id).map(s => s.id))
                return trainingTasks.filter(t => catSubIds.has(t.subcategory_id) && t.id !== activeTrainingTask.id)
              })()}
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

const TRAINER_TYPES: TrainerType[] = ['Self Directed', 'Senior', 'Manager']
const MODALITIES: Modality[] = ['Website Reference', 'Online Tool', 'Role Play', 'Shadowing', 'SOP', 'Video', 'Coaching Session', 'Self Directed Task', 'External Education', 'Zoom Session', 'Upskill Friday', 'Workshop']
const ROLE_LEVELS: RoleLevel[] = ['Consultant', 'Specialist', 'Senior Specialist']
const PRIORITY_LEVELS: PriorityLevel[] = ['Essential', 'Core', 'Advanced']

function TrainingTaskEditor({
  task,
  siblingTasks,
  attachments,
  uploading,
  onUpdate,
  onAddAttachment,
  onUpdateAttachment,
  onRemoveAttachment,
  onFileUpload,
}: {
  task: TrainingTask
  siblingTasks: TrainingTask[]
  attachments: TrainingTaskContent[]
  uploading: boolean
  onUpdate: (updates: Partial<TrainingTask>) => void
  onAddAttachment: (type: AttachmentType, url: string, insertAtIndex?: number) => void
  onUpdateAttachment: (id: string, updates: Partial<TrainingTaskContent>) => void
  onRemoveAttachment: (id: string) => void
  onFileUpload: (file: File, type: AttachmentType) => void
}) {
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [webpageUrlInput, setWebpageUrlInput] = useState('')
  const [addingType, setAddingType] = useState<AttachmentType | null>(null)
  const [tagsInput, setTagsInput] = useState((task.tags ?? []).join(', '))
  const [touched, setTouched] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const missing = {
    title: !task.title.trim(),
    trainer_type: !task.trainer_type,
    modality: !task.modality,
    role_level: !task.role_level,
    priority_level: !task.priority_level,
    tags: !(task.tags ?? []).length,
  }
  const hasIncomplete = Object.values(missing).some(Boolean)

  // Sync tags input when task changes
  useEffect(() => {
    setTagsInput((task.tags ?? []).join(', '))
    setTouched(false)
  }, [task.id])

  // Warn on page leave if mandatory fields are incomplete
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasIncomplete) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasIncomplete])

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

  function handleTagsBlur() {
    setTouched(true)
    const parsed = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    onUpdate({ tags: parsed })
  }

  const err = (field: keyof typeof missing) => touched && missing[field]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-charcoal/40 uppercase tracking-wider">Training Task</p>
        {touched && hasIncomplete && (
          <p className="text-xs text-red-500">Please complete all mandatory fields</p>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          className={`input font-serif text-xl ${err('title') ? 'border-red-300 bg-red-50/30' : ''}`}
          value={task.title}
          onChange={e => { setTouched(true); onUpdate({ title: e.target.value }) }}
          placeholder="Training task title"
        />
      </div>

      {/* Task Details toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm ${
          hasIncomplete && touched
            ? 'border-red-200 bg-red-50/30 text-red-600'
            : showDetails
            ? 'border-gold/30 bg-gold/5 text-gold'
            : 'border-charcoal/10 text-charcoal/50 hover:border-charcoal/20'
        }`}
      >
        <span className="font-medium">Task Details</span>
        {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showDetails && (
      <div className="space-y-5 pl-1">

      {/* 1. Prerequisites */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Prerequisites</label>
        {siblingTasks.length === 0 ? (
          <p className="text-xs text-charcoal/30">No other training tasks in this subcategory</p>
        ) : (() => {
          const selectedCount = (task.prerequisites ?? []).length
          return (
            <details className="group">
              <summary className="input cursor-pointer flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                <span className="text-sm text-charcoal/60">
                  {selectedCount === 0 ? 'None selected' : `${selectedCount} prerequisite${selectedCount !== 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={14} className="text-charcoal/30 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 space-y-1.5">
                {siblingTasks.map(st => {
                  const isSelected = (task.prerequisites ?? []).includes(st.id)
                  return (
                    <button
                      key={st.id}
                      onClick={() => {
                        const current = task.prerequisites ?? []
                        const updated = isSelected ? current.filter(id => id !== st.id) : [...current, st.id]
                        onUpdate({ prerequisites: updated })
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-sm transition-all border ${
                        isSelected ? 'border-gold bg-gold/5 text-gold' : 'border-charcoal/10 text-charcoal/60 hover:border-charcoal/20'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] flex-shrink-0 ${isSelected ? 'bg-gold border-gold text-white' : 'border-charcoal/20'}`}>
                        {isSelected && '✓'}
                      </span>
                      {st.title}
                    </button>
                  )
                })}
              </div>
            </details>
          )
        })()}
      </div>

      {/* 2. Tags */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
          Tags <span className="text-red-400">*</span> <span className="text-charcoal/30 normal-case font-normal">(comma-separated)</span>
        </label>
        <input
          className={`input ${err('tags') ? 'border-red-300 bg-red-50/30' : ''}`}
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          onBlur={handleTagsBlur}
          placeholder="e.g. diamonds, consultation, sales"
        />
      </div>

      {/* 3. Trainer Type */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
          Trainer Type <span className="text-red-400">*</span>
        </label>
        <select
          className={`input ${err('trainer_type') ? 'border-red-300 bg-red-50/30' : ''}`}
          value={task.trainer_type}
          onChange={e => { setTouched(true); onUpdate({ trainer_type: e.target.value as TrainerType }) }}
        >
          <option value="" disabled>Select trainer type…</option>
          {TRAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* 3. Modality */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
          Modality <span className="text-red-400">*</span>
        </label>
        <select
          className={`input ${err('modality') ? 'border-red-300 bg-red-50/30' : ''}`}
          value={task.modality}
          onChange={e => { setTouched(true); onUpdate({ modality: e.target.value as Modality }) }}
        >
          <option value="" disabled>Select modality…</option>
          {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* 4. Role Level */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
          Role Level <span className="text-red-400">*</span>
        </label>
        <select
          className={`input ${err('role_level') ? 'border-red-300 bg-red-50/30' : ''}`}
          value={task.role_level}
          onChange={e => { setTouched(true); onUpdate({ role_level: e.target.value as RoleLevel }) }}
        >
          <option value="" disabled>Select role level…</option>
          {ROLE_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* 5. Priority Level */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
          Priority Level <span className="text-red-400">*</span>
        </label>
        <select
          className={`input ${err('priority_level') ? 'border-red-300 bg-red-50/30' : ''}`}
          value={task.priority_level}
          onChange={e => { setTouched(true); onUpdate({ priority_level: e.target.value as PriorityLevel }) }}
        >
          <option value="" disabled>Select priority level…</option>
          {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* 6. Recurring */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Recurring</label>
        <select className="input" value={task.is_recurring ? 'Yes' : 'No'} onChange={e => {
          const isYes = e.target.value === 'Yes'
          onUpdate({ is_recurring: isYes, recurring_count: isYes ? (task.recurring_count ?? 2) : null })
        }}>
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>

      {/* 7. Recurring Count */}
      {task.is_recurring && (
        <div>
          <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Recurring Count</label>
          <select className="input w-24" value={task.recurring_count ?? 2} onChange={e => onUpdate({ recurring_count: Number(e.target.value) })}>
            {Array.from({ length: 19 }, (_, i) => i + 2).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}

      {/* 8. Certificate Required */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Certificate Required</label>
        <select className="input" value={task.certificate_required ? 'Yes' : 'No'} onChange={e => onUpdate({ certificate_required: e.target.value === 'Yes' })}>
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>

      {/* 9. Rewards Eligible */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Rewards Eligible</label>
        <select className="input" value={task.rewards_eligible ? 'Yes' : 'No'} onChange={e => onUpdate({ rewards_eligible: e.target.value === 'Yes' })}>
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>

      {/* 10. Confidence Rating Required */}
      <div>
        <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">Confidence Rating Required</label>
        <select className="input" value={task.confidence_rating_required ? 'Yes' : 'No'} onChange={e => onUpdate({ confidence_rating_required: e.target.value === 'Yes' })}>
          <option value="No">No</option>
          <option value="Yes">Yes</option>
        </select>
      </div>

      </div>
      )}

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
                    <textarea
                      className="textarea font-sans text-sm leading-relaxed"
                      rows={8}
                      value={att.url}
                      onChange={e => onUpdateAttachment(att.id, { url: e.target.value })}
                      placeholder="Write text content here..."
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
      {(task.title || attachments.length > 0) && (
        <div className="pt-6 border-t border-black/5">
          <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-4">Preview</p>
          <div className="card p-5 space-y-4">
            {task.title && (
              <h3 className="font-serif text-lg text-charcoal">{task.title}</h3>
            )}
            {attachments.length > 0 && (
              <div className="space-y-3 pt-2">
                {attachments.map(att => (
                  <div key={att.id}>
                    {att.title && <p className="text-xs font-medium text-charcoal/50 mb-1.5">{att.title}</p>}
                    {att.type === 'text' && att.url && (
                      <div className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{att.url}</div>
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

