'use client'

import { useState, useMemo } from 'react'
import { ArrowLeft, Search, X, ChevronDown, ChevronUp, Check, Plus } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Workshop, Category, MenuItem, WorkshopMenuItem } from '@/types'

interface Props {
  workshop: Workshop
  categories: Category[]
  menuItems: MenuItem[]
  workshopMenuItems: WorkshopMenuItem[]
}

export function WorkshopEditor({ workshop: initialWorkshop, categories, menuItems, workshopMenuItems: initialWMI }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [workshop, setWorkshop] = useState(initialWorkshop)
  const [name, setName] = useState(initialWorkshop.name)
  const [tags, setTags] = useState(initialWorkshop.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [assignedIds, setAssignedIds] = useState<Set<string>>(
    new Set(initialWMI.map(wmi => wmi.menu_item_id))
  )
  const [toggling, setToggling] = useState<string | null>(null)
  const [togglingAll, setTogglingAll] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const filteredItems = useMemo(() => {
    if (!search.trim()) return menuItems
    const q = search.toLowerCase()
    return menuItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [menuItems, search])

  const assignedCount = assignedIds.size

  async function handleSaveDetails() {
    setSaving(true)
    const { error } = await supabase.from('workshops').update({
      name: name.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }).eq('id', workshop.id)

    if (!error) {
      setWorkshop(prev => ({ ...prev, name: name.trim(), tags: tags.split(',').map(t => t.trim()).filter(Boolean) }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function toggleCourse(itemId: string) {
    setToggling(itemId)
    const isAssigned = assignedIds.has(itemId)

    if (isAssigned) {
      const { error } = await supabase
        .from('workshop_menu_items')
        .delete()
        .eq('workshop_id', workshop.id)
        .eq('menu_item_id', itemId)
      if (!error) {
        setAssignedIds(prev => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    } else {
      const { error } = await supabase
        .from('workshop_menu_items')
        .insert({ workshop_id: workshop.id, menu_item_id: itemId })
      if (!error) {
        setAssignedIds(prev => new Set(prev).add(itemId))
      }
    }
    setToggling(null)
  }

  async function toggleAllInCategory(categoryId: string) {
    const items = menuItems.filter(i => i.category_id === categoryId)
    const allAssigned = items.every(i => assignedIds.has(i.id))
    setTogglingAll(categoryId)

    if (allAssigned) {
      // Deselect all
      const itemIds = items.map(i => i.id)
      const { error } = await supabase
        .from('workshop_menu_items')
        .delete()
        .eq('workshop_id', workshop.id)
        .in('menu_item_id', itemIds)
      if (!error) {
        setAssignedIds(prev => {
          const next = new Set(prev)
          for (const id of itemIds) next.delete(id)
          return next
        })
      }
    } else {
      // Select all unassigned
      const toAdd = items.filter(i => !assignedIds.has(i.id)).map(i => ({
        workshop_id: workshop.id,
        menu_item_id: i.id,
      }))
      if (toAdd.length > 0) {
        const { error } = await supabase
          .from('workshop_menu_items')
          .insert(toAdd)
        if (!error) {
          setAssignedIds(prev => {
            const next = new Set(prev)
            for (const row of toAdd) next.add(row.menu_item_id)
            return next
          })
        }
      }
    }
    setTogglingAll(null)
  }

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="px-5 py-6">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/head-office/workshops')}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-charcoal/5 transition-colors text-charcoal/50"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="font-serif text-2xl text-charcoal">Edit Workshop</h1>
          <p className="text-sm text-charcoal/40 mt-0.5">{assignedCount} course{assignedCount !== 1 ? 's' : ''} assigned</p>
        </div>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>

      {/* Workshop details */}
      <div className="card p-5 mb-6">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-charcoal/50 uppercase tracking-wide">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-charcoal/50 uppercase tracking-wide">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveDetails}
              disabled={!name.trim() || saving}
              className="btn-primary text-sm"
            >
              {saving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Course assignment */}
      <div className="mb-4">
        <h2 className="font-serif text-lg text-charcoal mb-1">Assign Courses</h2>
        <p className="text-sm text-charcoal/40">Toggle courses to add or remove them from this workshop.</p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/30" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search courses…"
          className="input pl-10 pr-10"
          autoComplete="off"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search results (flat list) */}
      {search.trim() && (
        <div className="mb-2">
          <p className="text-xs text-charcoal/40 mb-3">
            {filteredItems.length === 0 ? 'No results' : `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''}`}
          </p>
          <div className="space-y-1">
            {filteredItems.map(item => (
              <CourseToggleRow
                key={item.id}
                item={item}
                assigned={assignedIds.has(item.id)}
                toggling={toggling === item.id}
                onToggle={() => toggleCourse(item.id)}
                showCategory
              />
            ))}
          </div>
        </div>
      )}

      {/* Category browse (when not searching) */}
      {!search.trim() && (
        <div className="space-y-3">
          {categories.map(category => {
            const items = menuItems.filter(i => i.category_id === category.id)
            if (items.length === 0) return null
            const expanded = expandedCategories.has(category.id)
            const assignedInCat = items.filter(i => assignedIds.has(i.id)).length

            return (
              <div key={category.id} className="card overflow-hidden">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                  >
                    {category.icon}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-charcoal text-[15px]">{category.name}</p>
                    <p className="text-xs text-charcoal/40 mt-0.5">{assignedInCat}/{items.length} assigned</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${items.length > 0 ? (assignedInCat / items.length) * 100 : 0}%`,
                          backgroundColor: category.colour_hex,
                        }}
                      />
                    </div>
                    {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                  </div>
                </button>

                {expanded && (() => {
                  const allAssigned = items.every(i => assignedIds.has(i.id))
                  return (
                  <div className="border-t border-black/5">
                    <div className="px-5 py-2 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAllInCategory(category.id) }}
                        disabled={togglingAll === category.id}
                        className="text-xs font-medium text-gold hover:text-gold/80 transition-colors"
                      >
                        {togglingAll === category.id ? '…' : allAssigned ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="divide-y divide-black/5">
                    {items.map(item => (
                      <CourseToggleRow
                        key={item.id}
                        item={item}
                        assigned={assignedIds.has(item.id)}
                        toggling={toggling === item.id}
                        onToggle={() => toggleCourse(item.id)}
                      />
                    ))}
                    </div>
                  </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CourseToggleRow({
  item,
  assigned,
  toggling,
  onToggle,
  showCategory = false,
}: {
  item: MenuItem
  assigned: boolean
  toggling: boolean
  onToggle: () => void
  showCategory?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={toggling}
      className={`w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors ${
        assigned ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-charcoal/2'
      }`}
    >
      <span
        className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs border transition-colors ${
          assigned ? 'bg-gold border-gold text-white' : 'border-charcoal/20'
        }`}
      >
        {assigned && <Check size={12} />}
      </span>
      <div className="flex-1">
        {showCategory && item.category && (
          <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
        )}
        <p className="text-[14px] text-charcoal leading-snug">{item.title}</p>
        {item.is_recurring && item.recurring_amount && (
          <p className="text-xs text-charcoal/40 mt-0.5">Session — {item.recurring_amount} sessions</p>
        )}
      </div>
      {toggling && (
        <span className="text-xs text-charcoal/30">…</span>
      )}
    </button>
  )
}
