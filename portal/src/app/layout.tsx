import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'portal.povolbach.sk — Výzvy EÚ fondov pre samosprávy',
  description:
    'Bezplatné notifikácie o nových výzvach EÚ fondov pre vašu samosprávu. Žiadne výzvy vám už neuniknú.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sk" className="dark">
      <body className="bg-background text-text-primary antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
