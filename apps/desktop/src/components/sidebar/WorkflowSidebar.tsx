import { FolderDown, FolderUp, Save } from 'lucide-react';

import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface WorkflowSidebarStep {
  id: string;
  title: string;
}

interface WorkflowSidebarProps {
  projectPath: string;
  isBusy: boolean;
  projectStatus: string;
  projectError: string;
  steps: WorkflowSidebarStep[];
  activeStepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  onLoad: () => void | Promise<unknown>;
  onSave: () => void | Promise<unknown>;
  onNew: () => void | Promise<unknown>;
  onSetup: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function WorkflowSidebar({
  projectPath,
  isBusy,
  projectStatus,
  projectError,
  steps,
  activeStepIndex,
  isFirstStep,
  isLastStep,
  onLoad,
  onSave,
  onNew,
  onSetup,
  onPrev,
  onNext
}: WorkflowSidebarProps) {
  return (
    <div className="pointer-events-none fixed left-3 top-3 z-40 w-[220px]">
      <div className="pointer-events-auto space-y-2">
        <Card className="border bg-card/95 shadow-xl backdrop-blur">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-sm tracking-tight">Store Metadata Studio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-0">
            <p className="truncate text-[11px] text-muted-foreground" title={projectPath || ''}>
              {projectPath || 'Project path: unsaved project'}
            </p>
            <Button size="sm" disabled={isBusy} variant="outline" onClick={() => { void onLoad(); }}>
              <FolderDown className="mr-1 h-3.5 w-3.5" />
              Load
            </Button>
            <Button size="sm" disabled={isBusy} variant="outline" onClick={() => { void onSave(); }}>
              <Save className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
            <Button size="sm" disabled={isBusy} onClick={() => { void onNew(); }}>
              <FolderUp className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
            <Button size="sm" variant="secondary" onClick={onSetup}>Setup</Button>
            {projectStatus ? (
              <p className="text-[11px] text-muted-foreground">{projectStatus}</p>
            ) : null}
            {projectError ? (
              <p className="text-[11px] text-red-600">{projectError}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border bg-card/90 shadow-xl backdrop-blur">
          <CardHeader className="gap-1 pb-2">
            <CardTitle className="text-sm tracking-tight">Workflow</CardTitle>
            <CardDescription className="text-xs">Step {activeStepIndex + 1} / {steps.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {steps.map((step, index) => {
              const isCurrent = index === activeStepIndex;
              const isCompleted = index < activeStepIndex;
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${isCurrent
                    ? 'border-primary bg-primary/10'
                    : isCompleted
                      ? 'border-border bg-muted/40'
                      : 'border-border bg-background/60'
                    }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                      }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{step.title}</p>
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={isBusy || isFirstStep} onClick={onPrev}>
                Previous
              </Button>
              <Button size="sm" disabled={isBusy || isLastStep} onClick={onNext}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
