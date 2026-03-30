'use client'

import { useState } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface DeletedItem {
  id: string
  table: string
  label: string
  detail: string
  deleted_at: string
}

interface Props {
  items: DeletedItem[]
}

export function DeletionHistory({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [acting, setActing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DeletedItem | null>(null)
  const supabase = createClient()
  const router = useRouter()

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function daysRemaining(dateStr: string) {
    const deleted = new Date(dateStr).getTime()
    const expiry = deleted + 7 * 24 * 60 * 60 * 1000
    const remaining = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000))
    return Math.max(0, remaining)
  }

  async function recover(item: DeletedItem) {
    setActing(item.id)
    await supabase.from(item.table).update({ deleted_at: null }).eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setActing(null)
    router.refresh()
  }

  async function permanentDelete(item: DeletedItem) {
    setActing(item.id)
    await supabase.from(item.table).delete().eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setActing(null)
    setConfirmDelete(null)
    router.refresh()
  }

  const labelColour: Record<string, string> = {
    'Workshop': 'bg-gold/10 text-gold',
    'Category': 'bg-blue-50 text-blue-600',
    'Subcategory': 'bg-purple-50 text-purple-600',
    'Training Task': 'bg-emerald-50 text-emerald-600',
    'Content': 'bg-charcoal/5 text-charcoal/50',
  }

  return (
    <div className="px-5 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Deletion History</h1>
        <p className="text-sm text-charcoal/40 mt-1">Items are retained for 7 days before permanent deletion</p>
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-charcoal/40 text-sm">No deleted items</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const days = daysRemaining(item.deleted_at)
            return (
              <div key={`${item.table}-${item.id}`} className="card px-4 py-3 flex items-center gap-3">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${labelColour[item.label] || 'bg-charcoal/5 text-charcoal/50'}`}>
                  {item.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-charcoal truncate">{item.detail}</p>
                  <p className="text-[10px] text-charcoal/30 mt-0.5">
                    Deleted {formatDate(item.deleted_at)} · {days} day{days !== 1 ? 's' : ''} remaining
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => recover(item)}
                    disabled={acting === item.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-green-600 hover:bg-green-50 transition-all"
                    title="Recover"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(item)}
                    disabled={acting === item.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-charcoal/30 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Delete permanently"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm permanent delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/20" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-serif text-lg text-charcoal mb-2">Permanently Delete</h3>
            <p className="text-sm text-charcoal/60 mb-1">
              Are you sure you want to permanently delete this {confirmDelete.label.toLowerCase()}?
            </p>
            <p className="text-sm font-medium text-charcoal mb-4 truncate">{confirmDelete.detail}</p>
            <p className="text-xs text-red-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-charcoal/50 hover:text-charcoal rounded-xl border border-charcoal/15 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => permanentDelete(confirmDelete)}
                disabled={acting === confirmDelete.id}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {acting === confirmDelete.id ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
