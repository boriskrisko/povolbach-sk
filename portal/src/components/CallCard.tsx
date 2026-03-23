import Link from 'next/link'
import { type FundCall } from '@/lib/types'
import { formatEur, daysUntil, deadlineBadgeColor, formatDate } from '@/lib/utils'

export default function CallCard({ call, matchReasons }: { call: FundCall; matchReasons?: string[] | null }) {
  const days = daysUntil(call.deadline)

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-sm font-medium text-white leading-snug line-clamp-2">
          {call.title}
        </h3>
        {days != null && (
          <span
            className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${deadlineBadgeColor(days)}`}
          >
            {days > 0 ? `${days} dní` : 'Uzavretá'}
          </span>
        )}
      </div>

      <div className="space-y-1.5 text-xs text-gray-400 mb-4">
        {call.program && <p>{call.program}</p>}
        {call.managing_authority && (
          <p>Riadiaci orgán: {call.managing_authority}</p>
        )}
        <div className="flex items-center gap-4">
          {call.max_grant_eur && (
            <span>Max. grant: {formatEur(call.max_grant_eur)}</span>
          )}
          {call.deadline && (
            <span>Uzávierka: {formatDate(call.deadline)}</span>
          )}
        </div>
      </div>

      {matchReasons && matchReasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {matchReasons.map((reason) => (
            <span
              key={reason}
              className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full"
            >
              {reason} ✓
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/calls/${call.id}`}
        className="text-sm text-blue-400 hover:text-blue-300 transition"
      >
        Zobraziť detail →
      </Link>
    </div>
  )
}
