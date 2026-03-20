'use client'

import { useState, useTransition } from 'react'
import { X, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Archive, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Category, MenuItem, MenuItemStatus, TrainerType, PriorityLevel } from '@/types'

interface Props {
  categories: Category[]
  menuItems: MenuItem[]
}

const TRAINER_TYPES: TrainerType[] = ['Self', 'Manager', 'Self/Manager']
const PRIORITY_LEVELS: { value: PriorityLevel; label: string }[] = [
  { value: 'week_1', label: 'Week 1' },
  { value: 'week_2_4', label: 'Weeks 2–4' },
  { value: 'advanced', label: 'Advanced' },
]

const STATUS_CONFIG: Record<MenuItemStatus, { label: string; dot: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-green-500', text: 'text-green-700' },
  hidden: { label: 'Hidden', dot: 'bg-charcoal/30', text: 'text-charcoal/40' },
  archived: { label: 'Archived', dot: 'bg-amber-400', text: 'text-amber-700' },
}

interface CourseFormData {
  title: string
  description: string
  category_id: string
  tags: string
  time_needed: string
  trainer_type: TrainerType
  priority_level: PriorityLevel | ''
  is_recurring: boolean
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
  category_id: '',
  tags: '',
  time_needed: '',
  trainer_type: 'Self',
  priority_level: '',
  is_recurring: false,
  resource_link: '',
})

const emptyCategoryForm = (): CategoryFormData => ({
  name: '',
  icon: '',
  colour_hex: '#C9A96E',
  sort_order: '',
})

export function CourseEditor({ categories: initialCategories, menuItems: initialItems }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialItems)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Course modal
  const [courseModal, setCourseModal] = useState<{ mode: 'add'; categoryId: string } | { mode: 'edit'; item: MenuItem } | null>(null)
  const [courseForm, setCourseForm] = useState<CourseFormData>(emptyCourseForm())
  const [courseError, setCourseError] = useState<string | null>(null)
  const [courseSaving, setCourseSaving] = useState(false)

  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategoryForm())
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [categorySaving, setCategorySaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)
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
    setCourseForm({ ...emptyCourseForm(), category_id: categoryId })
    setCourseError(null)
    setCourseModal({ mode: 'add', categoryId })
  }

  function openEditCourse(item: MenuItem) {
    setCourseForm({
      title: item.title,
      description: item.description,
      category_id: item.category_id,
      tags: (item.tags ?? []).join(', '),
      time_needed: item.time_needed,
      trainer_type: item.trainer_type,
      priority_level: item.priority_level ?? '',
      is_recurring: item.is_recurring ?? false,
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
    if (!courseForm.title.trim()) {
      setCourseError('Title is required.')
      return
    }
    if (!courseForm.category_id) {
      setCourseError('Category is required.')
      return
    }

    setCourseSaving(true)
    setCourseError(null)

    const payload = {
      title: courseForm.title.trim(),
      description: courseForm.description.trim(),
      category_id: courseForm.category_id,
      tags: courseForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean),
      time_needed: courseForm.time_needed.trim(),
      trainer_type: courseForm.trainer_type,
      priority_level: courseForm.priority_level || null,
      is_recurring: courseForm.is_recurring,
      resource_link: courseForm.resource_link.trim() || null,
    }

    if (courseModal?.mode === 'add') {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({ ...payload, status: 'active' })
        .select('*, category:categories(*)')
        .single()

      if (error) {
        setCourseError('Failed to create course. ' + error.message)
        setCourseSaving(false)
        return
      }

      setMenuItems(prev => [...prev, data as MenuItem])
    } else if (courseModal?.mode === 'edit') {
      const { data, error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', courseModal.item.id)
        .select('*, category:categories(*)')
        .single()

      if (error) {
        setCourseError('Failed to update course. ' + error.message)
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

    if (!error) {
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

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: categoryForm.name.trim(),
        icon: categoryForm.icon.trim(),
        colour_hex: categoryForm.colour_hex,
        sort_order: categoryForm.sort_order ? parseInt(categoryForm.sort_order, 10) : categories.length + 1,
      })
      .select()
      .single()

    if (error) {
      setCategoryError('Failed to create category. ' + error.message)
      setCategorySaving(false)
      return
    }

    setCategories(prev => [...prev, data as Category].sort((a, b) => a.sort_order - b.sort_order))
    setCategorySaving(false)
    setShowCategoryModal(false)
    setCategoryForm(emptyCategoryForm())
    startTransition(() => router.refresh())
  }

  const itemsByCategory = (categoryId: string) =>
    menuItems.filter(i => i.category_id === categoryId)

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Courses</h1>
          <p className="text-sm text-charcoal/40 mt-1">{menuItems.length} courses across {categories.length} categories</p>
        </div>
        <button
          onClick={() => {
            setCategoryForm(emptyCategoryForm())
            setCategoryError(null)
            setShowCategoryModal(true)
          }}
          className="btn-outline flex items-center gap-2 text-sm"
        >
          <Plus size={15} />
          Add category
        </button>
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {categories.map(category => {
          const items = itemsByCategory(category.id)
          const expanded = expandedCategories.has(category.id)

          return (
            <div key={category.id} className="card overflow-hidden">
              {/* Category header */}
              <div className="flex items-center">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex-1 px-5 py-4 flex items-center gap-3 text-left"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                  >
                    {category.icon}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-charcoal text-[15px]">{category.name}</p>
                    <p className="text-xs text-charcoal/35 mt-0.5">{items.length} course{items.length !== 1 ? 's' : ''}</p>
                  </div>
                  {expanded ? (
                    <ChevronUp size={16} className="text-charcoal/30" />
                  ) : (
                    <ChevronDown size={16} className="text-charcoal/30" />
                  )}
                </button>

                <button
                  onClick={() => openAddCourse(category.id)}
                  className="mr-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-charcoal/50 hover:text-gold border border-charcoal/10 hover:border-gold transition-all"
                >
                  <Plus size={13} />
                  Add course
                </button>
              </div>

              {/* Expanded course list */}
              {expanded && (
                <div className="border-t border-black/5 divide-y divide-black/5">
                  {items.length === 0 ? (
                    <div className="px-5 py-5 text-center">
                      <p className="text-sm text-charcoal/30">No courses yet.</p>
                      <button
                        onClick={() => openAddCourse(category.id)}
                        className="mt-2 text-sm text-gold hover:text-gold/70 transition-colors"
                      >
                        Add the first course
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
            <p className="text-charcoal/40 text-sm">No categories yet. Add a category to get started.</p>
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
                  Description
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={courseForm.description}
                  onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What will the trainee learn or practise?"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Category <span className="text-red-400">*</span>
                </label>
                <select
                  className="input"
                  value={courseForm.category_id}
                  onChange={e => setCourseForm(f => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Select a category…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Tags <span className="text-charcoal/30 normal-case font-normal">(comma-separated)</span>
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
                  Trainer type
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

              {/* Priority level */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Priority level
                </label>
                <div className="flex gap-2">
                  {PRIORITY_LEVELS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() =>
                        setCourseForm(f => ({
                          ...f,
                          priority_level: f.priority_level === p.value ? '' : p.value,
                        }))
                      }
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                        courseForm.priority_level === p.value
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
              <div className="flex items-center gap-3">
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
                <span className="text-sm text-charcoal/70">Recurring course</span>
              </div>

              {/* Resource link */}
              <div>
                <label className="block text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-1.5">
                  Resource link <span className="text-charcoal/30 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  className="input"
                  value={courseForm.resource_link}
                  onChange={e => setCourseForm(f => ({ ...f, resource_link: e.target.value }))}
                  placeholder="https://…"
                />
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
                  {courseSaving ? 'Saving…' : courseModal.mode === 'add' ? 'Add course' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category form modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
            onClick={() => setShowCategoryModal(false)}
          />
          <div className="relative bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="font-serif text-xl text-charcoal">Add Category</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
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
                  {['✦', '◈', '⌂', '◎', '◇', '▽', '❋', '★', '♦', '⚡', '🔧', '💎', '📦', '🎓', '👥', '🏪', '📋', '🎯', '💡', '🔑', '🛡️', '📐', '🎨', '✨'].map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setCategoryForm(f => ({ ...f, icon }))}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
                        categoryForm.icon === icon
                          ? 'bg-gold/10 border-2 border-gold text-charcoal'
                          : 'bg-charcoal/3 border-2 border-transparent text-charcoal/60 hover:border-charcoal/15'
                      }`}
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
                  onClick={() => setShowCategoryModal(false)}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCategory}
                  disabled={categorySaving}
                  className="btn-gold flex-1"
                >
                  {categorySaving ? 'Saving…' : 'Add category'}
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
            <h3 className="font-serif text-xl text-charcoal mb-2">Delete course?</h3>
            <p className="text-sm text-charcoal/60 mb-1">
              <span className="font-medium text-charcoal">&ldquo;{deleteTarget.title}&rdquo;</span> will be permanently deleted.
            </p>
            <p className="text-sm text-charcoal/40 mb-6">
              This cannot be undone. Consider archiving instead if you may need it later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={deleteCourse}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
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
    <div className={`px-5 py-3.5 flex items-start gap-3 ${item.status === 'archived' ? 'opacity-50' : ''}`}>
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
          {item.priority_level && (
            <span className="text-xs text-charcoal/30">
              · {PRIORITY_LEVELS.find(p => p.value === item.priority_level)?.label ?? item.priority_level}
            </span>
          )}
          {item.is_recurring && (
            <span className="text-xs text-charcoal/30">· Recurring</span>
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
          title="Edit course"
        >
          <Pencil size={14} />
        </button>
        {(item.status ?? 'active') !== 'hidden' && (
          <button
            onClick={() => onChangeStatus('hidden')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-charcoal/60 hover:bg-charcoal/5 transition-all"
            title="Hide course"
          >
            <EyeOff size={14} />
          </button>
        )}
        {(item.status ?? 'active') !== 'archived' && (
          <button
            onClick={() => onChangeStatus('archived')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-amber-500 hover:bg-amber-50 transition-all"
            title="Archive course"
          >
            <Archive size={14} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Delete course"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
