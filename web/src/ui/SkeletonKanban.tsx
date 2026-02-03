export function SkeletonKanban() {
  return (
    <div className="board-wrapper">
      <div className="kanban">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kanban-col">
            <div className="kanban-col-head">
              <div className="skeleton" style={{ width: 120, height: 16 }} />
            </div>
            <div className="kanban-col-body">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="skeleton skeleton-card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
