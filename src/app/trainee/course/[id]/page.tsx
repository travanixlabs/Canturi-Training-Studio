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

    </div>
  )
}
