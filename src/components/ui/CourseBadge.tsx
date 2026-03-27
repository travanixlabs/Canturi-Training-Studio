import { COURSE_COLOURS, COURSE_BG_COLOURS } from '@/types'

interface Props {
  courseName: string
  icon?: string
  size?: 'sm' | 'md'
}

export function CourseBadge({ courseName, icon, size = 'sm' }: Props) {
  const colour = COURSE_COLOURS[courseName] ?? '#C9A96E'
  const bg = COURSE_BG_COLOURS[courseName] ?? '#FAF3E8'

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'}`}
      style={{ color: colour, backgroundColor: bg }}
    >
      {icon && <span>{icon}</span>}
      {courseName}
    </span>
  )
}
