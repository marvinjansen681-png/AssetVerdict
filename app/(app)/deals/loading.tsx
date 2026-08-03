export default function DealsLoading() {
  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 w-40 rounded bg-av-light-grey animate-pulse" />
        <div className="h-10 w-32 rounded bg-av-light-grey animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-lg bg-av-light-grey animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
