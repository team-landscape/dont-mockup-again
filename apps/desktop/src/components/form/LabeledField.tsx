import type { ReactNode } from 'react';

interface LabeledFieldProps {
  label: string;
  children: ReactNode;
}

export function LabeledField({ label, children }: LabeledFieldProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
