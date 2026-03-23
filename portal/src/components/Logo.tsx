export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold text-xl tracking-tight ${className}`}>
      <span className="text-text-primary">po</span>
      <span className="text-accent">volbach</span>
      <span className="text-text-secondary">.sk</span>
      <span className="text-text-secondary/60 font-normal text-sm ml-1">portál</span>
    </span>
  )
}
