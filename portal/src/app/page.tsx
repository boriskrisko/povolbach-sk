import Link from 'next/link'
import Header from '@/components/Header'
import Logo from '@/components/Logo'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
        <div className="mb-8">
          <Logo className="text-3xl sm:text-4xl" />
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-bold mb-6 leading-tight">
          Idú voľby - sľubujte vo veľkom.
          <br />
          <span className="text-accent">My vám sľuby po voľbách pomôžeme splniť.</span>
        </h1>
        <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto">
          Nástroje pre modernú, efektívnu a ambicióznu samosprávu.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition"
          >
            Zaregistrovať sa zadarmo
          </Link>
          <Link
            href="/login"
            className="text-gray-400 hover:text-white transition text-sm"
          >
            Už máte účet? Prihlásiť sa →
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-surface/50 py-6">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-6 text-sm text-text-secondary">
          <span>
            <strong className="text-white">2 926</strong> samospráv
          </span>
          <span className="text-gray-700">·</span>
          <span>
            <strong className="text-white">8</strong> VÚC
          </span>
          <span className="text-gray-700">·</span>
          <span>
            <strong className="text-white">141</strong> miest
          </span>
          <span className="text-gray-700">·</span>
          <span className="text-green-400 font-medium">Bezplatne navždy</span>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <h2 className="font-display text-2xl font-bold text-center mb-12">Ako to funguje</h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Zaregistrujte sa s IČO',
              desc: 'Zadajte IČO vašej samosprávy a my automaticky nájdeme váš profil.',
            },
            {
              step: '2',
              title: 'Nájdeme relevantné výzvy',
              desc: 'Systém porovná váš typ, región a veľkosť s podmienkami výziev.',
            },
            {
              step: '3',
              title: 'Dostanete notifikáciu',
              desc: 'Keď sa objaví nová relevantná výzva, okamžite vás upozorníme.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-surface border border-border rounded-xl p-6 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center mx-auto mb-4 font-mono">
                {item.step}
              </div>
              <h3 className="font-display font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-text-secondary">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 pb-20 text-center">
        <div className="bg-surface border border-border rounded-2xl p-10">
          <h2 className="font-display text-2xl font-bold mb-4">
            Začnite sledovať výzvy ešte dnes
          </h2>
          <p className="text-text-secondary mb-8">
            Registrácia trvá 30 sekúnd. Stačí IČO a email.
          </p>
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3.5 rounded-xl text-lg transition inline-block"
          >
            Zaregistrovať sa zadarmo
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-secondary">
          <Logo />
          <p>
            Súčasť projektu{' '}
            <a
              href="https://povolbach.sk"
              className="text-blue-400 hover:text-blue-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              povolbach.sk
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
