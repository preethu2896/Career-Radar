export function LoadingSkeleton({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return <div className="loading-skeleton" role="status" aria-label={label}><span className="visually-hidden">{label}</span><div aria-hidden="true">{Array.from({ length: rows }, (_, i) => <span key={i} className={"skeleton-line " + (i === 0 ? "skeleton-line-title" : "")} />)}</div></div>;
}
