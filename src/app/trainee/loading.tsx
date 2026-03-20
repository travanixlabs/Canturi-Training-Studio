export default function Loading() {
  return (
    <div className="px-5 py-6 loading-shimmer">
      <div className="h-8 w-48 bg-charcoal/8 rounded-lg mb-2" />
      <div className="h-4 w-32 bg-charcoal/5 rounded mb-6" />
      <div className="card p-4 mb-6">
        <div className="h-4 w-full bg-charcoal/5 rounded mb-2" />
        <div className="h-2 w-full bg-charcoal/8 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4">
            <div className="h-3 w-20 bg-charcoal/5 rounded mb-2" />
            <div className="h-5 w-48 bg-charcoal/8 rounded mb-2" />
            <div className="h-3 w-32 bg-charcoal/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
