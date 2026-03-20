'use client'

import { useMemo } from 'react'
import { CATEGORY_COLOURS } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { Plate, Completion, User, Category } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  plates: Plate[]
  completions: Completion[]
  shadowedToday?: Completion[]
  currentUser: User
}

export function TodaysPlate({ plates, completions, shadowedToday = [], currentUser }: Props) {
  const router = useRouter()

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const getCompletion = (menuItemId: string) =>
    completions.find(c => c.menu_item_id === menuItemId) ?? null

  const completedPlates = plates.filter(p => getCompletion(p.menu_item_id))
  const remainingPlates = plates.filter(p => !getCompletion(p.menu_item_id))

  const totalItems = plates.length + shadowedToday.length
  const totalCompleted = completedPlates.length + shadowedToday.length

  // Group plates by category
  const groupByCategory = (items: Plate[]) => {
    const groups: Record<string, { category: Category | null; colour: string; plates: Plate[] }> = {}
    for (const p of items) {
      const cat = p.menu_item?.category
      const key = cat?.id ?? 'uncategorised'
      if (!groups[key]) {
        groups[key] = {
          category: cat ?? null,
          colour: cat ? CATEGORY_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
          plates: [],
        }
      }
      groups[key].plates.push(p)
    }
    // Sort by category sort_order
    return Object.values(groups).sort((a, b) => (a.category?.sort_order ?? 99) - (b.category?.sort_order ?? 99))
  }

  // Group shadowed items by category
  const shadowedByCategory = useMemo(() => {
    const groups: Record<string, { category: Category | null; colour: string; completions: Completion[] }> = {}
    for (const c of shadowedToday) {
      const cat = c.menu_item?.category as Category | undefined
      const key = cat?.id ?? 'uncategorised'
      if (!groups[key]) {
        groups[key] = {
          category: cat ?? null,
          colour: cat ? CATEGORY_COLOURS[cat.name] ?? cat.colour_hex : '#C9A96E',
          completions: [],
        }
      }
      groups[key].completions.push(c)
    }
    return Object.values(groups)
  }, [shadowedToday])

  const remainingGroups = useMemo(() => groupByCategory(remainingPlates), [remainingPlates])
  const completedGroups = useMemo(() => groupByCategory(completedPlates), [completedPlates])

  if (plates.length === 0 && shadowedToday.length === 0) {
    return (
      <div className="px-5 py-8">
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-charcoal">Today&apos;s Plate</h1>
          <p className="text-sm text-charcoal/40 mt-1">{today}</p>
        </div>
        <div className="card p-8 text-center">
          <p className="text-4xl mb-4">◈</p>
          <p className="font-serif text-lg text-charcoal/60">Your plate is empty today.</p>
          <p className="text-sm text-charcoal/40 mt-2">Your manager hasn&apos;t assigned any training yet — or check the Menu to self-log a shadowing moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Today&apos;s Plate</h1>
        <p className="text-sm text-charcoal/40 mt-1">{today}</p>
      </div>

      {/* Progress summary */}
      <div className="card p-4 mb-6">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-charcoal/60">Today&apos;s progress</span>
          <span className="font-medium text-charcoal">{totalCompleted}/{totalItems}</span>
        </div>
        <div className="h-2 bg-charcoal/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${totalItems > 0 ? (totalCompleted / totalItems) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* To complete — grouped by category */}
      {remainingGroups.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">To complete</h2>
          <div className="space-y-3">
            {remainingGroups.map(group => (
              <CategoryGroup
                key={group.category?.id ?? 'none'}
                category={group.category}
                colour={group.colour}
                items={group.plates.map(p => ({
                  id: p.menu_item_id,
                  title: p.menu_item?.title ?? '',
                  timeNeeded: p.menu_item?.time_needed ?? '',
                  trainerType: p.menu_item?.trainer_type ?? '',
                  completed: false,
                }))}
                totalInCategory={group.plates.length}
                completedInCategory={0}
                onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed — grouped by category */}
      {(completedGroups.length > 0 || shadowedByCategory.length > 0) && (
        <div>
          <h2 className="text-xs font-medium text-charcoal/40 uppercase tracking-widest mb-3">Completed</h2>
          <div className="space-y-3 opacity-60">
            {completedGroups.map(group => (
              <CategoryGroup
                key={group.category?.id ?? 'none'}
                category={group.category}
                colour={group.colour}
                items={group.plates.map(p => ({
                  id: p.menu_item_id,
                  title: p.menu_item?.title ?? '',
                  timeNeeded: p.menu_item?.time_needed ?? '',
                  trainerType: p.menu_item?.trainer_type ?? '',
                  completed: true,
                  rating: getCompletion(p.menu_item_id)?.trainee_rating ?? undefined,
                }))}
                totalInCategory={group.plates.length}
                completedInCategory={group.plates.length}
                onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
              />
            ))}
            {shadowedByCategory.map(group => (
              <CategoryGroup
                key={`shadow-${group.category?.id ?? 'none'}`}
                category={group.category}
                colour={group.colour}
                items={group.completions.map(c => ({
                  id: c.menu_item_id,
                  title: c.menu_item?.title ?? '',
                  timeNeeded: c.menu_item?.time_needed ?? '',
                  trainerType: c.menu_item?.trainer_type ?? '',
                  completed: true,
                  shadowed: true,
                  rating: c.trainee_rating ?? undefined,
                }))}
                totalInCategory={group.completions.length}
                completedInCategory={group.completions.length}
                onItemClick={(itemId) => router.push(`/trainee/course/${itemId}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ItemInfo {
  id: string
  title: string
  timeNeeded: string
  trainerType: string
  completed: boolean
  shadowed?: boolean
  rating?: number
}

function CategoryGroup({
  category,
  colour,
  items,
  totalInCategory,
  completedInCategory,
  onItemClick,
}: {
  category: Category | null
  colour: string
  items: ItemInfo[]
  totalInCategory: number
  completedInCategory: number
  onItemClick: (itemId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
          style={{ backgroundColor: colour + '20', color: colour }}
        >
          {category?.icon ?? '◈'}
        </span>
        <div className="flex-1">
          <p className="font-medium text-charcoal text-[15px]">{category?.name ?? 'Other'}</p>
          <p className="text-xs text-charcoal/40 mt-0.5">{completedInCategory}/{totalInCategory} complete</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-1.5 bg-charcoal/8 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${totalInCategory > 0 ? (completedInCategory / totalInCategory) * 100 : 0}%`,
                backgroundColor: colour,
              }}
            />
          </div>
          {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/5 divide-y divide-black/5">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={`w-full px-5 py-3.5 flex items-center gap-3 text-left transition-colors ${item.completed ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-charcoal/2'}`}
            >
              <span
                className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center text-xs ${
                  item.completed ? 'border-transparent' : 'border-charcoal/20'
                }`}
                style={item.completed ? { backgroundColor: colour } : {}}
              >
                {item.completed && <span className="text-white text-[10px]">✓</span>}
              </span>
              <div className="flex-1">
                <p className={`text-[14px] leading-snug ${item.completed ? 'text-charcoal/40' : 'text-charcoal'}`}>
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-charcoal/35">{item.timeNeeded} · {item.trainerType}</p>
                  {item.shadowed && (
                    <span className="text-xs text-gold bg-gold/10 px-2 py-0.5 rounded-full">Shadowed</span>
                  )}
                </div>
              </div>
              {!item.completed && <span className="text-charcoal/20 text-lg">›</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
