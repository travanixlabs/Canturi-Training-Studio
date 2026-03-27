import { redirect } from 'next/navigation'

export default function SignOffPage() {
  redirect('/manager/progress')
}
