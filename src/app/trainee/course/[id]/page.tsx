import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CourseBadge } from '@/components/ui/CourseBadge'

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: categoryItem } = await supabase
    .from('categories')
    .select('*, course:courses(*)')
    .eq('id', id)
    .single()

  if (!categoryItem) redirect('/trainee/menu')

  const course = categoryItem.course as { name: string; icon: string; colour_hex: string } | null

  return (
    <div className="px-5 py-6 max-w-lg mx-auto">
      <Link
        href="/trainee/menu"
        className="inline-flex items-center gap-1 text-sm text-charcoal/40 hover:text-charcoal/60 mb-4"
      >
        &larr; Back to Menu
      </Link>

      {course && (
        <div className="mb-3">
          <CourseBadge courseName={course.name} icon={course.icon} />
        </div>
      )}

      <h1 className="font-serif text-2xl text-charcoal mb-2">{categoryItem.title}</h1>

      {categoryItem.description && (
        <p className="text-sm text-charcoal/60 leading-relaxed mb-4">{categoryItem.description}</p>
      )}

      {categoryItem.tags && categoryItem.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {categoryItem.tags.map((tag: string) => (
            <span key={tag} className="px-2.5 py-1 bg-charcoal/5 text-charcoal/50 rounded-full text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="text-xs text-charcoal/30 space-y-1">
        <p>Trainer type: {categoryItem.trainer_type}</p>
        {categoryItem.difficulty_level && <p>Level: {categoryItem.difficulty_level}</p>}
      </div>
    </div>
  )
}
