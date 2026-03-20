export type UserRole = 'trainee' | 'manager' | 'head_office'

export type TrainerType = 'Self' | 'Manager' | 'Self/Manager'

export interface Boutique {
  id: string
  name: string
  city: string
  manager_ids: string[]
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

export interface Category {
  id: string
  name: string
  icon: string
  colour_hex: string
  sort_order: number
}

export interface MenuItem {
  id: string
  title: string
  description: string
  category_id: string
  tags: string[]
  time_needed: string
  trainer_type: TrainerType
  resource_link: string | null
  boutique_id: string | null
  is_visible: boolean
  created_at: string
  category?: Category
}

export interface Plate {
  id: string
  trainee_id: string
  menu_item_id: string
  assigned_by: string
  date_assigned: string
  boutique_id: string
  menu_item?: MenuItem
  trainee?: User
  assigned_by_user?: User
}

export interface Completion {
  id: string
  plate_id: string | null
  menu_item_id: string
  trainee_id: string
  trainer_id: string | null
  trainee_notes: string | null
  trainer_notes: string | null
  trainee_rating: number | null
  trainer_rating: number | null
  completed_date: string
  is_shadowing_moment: boolean
  created_at: string
  menu_item?: MenuItem
  trainee?: User
}

// Category colour mapping
export const CATEGORY_COLOURS: Record<string, string> = {
  'Services': '#8B6355',
  'Product Knowledge': '#4A6B8A',
  'Boutique': '#6B8C6B',
  'Administration': '#7A7068',
  'Diamonds': '#7B6B9A',
  'Deliveries': '#7A7355',
  'Client Experience': '#9A6B70',
}

export const CATEGORY_BG_COLOURS: Record<string, string> = {
  'Services': '#F5EDE9',
  'Product Knowledge': '#E8F0F7',
  'Boutique': '#EBF3EB',
  'Administration': '#EEECEA',
  'Diamonds': '#EEEBF5',
  'Deliveries': '#EEEEE6',
  'Client Experience': '#F5EAEB',
}
