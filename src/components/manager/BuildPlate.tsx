'use client'

import { useState, useMemo, useTransition } from 'react'
import { Search, X, ChevronDown, ChevronUp, Plus, Check, Calendar } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User, Category, MenuItem, Plate, VisibleCategory } from '@/types'

interface Props {
  manager: User
  trainees: User[]
  categories: Category[]
  menuItems: MenuItem[]
  todayPlates: Plate[]
  visibleCategories?: VisibleCategory[]
  showBoutique?: boolean
}

// Generate next 14 days for date picker
function getUpcomingDates() {
  const dates: { value: string; label: string; isToday: boolean }[] = []
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    dates.push({
      value: d.toISOString().split('T')[0],
      label: d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
      isToday: i === 0,
    })
  }
  return dates
}

export function BuildPlate({ manager, trainees, categories, menuItems, todayPlates, visibleCategories: initialVisible = [], showBoutique }: Props) {
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(
    trainees.length === 1 ? trainees[0] : null
  )
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [plates, setPlates] = useState<Plate[]>(todayPlates)
  const [visibleCats, setVisibleCats] = useState<VisibleCategory[]>(initialVisible)
  const [isPending, startTransition] = useTransition()
  const [datePicker, setDatePicker] = useState<{ items: MenuItem[]; anchorId: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const isEmployee = selectedTrainee?.role === 'trainee'
  const upcomingDates = useMemo(() => getUpcomingDates(), [])

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const isCategoryVisible = (categoryId: string) => {
    return visibleCats.some(v => v.category_id === categoryId && v.user_id === selectedTrainee?.id)
  }

  const isOnPlate = (menuItemId: string, traineeId?: string) => {
    const tid = traineeId ?? selectedTrainee?.id
    return plates.some(p => p.menu_item_id === menuItemId && p.trainee_id === tid)
  }

  const traineeOnPlateCount = (traineeId: string) =>
    plates.filter(p => p.trainee_id === traineeId).length

  // Show date picker for a single item or multiple items (category)
  function requestAssign(items: MenuItem[], anchorId: string) {
    if (!selectedTrainee) return
    setDatePicker({ items, anchorId })
  }

  async function assignToDate(date: string) {
    if (!selectedTrainee || !datePicker) return

    const newPlates: Plate[] = []
    for (const item of datePicker.items) {
      // Skip if already on plate for this date
      const alreadyAssigned = plates.some(
        p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id && p.date_assigned === date
      )
      if (alreadyAssigned) continue

      const { data, error } = await supabase.from('plates').insert({
        trainee_id: selectedTrainee.id,
        menu_item_id: item.id,
        assigned_by: manager.id,
        date_assigned: date,
        boutique_id: selectedTrainee.boutique_id || manager.boutique_id,
      }).select().single()

      if (!error && data) {
        newPlates.push(data as Plate)
      }
    }

    if (newPlates.length > 0) {
      setPlates(prev => [...prev, ...newPlates])
    }
    setDatePicker(null)
    startTransition(() => router.refresh())
  }

  async function removeFromPlate(item: MenuItem) {
    if (!selectedTrainee) return
    const existing = plates.find(
      p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id
    )
    if (existing) {
      setPlates(prev => prev.filter(p => p.id !== existing.id))
      await supabase.from('plates').delete().eq('id', existing.id)
      startTransition(() => router.refresh())
    }
  }

  async function toggleCategoryVisibility(categoryId: string) {
    if (!selectedTrainee) return

    const existing = visibleCats.find(
      v => v.category_id === categoryId && v.user_id === selectedTrainee.id
    )

    if (existing) {
      setVisibleCats(prev => prev.filter(v => v.id !== existing.id))
      await supabase.from('visible_categories').delete().eq('id', existing.id)
    } else {
      const { data, error } = await supabase.from('visible_categories').insert({
        user_id: selectedTrainee.id,
        category_id: categoryId,
        enabled_by: manager.id,
      }).select().single()

      if (!error && data) {
        setVisibleCats(prev => [...prev, data as VisibleCategory])
      }
    }
  }

  const filteredItems = useMemo(() => {
    if (!search.trim()) return menuItems
    const q = search.toLowerCase()
    return menuItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [menuItems, search])

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isSearching = search.trim().length > 0

  return (
    <div className="px-5 py-6">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-charcoal">Build Today&apos;s Plate</h1>
        <p className="text-sm text-charcoal/40 mt-1">{today}</p>
      </div>

      {/* Date picker modal */}
      {datePicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setDatePicker(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-lg text-charcoal">Assign to date</h3>
                <p className="text-xs text-charcoal/40 mt-0.5">
                  {datePicker.items.length === 1 ? datePicker.items[0].title : `${datePicker.items.length} courses`}
                  {' → '}{selectedTrainee?.name.split(' ')[0]}
                </p>
              </div>
              <button onClick={() => setDatePicker(null)} className="text-charcoal/30 hover:text-charcoal">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {upcomingDates.map(date => (
                <button
                  key={date.value}
                  onClick={() => assignToDate(date.value)}
                  className={`px-3 py-3 rounded-xl text-sm font-medium text-left transition-all border ${
                    date.isToday
                      ? 'border-gold bg-gold/5 text-gold hover:bg-gold/10'
                      : 'border-charcoal/10 text-charcoal/70 hover:border-gold hover:text-gold'
                  }`}
                >
                  {date.label}
                  {date.isToday && <span className="block text-xs text-gold/60 mt-0.5">Today</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* People selector */}
      {trainees.length === 0 ? (
        <div className="card p-6 text-center mb-5">
          <p className="text-charcoal/40 text-sm">No employees found.</p>
        </div>
      ) : showBoutique ? (
        <div className="mb-5 space-y-4">
          {[
            { label: 'Building for Managers', users: trainees.filter(t => t.role === 'manager') },
            { label: 'Building for Employees', users: trainees.filter(t => t.role === 'trainee') },
          ].map(group => group.users.length > 0 && (
            <div key={group.label}>
              <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">{group.label}</p>
              <div className="flex gap-2 flex-wrap">
                {group.users.map(person => (
                  <PersonButton
                    key={person.id}
                    person={person}
                    selected={selectedTrainee?.id === person.id}
                    plateCount={traineeOnPlateCount(person.id)}
                    showBoutique
                    onClick={() => setSelectedTrainee(person)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-5">
          <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">Building for</p>
          <div className="flex gap-2 flex-wrap">
            {trainees.map(person => (
              <PersonButton
                key={person.id}
                person={person}
                selected={selectedTrainee?.id === person.id}
                plateCount={traineeOnPlateCount(person.id)}
                onClick={() => setSelectedTrainee(person)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedTrainee && (
        <>
          {/* Today's plate summary */}
          {traineeOnPlateCount(selectedTrainee.id) === 0 ? (
            <div className="card p-4 mb-5 border border-dashed border-charcoal/15 bg-transparent">
              <p className="text-sm text-charcoal/40 text-center">
                {selectedTrainee.name.split(' ')[0]}&apos;s plate is empty — browse the menu below and tap + to assign.
              </p>
            </div>
          ) : (
            <div className="card p-4 mb-5 bg-charcoal/3 border-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider">
                  {selectedTrainee.name.split(' ')[0]}&apos;s assigned items
                </p>
                <span className="text-xs text-gold font-medium">{traineeOnPlateCount(selectedTrainee.id)} items</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {menuItems
                  .filter(item => isOnPlate(item.id, selectedTrainee.id))
                  .map(item => {
                    const plate = plates.find(p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id)
                    return (
                      <span key={item.id} className="text-xs bg-white border border-black/8 text-charcoal px-2 py-1 rounded-lg flex items-center gap-1.5">
                        {item.title}
                        {plate && plate.date_assigned !== new Date().toISOString().split('T')[0] && (
                          <span className="text-charcoal/30">{new Date(plate.date_assigned + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                        )}
                        <button
                          onClick={() => removeFromPlate(item)}
                          className="text-charcoal/30 hover:text-red-500 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/30" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu items…"
              className="input pl-10 pr-10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search results */}
          {isSearching && (
            <div className="space-y-2">
              {filteredItems.map(item => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  onPlate={isOnPlate(item.id)}
                  onAssign={() => requestAssign([item], item.id)}
                  onRemove={() => removeFromPlate(item)}
                />
              ))}
            </div>
          )}

          {/* Category browse */}
          {!isSearching && (
            <div className="space-y-2">
              {categories.map(category => {
                const items = menuItems.filter(i => i.category_id === category.id)
                const expanded = expandedCategories.has(category.id)
                const onPlateCount = items.filter(i => isOnPlate(i.id)).length
                const visible = isCategoryVisible(category.id)

                return (
                  <div key={category.id} className={`card overflow-hidden ${isEmployee && !visible ? 'opacity-40' : ''}`}>
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="flex-1 px-5 py-4 flex items-center gap-3 text-left"
                      >
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                          style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                        >
                          {category.icon}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-charcoal text-[15px]">{category.name}</p>
                          <div className="flex gap-3 mt-0.5">
                            {onPlateCount > 0 && (
                              <p className="text-xs text-gold">{onPlateCount} on plate</p>
                            )}
                            {isEmployee && (
                              <p className="text-xs text-charcoal/30">{visible ? 'Visible' : 'Hidden'}</p>
                            )}
                          </div>
                        </div>
                        {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                      </button>

                      {/* Assign all courses in category */}
                      {(!isEmployee || visible) && (
                        <button
                          onClick={() => requestAssign(items, `cat-${category.id}`)}
                          className="mr-2 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-charcoal/10 text-charcoal/30 hover:border-gold hover:text-gold transition-all"
                          title={`Assign all ${category.name} courses`}
                        >
                          <Plus size={18} />
                        </button>
                      )}

                      {/* Category visibility toggle — only for employees */}
                      {isEmployee && (
                        <button
                          onClick={() => toggleCategoryVisibility(category.id)}
                          className={`mr-4 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                            visible
                              ? 'bg-gold/10 text-gold border-2 border-gold/30'
                              : 'bg-charcoal/5 text-charcoal/25 border-2 border-charcoal/10'
                          }`}
                          title={visible ? 'Hide from employee' : 'Show to employee'}
                        >
                          {visible ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                              <line x1="1" y1="1" x2="23" y2="23"/>
                              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    {expanded && (!isEmployee || visible) && (
                      <div className="border-t border-black/5 divide-y divide-black/5">
                        {items.map(item => (
                          <MenuItemRow
                            key={item.id}
                            item={item}
                            onPlate={isOnPlate(item.id)}
                            onAssign={() => requestAssign([item], item.id)}
                            onRemove={() => removeFromPlate(item)}
                            compact
                          />
                        ))}
                      </div>
                    )}

                    {expanded && isEmployee && !visible && (
                      <div className="border-t border-black/5 px-5 py-4">
                        <p className="text-sm text-charcoal/30 text-center">
                          {items.length} courses — hidden from {selectedTrainee.name.split(' ')[0]}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PersonButton({
  person,
  selected,
  plateCount,
  showBoutique,
  onClick,
}: {
  person: User
  selected: boolean
  plateCount: number
  showBoutique?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
        selected
          ? 'border-gold bg-gold/10 text-gold'
          : 'border-charcoal/15 text-charcoal/60 hover:border-charcoal/30'
      }`}
    >
      <span className="w-7 h-7 rounded-full bg-charcoal/8 flex items-center justify-center text-xs font-medium">
        {person.avatar_initials}
      </span>
      <span>
        {person.name}
        {showBoutique && person.boutique && (
          <span className="text-xs text-charcoal/30 ml-1">({(person.boutique as { city: string }).city})</span>
        )}
      </span>
      {plateCount > 0 && (
        <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">
          {plateCount}
        </span>
      )}
    </button>
  )
}

function MenuItemRow({
  item,
  onPlate,
  onAssign,
  onRemove,
  compact = false,
}: {
  item: MenuItem
  onPlate: boolean
  onAssign: () => void
  onRemove: () => void
  compact?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'px-5 py-3' : 'card px-4 py-3'}`}>
      <div className="flex-1">
        {!compact && item.category && (
          <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
        )}
        <p className={`text-[14px] text-charcoal leading-snug ${!compact ? 'mt-1' : ''}`}>{item.title}</p>
        <p className="text-xs text-charcoal/35 mt-0.5">{item.time_needed} · {item.trainer_type}</p>
      </div>
      {onPlate ? (
        <button
          onClick={onRemove}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gold text-white shadow-sm hover:bg-gold/80 transition-all"
        >
          <Check size={16} />
        </button>
      ) : (
        <button
          onClick={onAssign}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-charcoal/15 text-charcoal/30 hover:border-gold hover:text-gold transition-all"
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  )
}
