'use client'

import { useState, useMemo } from 'react'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import { CourseBadge } from '@/components/ui/CourseBadge'
import { COURSE_COLOURS } from '@/types'
import type { Course, Category, User, Workshop, WorkshopCourse } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  courses: Course[]
  categories: Category[]
  currentUser: User
  workshops?: Workshop[]
  workshopCourses?: WorkshopCourse[]
}

export function TraineeMenu({ courses, categories, currentUser, workshops = [], workshopCourses = [] }: Props) {
  const [search, setSearch] = useState('')
  const [expandedWorkshops, setExpandedWorkshops] = useState<Set<string>>(new Set())
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const router = useRouter()

  const filteredItems = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.toLowerCase()
    return categories.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [categories, search])

  const isSearching = search.trim().length > 0

  function toggleWorkshop(id: string) {
    setExpandedWorkshops(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCategory(id: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const workshopHierarchy = useMemo(() => {
    return workshops.map(ws => {
      const courseIds = new Set(workshopCourses.filter(wc => wc.workshop_id === ws.id).map(wc => wc.course_id))
      const wsCourses = courses.filter(c => courseIds.has(c.id)).sort((a, b) => a.sort_order - b.sort_order)
      return { workshop: ws, courses: wsCourses }
    }).filter(ws => ws.courses.length > 0)
  }, [workshops, workshopCourses, courses])

  function highlightText(text: string, query: string) {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-gold/25 text-charcoal rounded px-0.5">{part}</mark>
        : part
    )
  }

  return (
    <>
      <div className="px-5 py-6">
        <div className="mb-5">
          <h1 className="font-serif text-2xl text-charcoal">Training Menu</h1>
          <p className="text-sm text-charcoal/40 mt-1">Browse all training topics</p>
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/30" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topics, tags..."
            className="input pl-10 pr-10"
            autoComplete="off"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search results */}
        {isSearching && (
          <div className="mb-2">
            <p className="text-xs text-charcoal/40 mb-3">
              {filteredItems.length === 0 ? 'No results' : `${filteredItems.length} result${filteredItems.length !== 1 ? 's' : ''}`}
            </p>
            {filteredItems.length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-charcoal/40 text-sm">No training items match &quot;{search}&quot;</p>
              </div>
            )}
            <div className="space-y-2">
              {filteredItems.map(item => (
                <CategoryCard
                  key={item.id}
                  item={item}
                  searchQuery={search}
                  highlightText={highlightText}
                  onOpen={() => router.push(`/trainee/course/${item.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Workshop > Course > Category browse (when not searching) */}
        {!isSearching && (
          <div className="space-y-3">
            {workshopHierarchy.map(({ workshop, courses: wsCourses }) => {
              const wsExpanded = expandedWorkshops.has(workshop.id)
              const wsItems = categories.filter(mi => wsCourses.some(c => c.id === mi.course_id))

              const allCourseKeys = wsCourses.map(c => `${workshop.id}-${c.id}`)
              const allCoursesExpanded = allCourseKeys.length > 0 && allCourseKeys.every(k => expandedCategories.has(k))

              return (
                <div key={workshop.id} className="card overflow-hidden">
                  {/* Workshop header */}
                  <button
                    onClick={() => toggleWorkshop(workshop.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-sm flex-shrink-0 text-gold font-serif">
                      W
                    </span>
                    <div className="flex-1">
                      <p className="font-serif font-medium text-charcoal text-[16px]">{workshop.name}</p>
                      <p className="text-xs text-charcoal/40 mt-0.5">{wsItems.length} topic{wsItems.length !== 1 ? 's' : ''} · {wsCourses.length} course{wsCourses.length !== 1 ? 's' : ''}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (allCoursesExpanded) {
                            setExpandedCategories(prev => {
                              const next = new Set(prev)
                              for (const k of allCourseKeys) next.delete(k)
                              return next
                            })
                            setExpandedWorkshops(prev => {
                              const next = new Set(prev)
                              next.delete(workshop.id)
                              return next
                            })
                          } else {
                            setExpandedCategories(prev => {
                              const next = new Set(prev)
                              for (const k of allCourseKeys) next.add(k)
                              return next
                            })
                            setExpandedWorkshops(prev => new Set(prev).add(workshop.id))
                          }
                        }}
                        className="text-xs font-medium text-gold hover:text-gold/80 transition-colors mt-1"
                      >
                        {allCoursesExpanded ? 'Collapse all' : 'Expand all'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {wsExpanded ? <ChevronUp size={16} className="text-charcoal/30" /> : <ChevronDown size={16} className="text-charcoal/30" />}
                    </div>
                  </button>

                  {/* Courses inside this workshop */}
                  {wsExpanded && (
                    <div className="border-t border-black/5">
                      {wsCourses.map(category => {
                        const catItems = wsItems.filter(i => i.course_id === category.id)
                        const catKey = `${workshop.id}-${category.id}`
                        const catExpanded = expandedCategories.has(catKey)

                        return (
                          <div key={category.id}>
                            {/* Course header */}
                            <button
                              onClick={() => toggleCategory(catKey)}
                              className="w-full pl-8 pr-5 py-3 flex items-center gap-3 text-left hover:bg-charcoal/2 transition-colors border-b border-black/5"
                            >
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                                style={{ backgroundColor: category.colour_hex + '20', color: category.colour_hex }}
                              >
                                {category.icon}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium text-charcoal text-[14px]">{category.name}</p>
                                <p className="text-xs text-charcoal/40 mt-0.5">{catItems.length} topic{catItems.length !== 1 ? 's' : ''}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {catExpanded ? <ChevronUp size={14} className="text-charcoal/30" /> : <ChevronDown size={14} className="text-charcoal/30" />}
                              </div>
                            </button>

                            {/* Categories (menu items) inside this course */}
                            {catExpanded && (
                              <div className="divide-y divide-black/5 bg-charcoal/[0.01]">
                                {catItems.map(item => (
                                  <button
                                    key={item.id}
                                    onClick={() => router.push(`/trainee/course/${item.id}`)}
                                    className="w-full pl-12 pr-5 py-3.5 flex items-center gap-3 text-left transition-colors hover:bg-charcoal/2"
                                  >
                                    <span className="w-5 h-5 rounded-full border border-charcoal/20 flex-shrink-0" />
                                    <div className="flex-1">
                                      <p className="text-[14px] leading-snug text-charcoal">{item.title}</p>
                                    </div>
                                    <span className="text-charcoal/20 text-lg">&rsaquo;</span>
                                  </button>
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
    </>
  )
}

function CategoryCard({
  item,
  searchQuery,
  highlightText,
  onOpen,
}: {
  item: Category
  searchQuery: string
  highlightText: (text: string, query: string) => React.ReactNode
  onOpen: () => void
}) {
  const colour = item.course ? COURSE_COLOURS[item.course.name] ?? '#C9A96E' : '#C9A96E'

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left p-4 hover:shadow-md transition-shadow relative overflow-hidden"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: colour }}
      />
      <div className="pl-3">
        {item.course && (
          <CourseBadge courseName={item.course.name} icon={item.course.icon} />
        )}
        <p className="font-medium text-charcoal text-[15px] mt-1.5 leading-snug">
          {highlightText(item.title, searchQuery)}
        </p>
        <p className="text-xs text-charcoal/50 mt-1 line-clamp-2 leading-relaxed">
          {highlightText(item.description, searchQuery)}
        </p>
      </div>
    </button>
  )
}
