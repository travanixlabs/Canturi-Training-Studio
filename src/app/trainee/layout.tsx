import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/ui/AppHeader'
import { TraineeNav } from '@/components/trainee/TraineeNav'
import type { User } from '@/types'

export default async function TraineeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*, boutique:boutiques(*)')
    .eq('id', authUser.id)
    .single()

  if (!profile || profile.role !== 'trainee') redirect('/login')

  return (
    <div className="min-h-screen flex flex-col bg-ivory">
      <AppHeader user={profile as User} title="Training Studio" />
      <TraineeNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
