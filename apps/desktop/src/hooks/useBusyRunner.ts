import { useCallback } from 'react';
import { flushSync } from 'react-dom';

export interface BusyRunOptions {
  action?: string;
  title?: string;
  detail?: string;
}

export interface BusyHelpers {
  setTitle: (value: string) => void;
  setDetail: (value: string) => void;
}

interface UseBusyRunnerArgs {
  setIsBusy: (value: boolean) => void;
  setBusyTitle: (value: string) => void;
  setBusyDetail: (value: string) => void;
}

export function useBusyRunner({
  setIsBusy,
  setBusyTitle,
  setBusyDetail
}: UseBusyRunnerArgs) {
  return useCallback(
    async (action: (helpers: BusyHelpers) => Promise<void>, options: BusyRunOptions = {}) => {
      const updateTitle = (value: string) => setBusyTitle(value);
      const updateDetail = (value: string) => setBusyDetail(value);

      flushSync(() => {
        setBusyTitle(options.title || 'Processing');
        setBusyDetail(options.detail || 'Please wait...');
        setIsBusy(true);
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (typeof window !== 'undefined') {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      }
      try {
        await action({ setTitle: updateTitle, setDetail: updateDetail });
      } finally {
        setIsBusy(false);
        setBusyTitle('');
        setBusyDetail('');
      }
    },
    [setBusyDetail, setBusyTitle, setIsBusy]
  );
}
