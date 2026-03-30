export type UserRole = 'trainee' | 'manager' | 'head_office'

export type ItemStatus = 'active' | 'hidden'

export interface Boutique {
  id: string
  name: string
  city: string
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  boutique_id: string
  avatar_initials: string
  created_at: string
  boutique?: Boutique
}

export interface Course {
  id: string
  name: string
  icon: string
  colour_hex: string
  sort_order: number
  status: ItemStatus
}

export interface Category {
  id: string
  title: string
  description: string
  course_id: string
  sort_order: number
  created_at: string
  course?: Course
}

export interface Subcategory {
  id: string
  category_id: string
  title: string
  content: string
  sort_order: number
  created_at: string
}

export type TrainerType = 'Self Directed' | 'Senior' | 'Manager'
export type Modality = 'Website Reference' | 'Online Tool' | 'Role Play' | 'Shadowing' | 'SOP' | 'Video' | 'Coaching Session' | 'Self Directed Task' | 'External Education' | 'Zoom Session' | 'Upskill Friday' | 'Workshop'
export type RoleLevel = 'Consultant' | 'Specialist' | 'Senior Specialist'
export type PriorityLevel = 'Essential' | 'Core' | 'Advanced'

export interface TrainingTask {
  id: string
  subcategory_id: string
  title: string
  trainer_type: TrainerType | ''
  modality: Modality | ''
  role_level: RoleLevel | ''
  priority_level: PriorityLevel | ''
  prerequisites: string[]
  is_recurring: boolean
  recurring_count: number | null
  certificate_required: boolean
  rewards_eligible: boolean
  tags: string[]
  description: string
  content: string
  sort_order: number
  created_at: string
}

export type AttachmentType = 'text' | 'webpage' | 'image' | 'video' | 'pdf'

export interface TrainingTaskContent {
  id: string
  training_task_id: string
  type: AttachmentType
  title: string
  url: string
  sort_order: number
  created_at: string
}

export interface Workshop {
  id: string
  name: string
  tags: string[]
  status: 'active' | 'hidden'
  created_at: string
}

export interface WorkshopCourse {
  id: string
  workshop_id: string
  course_id: string
  created_at: string
  course?: Course
}

// Course colour mapping
export const COURSE_COLOURS: Record<string, string> = {
  'Services': '#8B6355',
  'Product Knowledge': '#4A6B8A',
  'Boutique': '#6B8C6B',
  'Administration': '#7A7068',
  'Diamonds': '#7B6B9A',
  'Deliveries': '#7A7355',
  'Client Experience': '#9A6B70',
}

export const COURSE_BG_COLOURS: Record<string, string> = {
  'Services': '#F5EDE9',
  'Product Knowledge': '#E8F0F7',
  'Boutique': '#EBF3EB',
  'Administration': '#EEECEA',
  'Diamonds': '#EEEBF5',
  'Deliveries': '#EEEEE6',
  'Client Experience': '#F5EAEB',
}
