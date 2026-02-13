import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';

interface WorkflowStep<T extends string> {
  id: T;
}

interface UseWorkflowNavigationParams<T extends string> {
  steps: WorkflowStep<T>[];
  activeStep: T;
  setActiveStep: Dispatch<SetStateAction<T>>;
}

interface UseWorkflowNavigationResult<T extends string> {
  activeStepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  goPrevStep: () => void;
  goNextStep: () => void;
}

export function useWorkflowNavigation<T extends string>({
  steps,
  activeStep,
  setActiveStep
}: UseWorkflowNavigationParams<T>): UseWorkflowNavigationResult<T> {
  const activeStepIndex = useMemo(
    () => Math.max(steps.findIndex((item) => item.id === activeStep), 0),
    [activeStep, steps]
  );
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === steps.length - 1;

  const goPrevStep = useCallback(() => {
    if (activeStepIndex === 0) return;
    setActiveStep(steps[activeStepIndex - 1].id);
  }, [activeStepIndex, setActiveStep, steps]);

  const goNextStep = useCallback(() => {
    if (activeStepIndex >= steps.length - 1) return;
    setActiveStep(steps[activeStepIndex + 1].id);
  }, [activeStepIndex, setActiveStep, steps]);

  return {
    activeStepIndex,
    isFirstStep,
    isLastStep,
    goPrevStep,
    goNextStep
  };
}
