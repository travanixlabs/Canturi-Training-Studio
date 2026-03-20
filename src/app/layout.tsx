import type { Metadata } from 'next'
import { NavigationLoader } from '@/components/ui/NavigationLoader'
import './globals.css'

export const metadata: Metadata = {
  title: 'Canturi Training Studio',
  description: 'The Canturi boutique training program',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ivory">
        <NavigationLoader />
        {children}
      </body>
    </html>
  )
}
