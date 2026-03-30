'use client'

import { useState, useTransition } from 'react'
import { X, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Eye, EyeOff, GripVertical } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Course, Category } from '@/types'

interface Props {
  courses: Course[]
  categories: Category[]
}

interface CourseFormData {
  title: string
  description: string
  course_id: string
}

interface CategoryFormData {
  name: string
  icon: string
  colour_hex: string
  sort_order: string
}

const emptyCourseForm = (): CourseFormData => ({
  title: '',
  description: '',
  course_id: '',
})

const emptyCategoryForm = (): CategoryFormData => ({
  name: '',
  icon: '',
  colour_hex: '#C9A96E',
  sort_order: '',
})

export function CourseEditor({ courses: initialCourses, categories: initialItems }: Props) {
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [categories, setCategorys] = useState<Category[]>(initialItems)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Course modal
  const [courseModal, setCourseModal] = useState<{ mode: 'add'; categoryId: string } | { mode: 'edit'; item: Category } | null>(null)
  const [courseForm, setCourseForm] = useState<CourseFormData>(emptyCourseForm())
  const [courseError, setCourseError] = useState<string | null>(null)
  const [courseSaving, setCourseSaving] = useState(false)

  // Course modal
  const [categoryModal, setCategoryModal] = useState<{ mode: 'add' } | { mode: 'edit'; course: Course } | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategoryForm())
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [categorySaving, setCategorySaving] = useState(false)

  // Drag and drop
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Course | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Status change pending

  const [, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openAddCourse(categoryId: string) {
    setCourseForm({ ...emptyCourseForm(), course_id: categoryId })
    setCourseError(null)
    setCourseModal({ mode: 'add', categoryId })
  }

  function openEditCourse(item: Category) {
    setCourseForm({
      title: item.title,
      description: item.description,
      course_id: item.course_id,
    })
    setCourseError(null)
    setCourseModal({ mode: 'edit', item })
  }

  function closeCourseModal() {
    setCourseModal(null)
    setCourseError(null)
  }

  async function saveCourse() {
    if (!courseForm.title.trim()) { setCourseError('Title is required.'); return }
    if (!courseForm.description.trim()) { setCourseError('Description is required.'); return }
    if (!courseForm.course_id) { setCourseError('Course is required.'); return }

    setCourseSaving(true)
    setCourseError(null)

    const payload = {
      title: courseForm.title.trim(),
      description: courseForm.description.trim(),
      course_id: courseForm.course_id,
    }

    if (courseModal?.mode === 'add') {
      const { data, error } = await supabase
        .from('categories')
        .insert(payload)
        .select('*, course:courses(*)')
        .single()

      if (error) {
        setCourseError('Failed to create category. ' + error.message)
        setCourseSaving(false)
        return
      }

      setCategorys(prev => [...prev, data as Category])
    } else if (courseModal?.mode === 'edit') {
      const { data, error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', courseModal.item.id)
        .select('*, course:courses(*)')
        .single()

      if (error) {
        setCourseError('Failed to update category. ' + error.message)
        setCourseSaving(false)
        return
      }

      setCategorys(prev => prev.map(i => (i.id === courseModal.item.id ? (data as Category) : i)))
    }

    setCourseSaving(false)
    closeCourseModal()
    startTransition(() => router.refresh())
  }

  async function deleteCourse() {
    if (!deleteTarget) return
    setDeleting(true)

    const now = new Date().toISOString()
    // Soft-delete child subcategories, their training tasks, and training task content
    const { data: childSubs } = await supabase.from('subcategories').select('id').eq('category_id', deleteTarget.id).is('deleted_at', null)
    if (childSubs && childSubs.length > 0) {
      const subIds = childSubs.map(s => s.id)
      const { data: childTasks } = await supabase.from('training_tasks').select('id').in('subcategory_id', subIds).is('deleted_at', null)
      if (childTasks && childTasks.length > 0) {
        const taskIds = childTasks.map(t => t.id)
        await supabase.from('training_task_content').update({ deleted_at: now }).in('training_task_id', taskIds).is('deleted_at', null)
        await supabase.from('training_tasks').update({ deleted_at: now }).in('id', taskIds)
      }
      await supabase.from('subcategories').update({ deleted_at: now }).in('id', subIds)
    }
    const { error } = await supabase.from('categories').update({ deleted_at: now }).eq('id', deleteTarget.id)
    if (error) {
      setDeleting(false)
      return
    }

    setCategorys(prev => prev.filter(i => i.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
    startTransition(() => router.refresh())
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) {
      setCategoryError('Name is required.')
      return
    }
    if (!categoryForm.icon.trim()) {
      setCategoryError('Icon is required.')
      return
    }

    setCategorySaving(true)
    setCategoryError(null)

    if (categoryModal?.mode === 'edit') {
      const { error } = await supabase.from('courses').update({
        name: categoryForm.name.trim(),
        icon: categoryForm.icon.trim(),
        colour_hex: categoryForm.colour_hex,
      }).eq('id', categoryModal.course.id)

      if (error) {
        setCategoryError('Failed to update. ' + error.message)
        setCategorySaving(false)
        return
      }

      setCourses(prev => prev.map(c => c.id === categoryModal.course.id ? { ...c, name: categoryForm.name.trim(), icon: categoryForm.icon.trim(), colour_hex: categoryForm.colour_hex } : c))
    } else {
      const { data, error } = await supabase.from('courses').insert({
        name: categoryForm.name.trim(),
        icon: categoryForm.icon.trim(),
        colour_hex: categoryForm.colour_hex,
        sort_order: courses.length + 1,
      }).select().single()

      if (error) {
        setCategoryError('Failed to create course. ' + error.message)
        setCategorySaving(false)
        return
      }

      setCourses(prev => [...prev, data as Course].sort((a, b) => a.sort_order - b.sort_order))
    }

    setCategorySaving(false)
    setCategoryModal(null)
    setCategoryForm(emptyCategoryForm())
    startTransition(() => router.refresh())
  }

  function openEditCategory(cat: Course) {
    setCategoryForm({ name: cat.name, icon: cat.icon, colour_hex: cat.colour_hex, sort_order: '' })
    setCategoryError(null)
    setCategoryModal({ mode: 'edit', course: cat })
  }

  async function handleDrop(targetCategoryId: string) {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) return

    const fromIdx = courses.findIndex(c => c.id === draggedCategoryId)
    const toIdx = courses.findIndex(c => c.id === targetCategoryId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...courses]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const updated = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }))
    setCourses(updated)
    setDraggedCategoryId(null)
    setDragOverCategoryId(null)

    await Promise.all(
      updated.map(c => supabase.from('courses').update({ sort_order: c.sort_order }).eq('id', c.id))
    )
  }

  async function handleItemDrop(targetItemId: string, courseId: string) {
    if (!draggedItemId || draggedItemId === targetItemId) return

    const courseItems = categories.filter(i => i.course_id === courseId)
    const fromIdx = courseItems.findIndex(i => i.id === draggedItemId)
    const toIdx = courseItems.findIndex(i => i.id === targetItemId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...courseItems]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    // Update local state with new sort orders
    const updatedIds = new Map(reordered.map((item, i) => [item.id, i]))
    setCategorys(prev => prev.map(item =>
      updatedIds.has(item.id) ? { ...item, sort_order: updatedIds.get(item.id)! } : item
    ))
    setDraggedItemId(null)
    setDragOverItemId(null)

    // Persist to DB
    await Promise.all(
      reordered.map((item, i) => supabase.from('categories').update({ sort_order: i }).eq('id', item.id))
    )
  }

  async function changeCourseStatus(cat: Course, status: 'active' | 'hidden') {
    const { error } = await supabase.from('courses').update({ status }).eq('id', cat.id)
    if (error) {
      alert('Failed to update course: ' + error.message)
      return
    }
    setCourses(prev => prev.map(c => c.id === cat.id ? { ...c, status } : c))
  }

  async function deleteCategory() {
    if (!deleteCategoryTarget) return
    setDeleting(true)

    const now = new Date().toISOString()
    // Soft-delete all categories in this course and their children
    const { data: catSubs } = await supabase.from('categories').select('id').eq('course_id', deleteCategoryTarget.id).is('deleted_at', null)
    if (catSubs && catSubs.length > 0) {
      const catIds = catSubs.map(c => c.id)
      const { data: childSubs } = await supabase.from('subcategories').select('id').in('category_id', catIds).is('deleted_at', null)
      if (childSubs && childSubs.length > 0) {
        const subIds = childSubs.map(s => s.id)
        const { data: childTasks } = await supabase.from('training_tasks').select('id').in('subcategory_id', subIds).is('deleted_at', null)
        if (childTasks && childTasks.length > 0) {
          const taskIds = childTasks.map(t => t.id)
          await supabase.from('training_task_content').update({ deleted_at: now }).in('training_task_id', taskIds).is('deleted_at', null)
          await supabase.from('training_tasks').update({ deleted_at: now }).in('id', taskIds)
        }
        await supabase.from('subcategories').update({ deleted_at: now }).in('id', subIds)
      }
      await supabase.from('categories').update({ deleted_at: now }).in('id', catIds)
    }
    await supabase.from('courses').delete().eq('id', deleteCategoryTarget.id)

    setCategorys(prev => prev.filter(i => i.course_id !== deleteCategoryTarget.id))
    setCourses(prev => prev.filter(c => c.id !== deleteCategoryTarget.id))
    setDeleting(false)
    setDeleteCategoryTarget(null)
    startTransition(() => router.refresh())
  }

  const itemsByCategory = (categoryId: string) =>
    categories.filter(i => i.course_id === categoryId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Course Menu</h1>
          <p className="text-sm text-charcoal/40 mt-1">{categories.length} categories across {courses.length} courses</p>
        </div>
        <button
          onClick={() => { setCategoryForm(emptyCategoryForm()); setCategoryError(null); setCategoryModal({ mode: 'add' }) }}
          className="btn-outline flex items-center gap-2 text-sm"
        >
          <Plus size={15} />
          Add course
        </button>
      </div>

      {/* Course list */}
      <div className="space-y-2">
        {courses.map(category => {
          const items = itemsByCategory(category.id)
          const expanded = expandedCategories.has(category.id)

          return (
            <div
              key={category.id}
              className={`card overflow-hidden transition-all ${draggedCategoryId === category.id ? 'opacity-40 scale-[0.97]' : ''} ${dragOverCategoryId === category.id && draggedCategoryId !== category.id ? 'ring-2 ring-gold ring-offset-2' : ''} ${category.status === 'hidden' ? 'opacity-50' : ''}`}
              draggable
              onDragStart={() => setDraggedCategoryId(category.id)}
              onDragEnd={() => { setDraggedCategoryId(null); setDragOverCategoryId(null) }}
              onDragOver={e => { e.preventDefault(); setDragOverCategoryId(category.id) }}
              onDragLeave={() => setDragOverCategoryId(null)}
              onDrop={() => handleDrop(category.id)}
            >
              {/* Course header */}
              <div className="flex items-center">
                {/* Drag handle */}
                <div className="pl-3 pr-1 py-4 cursor-grab active:cursor-grabbing text-charcoal/20 hover:text-charcoal/40">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>
                </div>

                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex-1 pr-2 py-4 flex items-center gap-3 text-left"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                  >
                    {category.icon}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-charcoal text-[15px]">{category.name}</p>
                    <p className="text-xs text-charcoal/35 mt-0.5">{items.length} {items.length !== 1 ? 'categories' : 'category'}</p>
                  </div>
                  {expanded ? (
                    <ChevronUp size={16} className="text-charcoal/30" />
                  ) : (
                    <ChevronDown size={16} className="text-charcoal/30" />
                  )}
                </button>

                <button
                  onClick={() => openEditCategory(category)}
                  className="p-2 text-charcoal/25 hover:text-gold transition-colors"
                  title="Edit course"
                >
                  <Pencil size={14} />
                </button>

                <button
                  onClick={() => changeCourseStatus(category, category.status === 'hidden' ? 'active' : 'hidden')}
                  className="p-2 text-charcoal/25 hover:text-charcoal/50 transition-colors"
                  title={category.status === 'hidden' ? 'Show course' : 'Hide course'}
                >
                  <EyeOff size={14} />
                </button>

                <button
                  onClick={() => setDeleteCategoryTarget(category)}
                  className="p-2 text-charcoal/25 hover:text-red-500 transition-colors"
                  title="Delete course"
                >
                  <Trash2 size={14} />
                </button>

                <button
                  onClick={() => openAddCourse(category.id)}
                  className="mr-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-charcoal/50 hover:text-gold border border-charcoal/10 hover:border-gold transition-all"
                >
                  <Plus size={13} />
                  Add category
                </button>
              </div>

              {/* Expanded course list */}
              {expanded && (
                <div className="border-t border-black/5 divide-y divide-black/5">
                  {items.length === 0 ? (
                    <div className="px-5 py-5 text-center">
                      <p className="text-sm text-charcoal/30">No categories yet.</p>
                      <button
                        onClick={() => openAddCourse(category.id)}
                        className="mt-2 text-sm text-gold hover:text-gold/70 transition-colors"
                      >
                        Add the first category
                      </button>
                    </div>
                  ) : (
                    items.map(item => (
                      <CourseRow
                        key={item.id}
                        item={item}
                        isDragging={draggedItemId === item.id}
                        isDragOver={dragOverItemId === item.id && draggedItemId !== item.id}
                        onEdit={() => router.push(`/head-office/courses/${item.id}`)}
                        onDelete={() => setDeleteTarget(item)}
                        onDragStart={() => setDraggedItemId(item.id)}
                        onDragEnd={() => { setDraggedItemId(null); setDragOverItemId(null) }}
                        onDragOver={e => { e.preventDefault(); setDragOverItemId(item.id) }}
                        onDragLeave={() => setDragOverItemId(null)}
                        onDrop={() => handleItemDrop(item.id, category.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {courses.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-charcoal/40 text-sm">No courses yet. Add a course to get started.</p>
          </div>
        )}
      </div>

      {/* Course form modal */}
      {courseModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" onClick={closeCourseModal} />
          <div className="relative bg-white w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-serif text-xl text-charcoal">
                {courseModal.mode === 'add' ? 'Add Course' : 'Edit Course'}
              </h2>
              <button onClick={closeCourseModal} className="text-charcoal/40 hover:text-charcoal p-1 -mr-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={courseForm.title}
                  onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Diamond Ring Consultation"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={courseForm.description}
                  onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What will the trainee learn or practise?"
                />
              </div>

              {/* Course */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Course <span className="text-red-400">*</span>
                </label>
                <select
                  className="input bg-charcoal/3 cursor-not-allowed"
                  value={courseForm.course_id}
                  disabled
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {courseError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{courseError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeCourseModal}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCourse}
                  disabled={courseSaving}
                  className="btn-gold flex-1"
                >
                  {courseSaving ? 'Saving…' : courseModal.mode === 'add' ? 'Add category' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course form modal */}
      {categoryModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
            onClick={() => setCategoryModal(null)}
          />
          <div className="relative bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-serif text-xl text-charcoal">{categoryModal?.mode === 'edit' ? 'Edit Course' : 'Add Course'}</h2>
              <button
                onClick={() => setCategoryModal(null)}
                className="text-charcoal/40 hover:text-charcoal p-1 -mr-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diamonds"
                />
              </div>

              {/* Icon */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Icon <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-8 gap-1.5">
                  {['✦', '◈', '⌂', '◎', '◇', '▽', '❋', '★', '♦', '●', '■', '▲', '◆', '✧', '○', '□', '△', '⬟', '⬡', '✿', '❖', '⊕', '⊗', '⊙'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setCategoryForm(f => ({ ...f, icon }))}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                        categoryForm.icon === icon
                          ? 'border-2 border-gold shadow-sm'
                          : 'bg-charcoal/3 border-2 border-transparent hover:border-charcoal/15'
                      }`}
                      style={{ color: categoryForm.colour_hex || '#1C1C1C' }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colour */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg border border-charcoal/10 cursor-pointer p-1"
                    value={categoryForm.colour_hex}
                    onChange={e => setCategoryForm(f => ({ ...f, colour_hex: e.target.value }))}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    value={categoryForm.colour_hex}
                    onChange={e => setCategoryForm(f => ({ ...f, colour_hex: e.target.value }))}
                    placeholder="#C9A96E"
                  />
                  {/* Preview */}
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: categoryForm.colour_hex + '20', color: categoryForm.colour_hex }}
                  >
                    {categoryForm.icon || '?'}
                  </span>
                </div>
              </div>

              {categoryError && (
                <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{categoryError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setCategoryModal(null)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCategory}
                  disabled={categorySaving}
                  className="btn-gold flex-1"
                >
                  {categorySaving ? 'Saving…' : categoryModal?.mode === 'edit' ? 'Save changes' : 'Add course'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-serif text-xl text-charcoal mb-2">Delete category?</h3>
            <p className="text-sm text-charcoal/60 mb-1">
              <span className="font-medium text-charcoal">&ldquo;{deleteTarget.title}&rdquo;</span> will be permanently deleted.
            </p>
            <p className="text-sm text-charcoal/40 mb-6">
              This cannot be undone. Consider archiving instead if you may need it later.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={deleteCourse} disabled={deleting} className="flex-1 px-4 py-3 rounded-xl font-medium text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" onClick={() => setDeleteCategoryTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-serif text-xl text-charcoal mb-2">Delete course?</h3>
            <p className="text-sm text-charcoal/60 mb-1">
              <span className="font-medium text-charcoal">&ldquo;{deleteCategoryTarget.name}&rdquo;</span> and all its categories will be permanently deleted.
            </p>
            <p className="text-sm text-charcoal/40 mb-6">
              This cannot be undone. Consider archiving instead.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteCategoryTarget(null)} className="btn-outline flex-1">Cancel</button>
              <button onClick={deleteCategory} disabled={deleting} className="flex-1 px-4 py-3 rounded-xl font-medium text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CourseRow({
  item,
  isDragging,
  isDragOver,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  item: Category
  isDragging: boolean
  isDragOver: boolean
  onEdit: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
}) {
  return (
    <div
      className={`flex items-center gap-0 transition-all ${isDragging ? 'opacity-40 scale-[0.97]' : ''} ${isDragOver && !isDragging ? 'bg-gold/5 border-l-2 border-gold' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="pl-3 pr-1 py-3.5 cursor-grab active:cursor-grabbing text-charcoal/15 hover:text-charcoal/30">
        <GripVertical size={14} />
      </div>
      <div className="flex-1 min-w-0 py-3.5 pr-2">
        <p className="text-[14px] font-medium text-charcoal leading-snug">{item.title}</p>
        {item.description && (
          <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-1">{item.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 pr-5">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-gold hover:bg-gold/10 transition-all"
          title="Edit category"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Delete category"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
