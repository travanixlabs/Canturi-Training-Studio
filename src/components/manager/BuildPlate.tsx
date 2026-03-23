'use client'

import { useState, useMemo, useTransition } from 'react'
import { Search, X, ChevronDown, ChevronUp, Plus, Check, Calendar } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User, Category, MenuItem, Plate, VisibleCategory, Completion, RecurringTaskCompletion } from '@/types'

interface Props {
  manager: User
  trainees: User[]
  categories: Category[]
  menuItems: MenuItem[]
  todayPlates: Plate[]
  visibleCategories?: VisibleCategory[]
  completions?: Completion[]
  recurringCompletions?: RecurringTaskCompletion[]
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

export function BuildPlate({ manager, trainees, categories, menuItems, todayPlates, visibleCategories: initialVisible = [], completions: allCompletions = [], recurringCompletions: initialRecurring = [], showBoutique }: Props) {
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(
    trainees.length === 1 ? trainees[0] : null
  )
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [plates, setPlates] = useState<Plate[]>(todayPlates)
  const [visibleCats, setVisibleCats] = useState<VisibleCategory[]>(initialVisible)
  const [isPending, startTransition] = useTransition()
  const [datePicker, setDatePicker] = useState<{ items: MenuItem[]; anchorId: string } | null>(null)
  const [multiDatePicker, setMultiDatePicker] = useState<{ item: MenuItem; anchorId: string } | null>(null)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [recurringCompletions, setRecurringCompletions] = useState<RecurringTaskCompletion[]>(initialRecurring)
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

  const isCompleted = (menuItemId: string, traineeId?: string) => {
    const tid = traineeId ?? selectedTrainee?.id
    return allCompletions.some(c => c.menu_item_id === menuItemId && c.trainee_id === tid)
  }

  const getCompletion = (menuItemId: string) => {
    return allCompletions.find(c => c.menu_item_id === menuItemId && c.trainee_id === selectedTrainee?.id)
  }

  const getRecurringCount = (menuItemId: string, traineeId?: string) => {
    const tid = traineeId ?? selectedTrainee?.id
    return recurringCompletions.filter(rc => rc.menu_item_id === menuItemId && rc.trainee_id === tid).length
  }

  const getRecurringDates = (menuItemId: string, traineeId?: string) => {
    const tid = traineeId ?? selectedTrainee?.id
    return recurringCompletions
      .filter(rc => rc.menu_item_id === menuItemId && rc.trainee_id === tid)
      .map(rc => rc.completed_date)
      .sort()
  }

  const traineeOnPlateCount = (traineeId: string) =>
    plates.filter(p => p.trainee_id === traineeId).length

  // Show date picker for a single item or multiple items (category)
  function requestAssign(items: MenuItem[], anchorId: string) {
    if (!selectedTrainee) return
    // For a single recurring item, show multi-date picker
    if (items.length === 1 && items[0].is_recurring) {
      setMultiDatePicker({ item: items[0], anchorId })
      setSelectedDates(new Set())
      return
    }
    setDatePicker({ items, anchorId })
  }

  async function assignToDate(date: string) {
    if (!selectedTrainee || !datePicker) return

    const newPlates: Plate[] = []
    for (const item of datePicker.items) {
      // Remove existing plate for this item+trainee (allows re-assignment to new date)
      const existing = plates.find(
        p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id
      )
      if (existing) {
        setPlates(prev => prev.filter(p => p.id !== existing.id))
        await supabase.from('plates').delete().eq('id', existing.id)
      }

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

  async function assignMultipleDates() {
    if (!selectedTrainee || !multiDatePicker || selectedDates.size === 0) return
    const item = multiDatePicker.item

    const newPlates: Plate[] = []
    for (const date of Array.from(selectedDates).sort()) {
      // Skip if already has a plate for this item+trainee+date
      const alreadyExists = plates.some(
        p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id && p.date_assigned === date
      )
      if (alreadyExists) continue

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
    setMultiDatePicker(null)
    setSelectedDates(new Set())
    startTransition(() => router.refresh())
  }

  async function removeFromPlate(item: MenuItem) {
    if (!selectedTrainee) return

    if (item.is_recurring) {
      // For recurring items, only remove plates where there is NO recurring_task_completion for that date
      const traineeRecurringDates = new Set(
        recurringCompletions
          .filter(rc => rc.menu_item_id === item.id && rc.trainee_id === selectedTrainee.id)
          .map(rc => rc.completed_date)
      )
      const removable = plates.filter(
        p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id && !traineeRecurringDates.has(p.date_assigned)
      )
      if (removable.length === 0) return
      const removeIds = removable.map(p => p.id)
      setPlates(prev => prev.filter(p => !removeIds.includes(p.id)))
      for (const p of removable) {
        await supabase.from('plates').delete().eq('id', p.id)
      }
      startTransition(() => router.refresh())
      return
    }

    const existing = plates.find(
      p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id
    )
    if (existing) {
      setPlates(prev => prev.filter(p => p.id !== existing.id))
      await supabase.from('plates').delete().eq('id', existing.id)
      startTransition(() => router.refresh())
    }
  }

  async function reassignItem(item: MenuItem) {
    if (!selectedTrainee) return
    // Delete the completion record
    await supabase.from('completions').delete()
      .eq('menu_item_id', item.id)
      .eq('trainee_id', selectedTrainee.id)
    // Show date picker to reassign
    requestAssign([item], `reassign-${item.id}`)
    startTransition(() => router.refresh())
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
                  {datePicker.items.length === 1 ? datePicker.items[0].title : `${datePicker.items.length} categories`}
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

      {/* Multi-date picker modal for recurring items */}
      {multiDatePicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setMultiDatePicker(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-lg text-charcoal">Assign recurring dates</h3>
                <p className="text-xs text-charcoal/40 mt-0.5">
                  {multiDatePicker.item.title}
                  {' → '}{selectedTrainee?.name.split(' ')[0]}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Select multiple dates · {selectedDates.size} selected
                </p>
              </div>
              <button onClick={() => setMultiDatePicker(null)} className="text-charcoal/30 hover:text-charcoal">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto mb-4">
              {upcomingDates.map(date => {
                const checked = selectedDates.has(date.value)
                return (
                  <button
                    key={date.value}
                    onClick={() => {
                      setSelectedDates(prev => {
                        const next = new Set(prev)
                        if (next.has(date.value)) next.delete(date.value)
                        else next.add(date.value)
                        return next
                      })
                    }}
                    className={`px-3 py-3 rounded-xl text-sm font-medium text-left transition-all border flex items-center gap-2 ${
                      checked
                        ? 'border-gold bg-gold/10 text-gold'
                        : date.isToday
                        ? 'border-gold/30 bg-gold/5 text-charcoal/70 hover:border-gold'
                        : 'border-charcoal/10 text-charcoal/70 hover:border-gold hover:text-gold'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      checked ? 'bg-gold border-gold' : 'border-charcoal/20'
                    }`}>
                      {checked && <Check size={10} className="text-white" />}
                    </span>
                    <span>
                      {date.label}
                      {date.isToday && <span className="block text-xs text-gold/60 mt-0.5">Today</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={assignMultipleDates}
              disabled={selectedDates.size === 0}
              className="btn-gold w-full disabled:opacity-40"
            >
              Assign {selectedDates.size} date{selectedDates.size !== 1 ? 's' : ''}
            </button>
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
                  completed={isCompleted(item.id)}
                  completedDate={getCompletion(item.id)?.completed_date}
                  assignedDate={plates.find(p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee?.id)?.date_assigned}
                  onAssign={() => requestAssign([item], item.id)}
                  onRemove={() => removeFromPlate(item)}
                  recurringCount={item.is_recurring ? getRecurringCount(item.id) : undefined}
                  recurringDates={item.is_recurring ? getRecurringDates(item.id) : undefined}
                  onReassign={() => reassignItem(item)}
                  traineeNotes={getCompletion(item.id)?.trainee_notes ?? undefined}
                  traineeRating={getCompletion(item.id)?.trainee_rating ?? undefined}
                />
              ))}
            </div>
          )}

          {/* Category browse — each course expands to show Categories + Recurring sub-sections */}
          {!isSearching && (
            <div className="space-y-2">
              {categories.map(category => {
                const allItems = menuItems.filter(i => i.category_id === category.id)
                const nonRecurring = allItems.filter(i => !i.is_recurring)
                const recurring = allItems.filter(i => i.is_recurring)
                const expanded = expandedCategories.has(category.id)
                const visible = isCategoryVisible(category.id)
                const assignedCount = allItems.filter(i => isOnPlate(i.id)).length
                const unassignedCount = allItems.length - assignedCount

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
                            <p className="text-xs text-charcoal/40">
                              {assignedCount} assigned
                              {unassignedCount > 0 && <span className="text-charcoal/25"> · {unassignedCount} unassigned</span>}
                            </p>
                            {isEmployee && !visible && (
                              <p className="text-xs text-charcoal/30">Hidden</p>
                            )}
                          </div>
                        </div>
                        {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                      </button>

                      {/* Assign all categories in course */}
                      {(!isEmployee || visible) && (
                        <button
                          onClick={() => requestAssign(allItems, `cat-${category.id}`)}
                          className="mr-2 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-charcoal/10 text-charcoal/30 hover:border-gold hover:text-gold transition-all"
                          title={`Assign all ${category.name} categories`}
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
                      <div className="border-t border-black/5">
                        {/* Non-recurring sub-section */}
                        {nonRecurring.length > 0 && (
                          <div>
                            {recurring.length > 0 && (
                              <div className="px-5 pt-3 pb-1">
                                <p className="text-[10px] font-semibold text-charcoal/30 uppercase tracking-widest">Categories</p>
                              </div>
                            )}
                            <div className="divide-y divide-black/5">
                              {nonRecurring.map(item => (
                                <MenuItemRow
                                  key={item.id}
                                  item={item}
                                  onPlate={isOnPlate(item.id)}
                                  completed={isCompleted(item.id)}
                                  completedDate={getCompletion(item.id)?.completed_date}
                                  assignedDate={plates.find(p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee?.id)?.date_assigned}
                                  onAssign={() => requestAssign([item], item.id)}
                                  onRemove={() => removeFromPlate(item)}
                                  compact
                                  onReassign={() => reassignItem(item)}
                                  traineeNotes={getCompletion(item.id)?.trainee_notes ?? undefined}
                                  traineeRating={getCompletion(item.id)?.trainee_rating ?? undefined}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recurring sub-section */}
                        {recurring.length > 0 && (
                          <div className={nonRecurring.length > 0 ? 'border-t border-black/5' : ''}>
                            <div className="px-5 pt-3 pb-1">
                              <p className="text-[10px] font-semibold text-charcoal/30 uppercase tracking-widest">Recurring Categories</p>
                            </div>
                            <div className="divide-y divide-black/5">
                              {recurring.map(item => (
                                <MenuItemRow
                                  key={item.id}
                                  item={item}
                                  onPlate={isOnPlate(item.id)}
                                  completed={isCompleted(item.id)}
                                  completedDate={getCompletion(item.id)?.completed_date}
                                  assignedDate={(() => {
                                    const todayStr = new Date().toISOString().split('T')[0]
                                    const futureDates = plates
                                      .filter(p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee?.id && p.date_assigned >= todayStr)
                                      .map(p => p.date_assigned)
                                      .sort()
                                    return futureDates[0] ?? plates.find(p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee?.id)?.date_assigned
                                  })()}
                                  onAssign={() => requestAssign([item], item.id)}
                                  onRemove={() => removeFromPlate(item)}
                                  compact
                                  recurringCount={getRecurringCount(item.id)}
                                  recurringDates={getRecurringDates(item.id)}
                                  onReassign={() => reassignItem(item)}
                                  traineeNotes={getCompletion(item.id)?.trainee_notes ?? undefined}
                                  traineeRating={getCompletion(item.id)?.trainee_rating ?? undefined}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {expanded && isEmployee && !visible && (
                      <div className="border-t border-black/5 px-5 py-4">
                        <p className="text-sm text-charcoal/30 text-center">
                          {allItems.length} categories — hidden from {selectedTrainee.name.split(' ')[0]}
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
  completed = false,
  completedDate,
  assignedDate,
  onAssign,
  onRemove,
  compact = false,
  recurringCount,
  recurringDates,
  onReassign,
  traineeNotes,
  traineeRating,
}: {
  item: MenuItem
  onPlate: boolean
  completed?: boolean
  completedDate?: string
  assignedDate?: string
  onAssign: () => void
  onRemove: () => void
  compact?: boolean
  recurringCount?: number
  recurringDates?: string[]
  onReassign?: () => void
  traineeNotes?: string
  traineeRating?: number
}) {
  const [showDetail, setShowDetail] = useState(false)
  const shadowedEarly = completed && completedDate && assignedDate && completedDate < assignedDate
  const isRecurringItem = item.is_recurring && item.recurring_amount
  const recurringTotal = item.recurring_amount ?? 0
  const recurringDone = recurringCount ?? 0
  const recurringFullyComplete = isRecurringItem && recurringDone >= recurringTotal

  return (
    <div className={`flex items-center gap-3 ${compact ? 'px-5 py-3' : 'card px-4 py-3'} ${
      isRecurringItem
        ? (recurringFullyComplete ? 'bg-green-50/50' : recurringDone > 0 ? 'bg-blue-50/50' : '')
        : (completed ? (shadowedEarly ? 'bg-blue-50/50' : 'bg-green-50/50') : '')
    }`}>
      <div className="flex-1">
        {!compact && item.category && (
          <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />
        )}
        <p className={`text-[14px] text-charcoal leading-snug ${!compact ? 'mt-1' : ''}`}>{item.title}</p>
        {isRecurringItem ? (
          <div className="mt-0.5">
            <p className={`text-xs font-medium ${recurringFullyComplete ? 'text-green-600' : recurringDone > 0 ? 'text-blue-600' : 'text-charcoal/40'}`}>
              {recurringFullyComplete ? 'Completed' : `${recurringDone} out of ${recurringTotal} recurring tasks completed`}
              {!recurringFullyComplete && assignedDate && (
                <span className="font-semibold text-charcoal/50 ml-1">{new Date(assignedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}</span>
              )}
            </p>
            {recurringFullyComplete && recurringDates && recurringDates.length > 0 && (
              <p className="text-xs text-green-600/70 mt-0.5">
                {recurringDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })).join(' | ')}
              </p>
            )}
          </div>
        ) : (
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-charcoal/35">
            {assignedDate && !completed && (
              <span className="font-semibold text-charcoal/50">{new Date(assignedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}</span>
            )}
          </p>
          {completed && shadowedEarly && (
            <span className="text-xs text-blue-600 font-medium">
              Shadowed early on {new Date(completedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
            </span>
          )}
          {completed && !shadowedEarly && (
            <span className="text-xs text-green-600 font-medium">
              Completed {completedDate ? new Date(completedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }) : ''}
            </span>
          )}
        </div>
        )}
      </div>
      {/* Edit date button for assigned items */}
      {onPlate && !completed && (
        <button
          onClick={onAssign}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-charcoal/25 hover:text-gold transition-colors"
          title="Change date"
        >
          <Calendar size={14} />
        </button>
      )}
      {completed ? (
        <button
          onClick={() => setShowDetail(true)}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white cursor-pointer hover:opacity-80 transition-opacity ${shadowedEarly ? 'bg-blue-500' : 'bg-green-500'}`}
          title="View details"
        >
          <Check size={16} />
        </button>
      ) : onPlate ? (
        <button
          onClick={onRemove}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gold text-white shadow-sm hover:bg-gold/80 transition-all"
          title="Remove from plate"
        >
          <X size={16} />
        </button>
      ) : (
        <button
          onClick={onAssign}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-charcoal/15 text-charcoal/30 hover:border-gold hover:text-gold transition-all"
        >
          <Plus size={16} />
        </button>
      )}

      {/* Detail modal for completed items */}
      {showDetail && (completed || (isRecurringItem && recurringDone > 0)) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                {item.category && <CategoryBadge categoryName={item.category.name} icon={item.category.icon} />}
                <h3 className="font-serif text-lg text-charcoal mt-1">{item.title}</h3>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-charcoal/30 hover:text-charcoal">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              {isRecurringItem ? (
                <div>
                  <p className={`text-sm font-medium ${recurringFullyComplete ? 'text-green-600' : 'text-blue-600'}`}>
                    {recurringDone} out of {recurringTotal} recurring tasks completed
                  </p>
                  {recurringDates && recurringDates.length > 0 && (
                    <p className="text-xs text-charcoal/40 mt-1">
                      Completed on: {recurringDates.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${shadowedEarly ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                    {shadowedEarly ? 'Shadowed early' : 'Completed'}
                  </span>
                  {completedDate && (
                    <span className="text-xs text-charcoal/40">
                      {new Date(completedDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              )}

              {traineeNotes && (
                <div>
                  <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-1">Employee notes</p>
                  <p className="text-sm text-charcoal/70">{traineeNotes}</p>
                </div>
              )}

              {traineeRating != null && traineeRating > 0 && (
                <div>
                  <p className="text-xs font-medium text-charcoal/40 uppercase tracking-wider mb-1">Employee self-rating</p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <span key={s} className={`text-lg ${s <= traineeRating ? 'text-gold' : 'text-charcoal/15'}`}>★</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {onReassign && (
              <button
                onClick={() => { setShowDetail(false); onReassign() }}
                className="w-full py-3 rounded-xl text-sm font-medium border-2 border-charcoal/15 text-charcoal/60 hover:border-gold hover:text-gold transition-all"
              >
                Reassign to employee
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
