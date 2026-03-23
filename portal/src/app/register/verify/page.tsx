'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { Suspense } from 'react'

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-6">
        <Link href="/">
          <Logo className="text-2xl" />
        </Link>
      </div>

      <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6">
        <svg
          className="w-8 h-8 text-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      <h1 className="font-display text-2xl font-bold mb-3">
        Overte vašu emailovú adresu
      </h1>
      <p className="text-text-secondary mb-2">
        Na adresu{' '}
        {email ? (
          <span className="text-text-primary font-medium">{email}</span>
        ) : (
          'vašu emailovú adresu'
        )}{' '}
        sme odoslali overovací email.
      </p>
      <p className="text-text-secondary mb-8">
        Kliknutím na odkaz v emaile aktivujete váš účet.
      </p>

      <p className="text-text-secondary/60 text-sm mb-8">
        Neprišiel email? Skontrolujte priečinok spam.
      </p>

      <Link
        href="/login"
        className="inline-block bg-accent hover:bg-accent/80 text-white font-medium px-8 py-3 rounded-xl transition"
      >
        Prejsť na prihlásenie
      </Link>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
