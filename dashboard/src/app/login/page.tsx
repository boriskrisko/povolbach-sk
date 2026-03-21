'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError('Wrong password');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-8">
          <h1 className="text-xl font-bold tracking-tight mb-1" style={{ fontFamily: 'var(--font-syne)', letterSpacing: '-0.5px' }}>
            <span className="text-[#94a3b8]">dev.</span>
            <span className="text-[#f8fafc]">po</span>
            <span className="text-[#3b82f6]">volbach</span>
            <span className="text-[#94a3b8]">.sk</span>
          </h1>
          <p className="text-[#6b7280] text-sm mb-6">Internal dashboard</p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#1f2937] rounded-lg text-white placeholder-[#4b5563] focus:outline-none focus:border-[#3b82f6] transition-colors"
            />
            {error && (
              <p className="text-[#ef4444] text-sm mt-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 px-4 py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
