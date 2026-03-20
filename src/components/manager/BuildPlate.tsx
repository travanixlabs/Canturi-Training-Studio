'use client'

import { useState, useMemo, useTransition } from 'react'
import { Search, X, ChevronDown, ChevronUp, Plus, Check, Minus } from 'lucide-react'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User, Category, MenuItem, Plate } from '@/types'

interface Props {
  manager: User
  trainees: User[]
  categories: Category[]
  menuItems: MenuItem[]
  todayPlates: Plate[]
  showBoutique?: boolean
}

export function BuildPlate({ manager, trainees, categories, menuItems, todayPlates, showBoutique }: Props) {
  const [selectedTrainee, setSelectedTrainee] = useState<User | null>(
    trainees.length === 1 ? trainees[0] : null
  )
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [plates, setPlates] = useState<Plate[]>(todayPlates)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const isOnPlate = (menuItemId: string, traineeId?: string) => {
    const tid = traineeId ?? selectedTrainee?.id
    return plates.some(p => p.menu_item_id === menuItemId && p.trainee_id === tid)
  }

  const traineeOnPlateCount = (traineeId: string) =>
    plates.filter(p => p.trainee_id === traineeId).length

  async function togglePlate(item: MenuItem) {
    if (!selectedTrainee) return

    const existing = plates.find(
      p => p.menu_item_id === item.id && p.trainee_id === selectedTrainee.id
    )

    if (existing) {
      // Remove from plate
      setPlates(prev => prev.filter(p => p.id !== existing.id))
      await supabase.from('plates').delete().eq('id', existing.id)
    } else {
      // Add to plate
      const { data, error } = await supabase.from('plates').insert({
        trainee_id: selectedTrainee.id,
        menu_item_id: item.id,
        assigned_by: manager.id,
        date_assigned: new Date().toISOString().split('T')[0],
        boutique_id: manager.boutique_id,
      }).select().single()

      if (!error && data) {
        setPlates(prev => [...prev, data as Plate])
      }
    }

    startTransition(() => router.refresh())
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

      {/* Trainee selector */}
      {trainees.length === 0 ? (
        <div className="card p-6 text-center mb-5">
          <p className="text-charcoal/40 text-sm">No trainees in your boutique yet.</p>
        </div>
      ) : (
        <div className="mb-5">
          <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider mb-2">Building for</p>
          <div className="flex gap-2 flex-wrap">
            {trainees.map(trainee => (
              <button
                key={trainee.id}
                onClick={() => setSelectedTrainee(trainee)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
                  selectedTrainee?.id === trainee.id
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-charcoal/15 text-charcoal/60 hover:border-charcoal/30'
                }`}
              >
                <span className="w-7 h-7 rounded-full bg-charcoal/8 flex items-center justify-center text-xs font-medium">
                  {trainee.avatar_initials}
                </span>
                <span>
                  {trainee.name}
                  {showBoutique && trainee.boutique && (
                    <span className="text-xs text-charcoal/30 ml-1">({(trainee.boutique as { city: string }).city})</span>
                  )}
                </span>
                {traineeOnPlateCount(trainee.id) > 0 && (
                  <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">
                    {traineeOnPlateCount(trainee.id)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedTrainee && (
        <>
          {/* Today's plate summary */}
          {isOnPlate('', selectedTrainee.id) === false && traineeOnPlateCount(selectedTrainee.id) === 0 ? (
            <div className="card p-4 mb-5 border border-dashed border-charcoal/15 bg-transparent">
              <p className="text-sm text-charcoal/40 text-center">
                {selectedTrainee.name.split(' ')[0]}&apos;s plate is empty — browse the menu below and tap + to add items.
              </p>
            </div>
          ) : (
            <div className="card p-4 mb-5 bg-charcoal/3 border-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-charcoal/50 uppercase tracking-wider">
                  {selectedTrainee.name.split(' ')[0]}&apos;s plate today
                </p>
                <span className="text-xs text-gold font-medium">{traineeOnPlateCount(selectedTrainee.id)} items</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {menuItems
                  .filter(item => isOnPlate(item.id, selectedTrainee.id))
                  .map(item => (
                    <span key={item.id} className="text-xs bg-white border border-black/8 text-charcoal px-2 py-1 rounded-lg flex items-center gap-1.5">
                      {item.title}
                      <button
                        onClick={() => togglePlate(item)}
                        className="text-charcoal/30 hover:text-red-500 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
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
                  onToggle={() => togglePlate(item)}
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

                return (
                  <div key={category.id} className="card overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full px-5 py-4 flex items-center gap-3 text-left"
                    >
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                      >
                        {category.icon}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-charcoal text-[15px]">{category.name}</p>
                        {onPlateCount > 0 && (
                          <p className="text-xs text-gold mt-0.5">{onPlateCount} on plate</p>
                        )}
                      </div>
                      {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                    </button>

                    {expanded && (
                      <div className="border-t border-black/5 divide-y divide-black/5">
                        {items.map(item => (
                          <MenuItemRow
                            key={item.id}
                            item={item}
                            onPlate={isOnPlate(item.id)}
                            onToggle={() => togglePlate(item)}
                            compact
                          />
                        ))}
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

function MenuItemRow({
  item,
  onPlate,
  onToggle,
  compact = false,
}: {
  item: MenuItem
  onPlate: boolean
  onToggle: () => void
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
      <button
        onClick={onToggle}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          onPlate
            ? 'bg-gold text-white shadow-sm'
            : 'border-2 border-charcoal/15 text-charcoal/30 hover:border-gold hover:text-gold'
        }`}
      >
        {onPlate ? <Check size={16} /> : <Plus size={16} />}
      </button>
    </div>
  )
}
