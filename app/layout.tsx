import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { GameProvider } from '@/lib/game-context'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' })
const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: '--font-poppins'
})

export const metadata: Metadata = {
  title: 'InnoQuest Labs Interactive',
  description: 'Step into the arena. Compete in real-time business simulations, make high-stakes decisions, and see how your strategy stacks up against the competition.',
  generator: 'v0.app',
  openGraph: {
    title: 'InnoQuest Labs Interactive',
    description: 'Step into the arena. Compete in real-time business simulations, make high-stakes decisions, and see how your strategy stacks up against the competition.',
    type: 'website',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#E63946',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} font-sans antialiased bg-background text-foreground`}>
        <GameProvider>
          {children}
        </GameProvider>
        <Analytics />
        <footer style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '11px',
          color: '#9CA3AF',
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(4px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          zIndex: 50,
        }}>
          © Copyright, Confidential, Proprietary to InnoQuest Gamification Labs 2026.
        </footer>
      </body>
    </html>
  )
}
