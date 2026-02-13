import { useCallback } from 'react';

import type { Device } from '../lib/project-model';

interface UseOnboardingActionsArgs {
  onboardingReady: boolean;
  locales: string[];
  devices: Device[];
  onboardingStorageKey: string;
  setSelectedLocale: (value: string | ((current: string) => string)) => void;
  setSelectedDevice: (value: string | ((current: string) => string)) => void;
  setIsOnboardingOpen: (value: boolean) => void;
}

export function useOnboardingActions({
  onboardingReady,
  locales,
  devices,
  onboardingStorageKey,
  setSelectedLocale,
  setSelectedDevice,
  setIsOnboardingOpen
}: UseOnboardingActionsArgs) {
  const handleOpenOnboarding = useCallback(() => {
    setIsOnboardingOpen(true);
  }, [setIsOnboardingOpen]);

  const handleCompleteOnboarding = useCallback(() => {
    if (!onboardingReady) {
      return;
    }

    setSelectedLocale((current) => (
      locales.includes(current) ? current : locales[0]
    ));
    setSelectedDevice((current) => (
      devices.some((device) => device.id === current)
        ? current
        : (devices[0]?.id || 'ios_phone')
    ));

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(onboardingStorageKey, '1');
    }

    setIsOnboardingOpen(false);
  }, [
    devices,
    locales,
    onboardingReady,
    onboardingStorageKey,
    setIsOnboardingOpen,
    setSelectedDevice,
    setSelectedLocale
  ]);

  return {
    handleOpenOnboarding,
    handleCompleteOnboarding
  };
}
