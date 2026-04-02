'use client'

import { useState, useMemo } from 'react'
import { Pencil, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import type { Course, Category, Subcategory, TrainingTask, TrainerType, Modality, RoleLevel, PriorityLevel } from '@/types'

const TRAINER_TYPES: TrainerType[] = ['Self Directed', 'Senior', 'Manager']
const MODALITIES: Modality[] = ['Website Reference', 'Online Tool', 'Role Play', 'Shadowing', 'SOP', 'Video', 'Coaching Session', 'Self Directed Task', 'External Education', 'Zoom Session', 'Upskill Friday', 'Workshop']
const ROLE_LEVELS: RoleLevel[] = ['Consultant', 'Specialist', 'Senior Specialist']
const PRIORITY_LEVELS: PriorityLevel[] = ['Essential', 'Core', 'Advanced']

interface Props {
  courses: Course[]
  categories: Category[]
  subcategories: Subcategory[]
  trainingTasks: TrainingTask[]
}

export function TrainingTasksTable({ courses, categories, subcategories, trainingTasks: initialTasks }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({})
  const [filterMenu, setFilterMenu] = useState<{ col: string; x: number; y: number } | null>(null)

  // Build lookup maps
  const courseMap = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses])
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const subcategoryMap = useMemo(() => new Map(subcategories.map(s => [s.id, s])), [subcategories])

  function getHierarchy(task: TrainingTask) {
    const sub = subcategoryMap.get(task.subcategory_id)
    const cat = sub ? categoryMap.get(sub.category_id) : null
    const course = cat ? courseMap.get(cat.course_id) : null
    return { course, category: cat, subcategory: sub }
  }

  function getSortValue(task: TrainingTask, col: string): string {
    const { course, category, subcategory } = getHierarchy(task)
    switch (col) {
      case 'Course': return course?.name ?? ''
      case 'Category': return category?.title ?? ''
      case 'Subcategory': return subcategory?.title ?? ''
      case 'Training Task': return task.title
      case 'Prerequisites': return (task.prerequisites ?? []).length.toString()
      case 'Tags': return (task.tags ?? []).join(', ')
      case 'Trainer Type': return task.trainer_type
      case 'Modality': return task.modality
      case 'Role Level': return task.role_level
      case 'Priority Level': return task.priority_level
      case 'Recurring': return task.is_recurring ? 'Yes' : 'No'
      case 'Certificate': return task.certificate_required ? 'Yes' : 'No'
      case 'Rewards': return task.rewards_eligible ? 'Yes' : 'No'
      case 'Competence Rating': return task.confidence_rating_required ? 'Yes' : 'No'
      default: return ''
    }
  }

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const FILTERABLE_COLS = new Set(['Course', 'Category', 'Subcategory', 'Trainer Type', 'Modality', 'Role Level', 'Priority Level', 'Recurring', 'Certificate', 'Rewards', 'Competence Rating'])

  // Get unique values for a column
  function getUniqueValues(col: string): string[] {
    const vals = new Set<string>()
    for (const t of tasks) {
      const v = getSortValue(t, col)
      if (v) vals.add(v)
    }
    return [...vals].sort()
  }

  function toggleColumnFilter(col: string, value: string) {
    setColumnFilters(prev => {
      const next = { ...prev }
      if (!next[col]) next[col] = new Set()
      const s = new Set(next[col])
      if (s.has(value)) s.delete(value)
      else s.add(value)
      if (s.size === 0) delete next[col]
      else next[col] = s
      return next
    })
  }

  function clearColumnFilter(col: string) {
    setColumnFilters(prev => {
      const next = { ...prev }
      delete next[col]
      return next
    })
  }

  // Filter and sort
  const filteredTasks = useMemo(() => {
    let result = tasks
    const q = search.toLowerCase().trim()
    if (q) {
      result = result.filter(t => {
        const { course, category, subcategory } = getHierarchy(t)
        return [t.title, course?.name, category?.title, subcategory?.title, t.trainer_type, t.modality, ...(t.tags ?? [])].some(s => s && s.toLowerCase().includes(q))
      })
    }
    // Apply column filters
    for (const [col, values] of Object.entries(columnFilters)) {
      if (values.size > 0) {
        result = result.filter(t => values.has(getSortValue(t, col)))
      }
    }
    if (sortCol) {
      result = [...result].sort((a, b) => {
        const va = getSortValue(a, sortCol).toLowerCase()
        const vb = getSortValue(b, sortCol).toLowerCase()
        const cmp = va.localeCompare(vb)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [tasks, search, sortCol, sortDir, columnFilters])

  async function updateTask(id: string, updates: Partial<TrainingTask>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    await supabase.from('training_tasks').update(updates).eq('id', id)
  }

  return (
    <div className="px-5 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Training Tasks</h1>
          <p className="text-sm text-charcoal/40 mt-1">{filteredTasks.length} of {tasks.length} tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const rows = filteredTasks.map(task => {
                const { course, category, subcategory } = getHierarchy(task)
                return {
                  'Course': course?.name ?? '',
                  'Category': category?.title ?? '',
                  'Subcategory': subcategory?.title ?? '',
                  'Training Task': task.title,
                  'Prerequisites': (task.prerequisites ?? []).map(pid => tasks.find(t => t.id === pid)?.title ?? pid).join(', '),
                  'Tags': (task.tags ?? []).join(', '),
                  'Trainer Type': task.trainer_type,
                  'Modality': task.modality,
                  'Role Level': task.role_level,
                  'Priority Level': task.priority_level,
                  'Recurring': task.is_recurring ? `Yes (${task.recurring_count})` : 'No',
                  'Certificate Required': task.certificate_required ? 'Yes' : 'No',
                  'Rewards Eligible': task.rewards_eligible ? 'Yes' : 'No',
                  'Competence Rating Required': task.confidence_rating_required ? 'Yes' : 'No',
                }
              })
              const ws = XLSX.utils.json_to_sheet(rows)
              const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Training Tasks')
              XLSX.writeFile(wb, 'Training Tasks.xlsx')
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-charcoal/50 border border-charcoal/15 hover:border-gold hover:text-gold transition-all"
          >
            <Download size={14} />
            Export
          </button>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="input py-2 px-4 text-sm w-64"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-black/5">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-charcoal/[0.02]">
              {['Course', 'Category', 'Subcategory', 'Training Task', 'Prerequisites', 'Tags', 'Trainer Type', 'Modality', 'Role Level', 'Priority Level', 'Recurring', 'Certificate', 'Rewards', 'Competence Rating'].map(h => (
                <th
                  key={h}
                  onClick={() => toggleSort(h)}
                  onContextMenu={(e) => {
                    if (FILTERABLE_COLS.has(h)) {
                      e.preventDefault()
                      setFilterMenu({ col: h, x: e.clientX, y: e.clientY })
                    }
                  }}
                  className={`px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap border-b border-black/5 cursor-pointer hover:text-charcoal/60 select-none ${
                    columnFilters[h] ? 'text-gold' : 'text-charcoal/40'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {h}
                    {sortCol === h && (
                      <span className="text-gold">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                    {columnFilters[h] && <span className="text-gold text-[8px]">●</span>}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-[10px] font-medium text-charcoal/40 uppercase tracking-wider whitespace-nowrap border-b border-black/5"></th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => {
              const { course, category, subcategory } = getHierarchy(task)
              return (
                <tr key={task.id} className="border-b border-black/5 hover:bg-charcoal/[0.01] transition-colors">
                  {/* Course - non-editable */}
                  <td className="px-3 py-2 text-xs text-charcoal/50 whitespace-nowrap">{course?.name ?? '—'}</td>

                  {/* Category - non-editable */}
                  <td className="px-3 py-2 text-xs text-charcoal/50 whitespace-nowrap">{category?.title ?? '—'}</td>

                  {/* Subcategory - non-editable */}
                  <td className="px-3 py-2 text-xs text-charcoal/50 whitespace-nowrap">{subcategory?.title ?? '—'}</td>

                  {/* Training Task */}
                  <td className="px-3 py-2">
                    <input
                      className="text-xs text-charcoal bg-transparent border-b border-transparent hover:border-charcoal/15 focus:border-gold focus:outline-none py-0.5 w-full min-w-[150px]"
                      value={task.title}
                      onChange={e => updateTask(task.id, { title: e.target.value })}
                    />
                  </td>

                  {/* Prerequisites */}
                  <td className="px-3 py-2 text-xs text-charcoal/40 whitespace-nowrap">
                    {(task.prerequisites ?? []).length > 0
                      ? (task.prerequisites ?? []).map(pid => tasks.find(t => t.id === pid)?.title ?? pid).join(', ')
                      : '—'}
                  </td>

                  {/* Tags */}
                  <td className="px-3 py-2">
                    <input
                      className="text-xs text-charcoal bg-transparent border-b border-transparent hover:border-charcoal/15 focus:border-gold focus:outline-none py-0.5 w-full min-w-[100px]"
                      value={(task.tags ?? []).join(', ')}
                      onBlur={e => {
                        const parsed = e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        updateTask(task.id, { tags: parsed })
                      }}
                      onChange={e => {
                        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, tags: e.target.value.split(',').map(s => s.trim()) } : t))
                      }}
                    />
                  </td>

                  {/* Trainer Type */}
                  <td className="px-3 py-2">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.trainer_type} onChange={e => updateTask(task.id, { trainer_type: e.target.value as TrainerType })}>
                      <option value="">—</option>
                      {TRAINER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>

                  {/* Modality */}
                  <td className="px-3 py-2">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.modality} onChange={e => updateTask(task.id, { modality: e.target.value as Modality })}>
                      <option value="">—</option>
                      {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>

                  {/* Role Level */}
                  <td className="px-3 py-2">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.role_level} onChange={e => updateTask(task.id, { role_level: e.target.value as RoleLevel })}>
                      <option value="">—</option>
                      {ROLE_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>

                  {/* Priority Level */}
                  <td className="px-3 py-2">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.priority_level} onChange={e => updateTask(task.id, { priority_level: e.target.value as PriorityLevel })}>
                      <option value="">—</option>
                      {PRIORITY_LEVELS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>

                  {/* Recurring */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center gap-1.5">
                      <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.is_recurring ? 'Yes' : 'No'} onChange={e => {
                        const isYes = e.target.value === 'Yes'
                        updateTask(task.id, { is_recurring: isYes, recurring_count: isYes ? (task.recurring_count ?? 10) : null })
                      }}>
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                      {task.is_recurring && (
                        <input
                          type="number"
                          min="2"
                          className="text-xs bg-transparent border-b border-charcoal/10 focus:border-gold focus:outline-none w-10 text-center"
                          value={task.recurring_count ?? ''}
                          onChange={e => updateTask(task.id, { recurring_count: parseInt(e.target.value) || null })}
                        />
                      )}
                    </div>
                  </td>

                  {/* Certificate Required */}
                  <td className="px-3 py-2 text-center">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.certificate_required ? 'Yes' : 'No'} onChange={e => updateTask(task.id, { certificate_required: e.target.value === 'Yes' })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* Rewards Eligible */}
                  <td className="px-3 py-2 text-center">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.rewards_eligible ? 'Yes' : 'No'} onChange={e => updateTask(task.id, { rewards_eligible: e.target.value === 'Yes' })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* Competence Rating Required */}
                  <td className="px-3 py-2 text-center">
                    <select className="text-xs bg-transparent focus:outline-none cursor-pointer" value={task.confidence_rating_required ? 'Yes' : 'No'} onChange={e => updateTask(task.id, { confidence_rating_required: e.target.value === 'Yes' })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </td>

                  {/* Edit */}
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => {
                        const catId = category?.id
                        if (catId) router.push(`/head-office/courses/${catId}`)
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-gold hover:bg-gold/10 transition-all"
                      title="Edit in category view"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Right-click filter menu */}
      {filterMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setFilterMenu(null)} onContextMenu={e => { e.preventDefault(); setFilterMenu(null) }} />
          <div
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-black/5 p-3 w-56 max-h-[300px] overflow-y-auto"
            style={{ left: filterMenu.x, top: filterMenu.y }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-charcoal/40 uppercase tracking-wider">Filter: {filterMenu.col}</p>
              {columnFilters[filterMenu.col] && (
                <button onClick={() => { clearColumnFilter(filterMenu.col); setFilterMenu(null) }} className="text-[10px] text-red-400 hover:text-red-600">Clear</button>
              )}
            </div>
            <div className="space-y-0.5">
              {getUniqueValues(filterMenu.col).map(val => {
                const isChecked = columnFilters[filterMenu.col]?.has(val) ?? false
                return (
                  <button
                    key={val}
                    onClick={() => toggleColumnFilter(filterMenu.col, val)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs transition-all ${
                      isChecked ? 'bg-gold/10 text-gold' : 'text-charcoal/60 hover:bg-charcoal/3'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] flex-shrink-0 ${
                      isChecked ? 'bg-gold border-gold text-white' : 'border-charcoal/20'
                    }`}>
                      {isChecked && '✓'}
                    </span>
                    {val || '(empty)'}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
