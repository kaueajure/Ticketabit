import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="page-title-row">
      <div className="page-title-copy">
        <div className="page-kicker">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="title-actions">{actions}</div>}
    </header>
  );
}
