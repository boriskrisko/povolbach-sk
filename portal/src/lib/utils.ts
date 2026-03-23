export function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function formatEur(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function deadlineColor(days: number | null): string {
  if (days == null) return 'text-gray-400'
  if (days < 7) return 'text-red-400'
  if (days < 30) return 'text-amber-400'
  return 'text-green-400'
}

export function deadlineBadgeColor(days: number | null): string {
  if (days == null) return 'bg-gray-800 text-gray-400'
  if (days < 7) return 'bg-red-900/50 text-red-400'
  if (days < 30) return 'bg-amber-900/50 text-amber-400'
  return 'bg-green-900/50 text-green-400'
}
