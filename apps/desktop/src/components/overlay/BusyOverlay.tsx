import { Loader2 } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface BusyOverlayProps {
  open: boolean;
  title: string;
  detail: string;
}

export function BusyOverlay({ open, title, detail }: BusyOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-[440px] shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin" />
            {title}
          </CardTitle>
          <CardDescription>{detail}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
