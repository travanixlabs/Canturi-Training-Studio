export default function Loading() {
  return (
    <div className="px-5 py-6 loading-shimmer">
      <div className="h-8 w-56 bg-charcoal/8 rounded-lg mb-2" />
      <div className="h-4 w-36 bg-charcoal/5 rounded mb-6" />
      <div className="h-4 w-24 bg-charcoal/5 rounded mb-2" />
      <div className="flex gap-2 mb-6">
        {[1, 2].map(i => (
          <div key={i} className="h-11 w-40 bg-charcoal/5 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-4">
            <div className="h-5 w-36 bg-charcoal/8 rounded mb-1" />
            <div className="h-3 w-24 bg-charcoal/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
