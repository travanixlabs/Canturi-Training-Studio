import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CourseBadge } from '@/components/ui/CourseBadge'
import type { Subcategory, TrainingTask, TrainingTaskContent } from '@/types'

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const [{ data: categoryItem }, { data: subcategories }, { data: trainingTasks }, { data: taskContent }] = await Promise.all([
    supabase.from('categories').select('*, course:courses(*)').eq('id', id).single(),
    supabase.from('subcategories').select('*').eq('category_id', id).order('sort_order'),
    supabase.from('training_tasks').select('*').order('sort_order'),
    supabase.from('training_task_content').select('*').order('sort_order'),
  ])

  if (!categoryItem) redirect('/trainee/menu')

  const course = categoryItem.course as { name: string; icon: string; colour_hex: string } | null

  // Filter tasks to only those belonging to subcategories in this category
  const subIds = new Set((subcategories ?? []).map(s => s.id))
  const tasks = (trainingTasks ?? []).filter(t => subIds.has(t.subcategory_id)) as TrainingTask[]
  const content = (taskContent ?? []) as TrainingTaskContent[]

  const getTasksForSub = (subId: string) => tasks.filter(t => t.subcategory_id === subId)
  const getContentForTask = (taskId: string) => content.filter(c => c.training_task_id === taskId)

  function getEmbedUrl(url: string): string {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/)
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return url
  }

  function isEmbeddable(url: string) {
    return url.includes('youtube') || url.includes('vimeo') || url.includes('youtu.be')
  }

  return (
    <div className="px-5 py-6 max-w-2xl mx-auto">
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
        <p className="text-sm text-charcoal/60 leading-relaxed mb-6">{categoryItem.description}</p>
      )}

      {/* Subcategories */}
      {(subcategories ?? []).length > 0 && (
        <div className="space-y-8">
          {(subcategories as Subcategory[]).map((sub, subIdx) => {
            const subTasks = getTasksForSub(sub.id)

            return (
              <div key={sub.id}>
                {/* Subcategory header */}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-xs font-medium text-charcoal/30 uppercase tracking-wider flex-shrink-0">
                    {subIdx + 1}
                  </span>
                  <h2 className="font-serif text-lg text-charcoal">{sub.title}</h2>
                </div>

                {sub.content && (
                  <p className="text-sm text-charcoal/60 leading-relaxed mb-4 ml-7">{sub.content}</p>
                )}

                {/* Training tasks */}
                {subTasks.length > 0 && (
                  <div className="ml-7 space-y-4">
                    {subTasks.map((task, taskIdx) => {
                      const taskContent = getContentForTask(task.id)

                      return (
                        <div key={task.id} className="card p-4">
                          {/* Task header */}
                          <div className="flex items-start gap-3 mb-2">
                            <span className="w-6 h-6 rounded-full bg-charcoal/8 flex items-center justify-center text-[10px] text-charcoal/40 flex-shrink-0 mt-0.5">
                              {taskIdx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-charcoal leading-snug">{task.title}</p>
                              {task.trainer_type && (
                                <p className="text-xs text-charcoal/40 mt-0.5">{task.trainer_type}</p>
                              )}
                            </div>
                          </div>

                          {/* Task content */}
                          {taskContent.length > 0 && (
                            <div className="ml-9 space-y-3 mt-3">
                              {taskContent.map(c => (
                                <div key={c.id}>
                                  {c.title && c.type !== 'text' && (
                                    <p className="text-xs font-medium text-charcoal/50 mb-1">{c.title}</p>
                                  )}

                                  {c.type === 'text' && c.url && (
                                    <div className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{c.url}</div>
                                  )}

                                  {c.type === 'webpage' && c.url && (
                                    <a
                                      href={c.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold/80 underline underline-offset-2"
                                    >
                                      {c.url}
                                    </a>
                                  )}

                                  {c.type === 'image' && c.url && (
                                    <img src={c.url} alt={c.title || ''} className="max-w-full rounded-lg border border-black/5" />
                                  )}

                                  {c.type === 'video' && c.url && (
                                    isEmbeddable(c.url) ? (
                                      <div className="rounded-lg overflow-hidden" style={{ height: '280px' }}>
                                        <iframe
                                          src={getEmbedUrl(c.url)}
                                          className="w-full h-full border-0"
                                          title={c.title || 'Video'}
                                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                          allowFullScreen
                                        />
                                      </div>
                                    ) : (
                                      <video src={c.url} controls className="max-w-full rounded-lg" />
                                    )
                                  )}

                                  {c.type === 'pdf' && c.url && (
                                    <div className="rounded-lg overflow-hidden border border-black/5" style={{ height: '350px' }}>
                                      <iframe src={c.url} className="w-full h-full border-0" title={c.title || 'PDF'} />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
