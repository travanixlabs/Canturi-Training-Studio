export default function Loading() {
  return (
    <div className="px-5 py-6 max-w-3xl mx-auto loading-shimmer">
      <div className="h-8 w-40 bg-charcoal/8 rounded-lg mb-2" />
      <div className="h-4 w-48 bg-charcoal/5 rounded mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-5">
            <div className="h-6 w-28 bg-charcoal/8 rounded mb-2" />
            <div className="h-3 w-20 bg-charcoal/5 rounded mb-3" />
            <div className="h-1.5 w-full bg-charcoal/8 rounded-full mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-charcoal/5 rounded" />
              <div className="h-3 w-3/4 bg-charcoal/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
