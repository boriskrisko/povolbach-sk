export default function EligibilityBadge({
  label,
  matched,
}: {
  label: string
  matched: boolean
}) {
  return (
    <div
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
        matched
          ? 'bg-green-900/20 text-green-400'
          : 'bg-red-900/20 text-red-400'
      }`}
    >
      <span>{matched ? '✓' : '✗'}</span>
      <span>{label}</span>
    </div>
  )
}
