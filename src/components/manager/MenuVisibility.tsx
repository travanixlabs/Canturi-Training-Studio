'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Category, MenuItem } from '@/types'

interface Props {
  categories: Category[]
  menuItems: MenuItem[]
}

export function MenuVisibility({ categories, menuItems: initialItems }: Props) {
  const [menuItems, setMenuItems] = useState(initialItems)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const supabase = createClient()

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleVisibility(item: MenuItem) {
    const newValue = !item.is_visible
    setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_visible: newValue } : m))
    await supabase.from('menu_items').update({ is_visible: newValue }).eq('id', item.id)
  }

  async function toggleAllInCategory(categoryId: string, visible: boolean) {
    const items = menuItems.filter(m => m.category_id === categoryId)
    setMenuItems(prev => prev.map(m => m.category_id === categoryId ? { ...m, is_visible: visible } : m))
    await Promise.all(
      items.map(item => supabase.from('menu_items').update({ is_visible: visible }).eq('id', item.id))
    )
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="font-serif text-2xl text-charcoal">Menu Visibility</h1>
        <p className="text-sm text-charcoal/40 mt-1">Control which items employees can see</p>
      </div>

      <div className="space-y-2">
        {categories.map(category => {
          const items = menuItems.filter(i => i.category_id === category.id)
          const visibleCount = items.filter(i => i.is_visible).length
          const expanded = expandedCategories.has(category.id)
          const allVisible = visibleCount === items.length
          const noneVisible = visibleCount === 0

          return (
            <div key={category.id} className="card overflow-hidden">
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
                    <p className="text-xs text-charcoal/40 mt-0.5">
                      {visibleCount} of {items.length} visible
                    </p>
                  </div>
                  {expanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                </button>

                {/* Toggle all button */}
                <button
                  onClick={() => toggleAllInCategory(category.id, !allVisible)}
                  className={`mr-4 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    allVisible
                      ? 'bg-gold/10 text-gold'
                      : noneVisible
                      ? 'bg-charcoal/5 text-charcoal/40'
                      : 'bg-gold/5 text-gold/60'
                  }`}
                >
                  {allVisible ? 'Hide all' : 'Show all'}
                </button>
              </div>

              {expanded && (
                <div className="border-t border-black/5 divide-y divide-black/5">
                  {items.map(item => (
                    <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[14px] text-charcoal leading-snug">{item.title}</p>
                        <p className="text-xs text-charcoal/35 mt-0.5">{item.time_needed} · {item.trainer_type}</p>
                      </div>
                      <button
                        onClick={() => toggleVisibility(item)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          item.is_visible
                            ? 'bg-gold text-white shadow-sm'
                            : 'border-2 border-charcoal/15 text-charcoal/30 hover:border-gold hover:text-gold'
                        }`}
                      >
                        {item.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
