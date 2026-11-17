export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="at-skeleton-table" role="status" aria-label="Cargando datos">
      <div
        className="at-skeleton-row at-skeleton-header"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="at-skeleton-box"
            style={{ height: 12, width: i === 0 ? "50%" : "70%" }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="at-skeleton-row"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <div key={c}>
              <div className="at-skeleton-box at-skeleton-line" />
              {c === 0 && <div className="at-skeleton-box at-skeleton-line short" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="at-skeleton-cards" role="status" aria-label="Cargando tarjetas">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="at-skeleton-card">
          <div className="at-skeleton-box" style={{ height: 18, width: "65%" }} />
          <div className="at-skeleton-box" style={{ height: 24, width: "40%" }} />
          <div className="at-skeleton-box" style={{ height: 14, width: "85%" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <div className="at-skeleton-box" style={{ height: 32, width: 80 }} />
            <div className="at-skeleton-box" style={{ height: 32, width: 80 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
