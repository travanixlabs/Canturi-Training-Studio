'use client'

import { useState, useTransition } from 'react'
import { X, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Course, MenuItem, MenuItemStatus, TrainerType, DifficultyLevel } from '@/types'

interface Props {
  categories: Course[]
  menuItems: MenuItem[]
}

const TRAINER_TYPES: TrainerType[] = ['Self', 'Manager', 'Self/Manager']
const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: 'introductory', label: 'Introductory' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const STATUS_CONFIG: Record<MenuItemStatus, { label: string; dot: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-green-500', text: 'text-green-700' },
  hidden: { label: 'Hidden', dot: 'bg-charcoal/30', text: 'text-charcoal/40' },
}

interface CourseFormData {
  title: string
  description: string
  course_id: string
  tags: string
  time_needed: string
  trainer_type: TrainerType
  difficulty_level: DifficultyLevel | ''
  is_recurring: boolean
  recurring_amount: number
  resource_link: string
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
  tags: '',
  time_needed: '',
  trainer_type: '' as TrainerType,
  difficulty_level: '',
  is_recurring: false,
  recurring_amount: 1,
  resource_link: '',
})

const emptyCategoryForm = (): CategoryFormData => ({
  name: '',
  icon: '',
  colour_hex: '#C9A96E',
  sort_order: '',
})

export function CourseEditor({ categories: initialCategories, menuItems: initialItems }: Props) {
  const [categories, setCategories] = useState<Course[]>(initialCategories)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialItems)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Course modal
  const [courseModal, setCourseModal] = useState<{ mode: 'add'; categoryId: string } | { mode: 'edit'; item: MenuItem } | null>(null)
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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<Course | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Status change pending
  const [statusChanging, setStatusChanging] = useState<string | null>(null)

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

  function openEditCourse(item: MenuItem) {
    setCourseForm({
      title: item.title,
      description: item.description,
      course_id: item.course_id,
      tags: (item.tags ?? []).join(', '),
      time_needed: item.time_needed,
      trainer_type: item.trainer_type,
      difficulty_level: item.difficulty_level ?? '',
      is_recurring: item.is_recurring ?? false,
      recurring_amount: (item as any).recurring_amount ?? 1,
      resource_link: item.resource_link ?? '',
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
    if (!courseForm.tags.trim()) { setCourseError('Tags are required.'); return }
    if (!courseForm.trainer_type) { setCourseError('Trainer type is required.'); return }
    if (!courseForm.difficulty_level) { setCourseError('Difficulty level is required.'); return }
    if (courseForm.is_recurring && (!courseForm.recurring_amount || courseForm.recurring_amount < 1)) { setCourseError('Training Tasks Count is required when recurring is enabled.'); return }

    setCourseSaving(true)
    setCourseError(null)

    const payload = {
      title: courseForm.title.trim(),
      description: courseForm.description.trim(),
      course_id: courseForm.course_id,
      tags: courseForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      time_needed: courseForm.time_needed.trim(),
      trainer_type: courseForm.trainer_type,
      difficulty_level: courseForm.difficulty_level || null,
      is_recurring: courseForm.is_recurring,
      recurring_amount: courseForm.is_recurring ? courseForm.recurring_amount : null,
      resource_link: courseForm.resource_link.trim() || null,
    }

    if (courseModal?.mode === 'add') {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ ...payload, status: 'active' })
        .select('*, course:courses(*)')
        .single()

      if (error) {
        setCourseError('Failed to create category. ' + error.message)
        setCourseSaving(false)
        return
      }

      setMenuItems(prev => [...prev, data as MenuItem])
    } else if (courseModal?.mode === 'edit') {
      const { data, error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', courseModal.item.id)
        .select('*, course:courses(*)')
        .single()

      if (error) {
        setCourseError('Failed to update category. ' + error.message)
        setCourseSaving(false)
        return
      }

      setMenuItems(prev => prev.map(i => (i.id === courseModal.item.id ? (data as MenuItem) : i)))
    }

    setCourseSaving(false)
    closeCourseModal()
    startTransition(() => router.refresh())
  }

  async function deleteCourse() {
    if (!deleteTarget) return
    setDeleting(true)

    const { error } = await supabase.from('menu_items').delete().eq('id', deleteTarget.id)
    if (error) {
      setDeleting(false)
      return
    }

    setMenuItems(prev => prev.filter(i => i.id !== deleteTarget.id))
    setDeleteTarget(null)
    setDeleting(false)
    startTransition(() => router.refresh())
  }

  async function changeStatus(item: MenuItem, status: MenuItemStatus) {
    setStatusChanging(item.id)

    const { error } = await supabase
      .from('menu_items')
      .update({ status })
      .eq('id', item.id)

    if (error) {
      alert('Failed to update status: ' + error.message)
    } else {
      setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, status } : i)))
    }

    setStatusChanging(null)
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

      setCategories(prev => prev.map(c => c.id === categoryModal.course.id ? { ...c, name: categoryForm.name.trim(), icon: categoryForm.icon.trim(), colour_hex: categoryForm.colour_hex } : c))
    } else {
      const { data, error } = await supabase.from('courses').insert({
        name: categoryForm.name.trim(),
        icon: categoryForm.icon.trim(),
        colour_hex: categoryForm.colour_hex,
        sort_order: categories.length + 1,
      }).select().single()

      if (error) {
        setCategoryError('Failed to create course. ' + error.message)
        setCategorySaving(false)
        return
      }

      setCategories(prev => [...prev, data as Course].sort((a, b) => a.sort_order - b.sort_order))
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

    const fromIdx = categories.findIndex(c => c.id === draggedCategoryId)
    const toIdx = categories.findIndex(c => c.id === targetCategoryId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...categories]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const updated = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }))
    setCategories(updated)
    setDraggedCategoryId(null)

    await Promise.all(
      updated.map(c => supabase.from('courses').update({ sort_order: c.sort_order }).eq('id', c.id))
    )
  }

  async function changeCategoryStatus(cat: Course, status: MenuItemStatus) {
    const { error } = await supabase.from('courses').update({ status }).eq('id', cat.id)
    if (error) {
      alert('Failed to update course: ' + error.message)
      return
    }
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, status } : c))

    const catItems = menuItems.filter(i => i.course_id === cat.id)
    for (const item of catItems) {
      await supabase.from('menu_items').update({ status }).eq('id', item.id)
    }
    setMenuItems(prev => prev.map(i => i.course_id === cat.id ? { ...i, status } : i))
  }

  async function deleteCategory() {
    if (!deleteCategoryTarget) return
    setDeleting(true)

    // Delete all categories in this course first
    await supabase.from('menu_items').delete().eq('course_id', deleteCategoryTarget.id)
    await supabase.from('courses').delete().eq('id', deleteCategoryTarget.id)

    setMenuItems(prev => prev.filter(i => i.course_id !== deleteCategoryTarget.id))
    setCategories(prev => prev.filter(c => c.id !== deleteCategoryTarget.id))
    setDeleting(false)
    setDeleteCategoryTarget(null)
    startTransition(() => router.refresh())
  }

  const itemsByCategory = (categoryId: string) =>
    menuItems.filter(i => i.course_id === categoryId)

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Categories</h1>
          <p className="text-sm text-charcoal/40 mt-1">{menuItems.length} categories across {categories.length} courses</p>
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
        {categories.map(category => {
          const items = itemsByCategory(category.id)
          const expanded = expandedCategories.has(category.id)

          return (
            <div
              key={category.id}
              className={`card overflow-hidden transition-all ${draggedCategoryId === category.id ? 'opacity-50 scale-[0.98]' : ''} ${category.status === 'hidden' ? 'opacity-50' : ''}`}
              draggable
              onDragStart={() => setDraggedCategoryId(category.id)}
              onDragEnd={() => setDraggedCategoryId(null)}
              onDragOver={e => e.preventDefault()}
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
                  onClick={() => changeCategoryStatus(category, category.status === 'hidden' ? 'active' : 'hidden')}
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
                        statusChanging={statusChanging === item.id}
                        onEdit={() => router.push(`/head-office/courses/${item.id}`)}
                        onDelete={() => setDeleteTarget(item)}
                        onChangeStatus={(status) => changeStatus(item, status)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {categories.length === 0 && (
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
                  className="input"
                  value={courseForm.course_id}
                  onChange={e => setCourseForm(f => ({ ...f, course_id: e.target.value }))}
                >
                  <option value="">Select a course…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Tags <span className="text-red-400">*</span> <span className="text-charcoal/30 normal-case font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={courseForm.tags}
                  onChange={e => setCourseForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. diamonds, consultation, sales"
                />
              </div>

              {/* Time needed */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Time needed
                </label>
                <input
                  type="text"
                  className="input"
                  value={courseForm.time_needed}
                  onChange={e => setCourseForm(f => ({ ...f, time_needed: e.target.value }))}
                  placeholder="e.g. 30 min, 1 hour"
                />
              </div>

              {/* Trainer type */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Trainer type <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  {TRAINER_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCourseForm(f => ({ ...f, trainer_type: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        courseForm.trainer_type === t
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-charcoal/15 text-charcoal/50 hover:border-charcoal/30'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty level */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Difficulty level <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  {DIFFICULTY_LEVELS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        setCourseForm(f => ({
                          ...f,
                          difficulty_level: p.value,
                        }))
                      }
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        courseForm.difficulty_level === p.value
                          ? 'border-gold bg-gold/10 text-gold'
                          : 'border-charcoal/15 text-charcoal/50 hover:border-charcoal/30'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Is recurring */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={courseForm.is_recurring}
                    onClick={() => setCourseForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                      courseForm.is_recurring ? 'bg-gold' : 'bg-charcoal/15'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        courseForm.is_recurring ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-charcoal/70">Training Tasks</span>
                </div>

                {/* Training Tasks Count */}
                <div className={`${courseForm.is_recurring ? '' : 'opacity-30 pointer-events-none'}`}>
                  <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                    Training Tasks Count {courseForm.is_recurring && <span className="text-red-400">*</span>}
                  </label>
                  <select
                    className="input w-24"
                    value={courseForm.recurring_amount}
                    onChange={e => setCourseForm(f => ({ ...f, recurring_amount: Number(e.target.value) }))}
                    disabled={!courseForm.is_recurring}
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <p className="text-xs text-charcoal/30 mt-1">Number of training tasks to complete</p>
                </div>
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
  statusChanging,
  onEdit,
  onDelete,
  onChangeStatus,
}: {
  item: MenuItem
  statusChanging: boolean
  onEdit: () => void
  onDelete: () => void
  onChangeStatus: (status: MenuItemStatus) => void
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusCfg = STATUS_CONFIG[item.status ?? 'active']

  return (
    <div className={`px-5 py-3.5 flex items-start gap-3 ${''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-medium text-charcoal leading-snug">{item.title}</p>
          {/* Status badge */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(s => !s)}
              disabled={statusChanging}
              className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border border-transparent hover:border-charcoal/10 transition-all ${statusCfg.text}`}
              title="Change status"
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
              {statusChanging ? '…' : statusCfg.label}
            </button>

            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white border border-charcoal/10 rounded-xl shadow-lg z-20 py-1 min-w-[130px]">
                  {(Object.keys(STATUS_CONFIG) as MenuItemStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        onChangeStatus(s)
                        setShowStatusMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-charcoal/5 transition-colors ${
                        s === (item.status ?? 'active') ? 'font-medium' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_CONFIG[s].dot}`} />
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {item.description && (
          <p className="text-xs text-charcoal/40 mt-0.5 line-clamp-1">{item.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {item.time_needed && (
            <span className="text-xs text-charcoal/30">{item.time_needed}</span>
          )}
          {item.trainer_type && (
            <span className="text-xs text-charcoal/30">· {item.trainer_type}</span>
          )}
          {item.difficulty_level && (
            <span className="text-xs text-charcoal/30">
              · {DIFFICULTY_LEVELS.find(p => p.value === item.difficulty_level)?.label ?? item.difficulty_level}
            </span>
          )}
          {item.is_recurring && (
            <span className="text-xs text-charcoal/30">· Training Task</span>
          )}
          {(item.tags ?? []).map(tag => (
            <span key={tag} className="text-xs text-charcoal/25 bg-charcoal/5 px-1.5 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-gold hover:bg-gold/10 transition-all"
          title="Edit category"
        >
          <Pencil size={14} />
        </button>
        {(item.status ?? 'active') === 'hidden' ? (
          <button
            onClick={() => onChangeStatus('active')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-green-600 hover:bg-green-50 transition-all"
            title="Show category"
          >
            <Eye size={14} />
          </button>
        ) : (
          <button
            onClick={() => onChangeStatus('hidden')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-charcoal/60 hover:bg-charcoal/5 transition-all"
            title="Hide category"
          >
            <EyeOff size={14} />
          </button>
        )}
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
