import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'Bliss — Wedding Planning Made Calm',
  description: 'A warm, stage-by-stage wedding planning companion. Never overwhelming. Always one clear next step.',
  openGraph: {
    title: 'Bliss',
    description: 'Wedding planning the way it should feel.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
        <body className="bg-bliss-surface text-bliss-ink antialiased font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
