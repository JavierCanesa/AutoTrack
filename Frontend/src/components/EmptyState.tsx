import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="at-empty-state" role="status">
      <div className="at-empty-icon">
        {icon || (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </div>
      <h3 className="at-empty-title">{title}</h3>
      {description && <p className="at-empty-desc">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
