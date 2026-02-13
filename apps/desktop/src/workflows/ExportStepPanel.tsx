import { ExportWorkflowPage } from './ExportWorkflowPage';

interface ExportStepPanelProps {
  outputDir: string;
  zipEnabled: boolean;
  metadataCsvEnabled: boolean;
  isBusy: boolean;
  exportStatus: string;
  exportError: string;
  onOutputDirChange: (value: string) => void;
  onPickOutputDir: () => void;
  canPickOutputDir: boolean;
  onZipEnabledChange: (checked: boolean) => void;
  onMetadataCsvEnabledChange: (checked: boolean) => void;
  onExport: () => Promise<void>;
}

export function ExportStepPanel({
  outputDir,
  zipEnabled,
  metadataCsvEnabled,
  isBusy,
  exportStatus,
  exportError,
  onOutputDirChange,
  onPickOutputDir,
  canPickOutputDir,
  onZipEnabledChange,
  onMetadataCsvEnabledChange,
  onExport
}: ExportStepPanelProps) {
  return (
    <ExportWorkflowPage
      outputDir={outputDir}
      zipEnabled={zipEnabled}
      metadataCsvEnabled={metadataCsvEnabled}
      isBusy={isBusy}
      exportStatus={exportStatus}
      exportError={exportError}
      onOutputDirChange={onOutputDirChange}
      onPickOutputDir={onPickOutputDir}
      canPickOutputDir={canPickOutputDir}
      onZipEnabledChange={onZipEnabledChange}
      onMetadataCsvEnabledChange={onMetadataCsvEnabledChange}
      onExport={onExport}
    />
  );
}
