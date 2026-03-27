'use client'

import type { Course, Category, Workshop, WorkshopCategory } from '@/types'

interface Props {
  courses: Course[]
  categories: Category[]
  workshops?: Workshop[]
  workshopCategories?: WorkshopCategory[]
}

export function TraineeProgress({ courses, categories, workshops = [], workshopCategories = [] }: Props) {
  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">My Progress</h1>
      </div>

      <div className="card p-6 text-center">
        <p className="text-charcoal/40 text-sm">Progress tracking coming soon</p>
      </div>
    </div>
  )
}
