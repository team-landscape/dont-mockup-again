import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { getDefaultExportDir, isTauriRuntime } from '../lib/desktop-runtime';
import { appendPathSegment } from '../lib/project-model';

interface UseProjectBootstrapPathsArgs {
  defaultProjectFileName: string;
  setOutputDir: Dispatch<SetStateAction<string>>;
  setProjectPath: Dispatch<SetStateAction<string>>;
}

export function useProjectBootstrapPaths({
  defaultProjectFileName,
  setOutputDir,
  setProjectPath
}: UseProjectBootstrapPathsArgs) {
  const [defaultExportDir, setDefaultExportDir] = useState('');
  const [isProjectBaselineReady, setIsProjectBaselineReady] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) {
      setIsProjectBaselineReady(true);
      return;
    }

    getDefaultExportDir()
      .then((path) => {
        if (!path || !path.trim()) return;
        setDefaultExportDir(path);
        setOutputDir((current) => {
          const normalized = current.trim();
          if (!normalized || normalized === 'dist') {
            return path;
          }
          return current;
        });
        setProjectPath((current) => {
          if (current.trim()) return current;
          return appendPathSegment(path, defaultProjectFileName);
        });
      })
      .catch(() => {
        setProjectPath((current) => (current.trim() ? current : defaultProjectFileName));
        // Fallback to static default when system export path lookup fails.
      })
      .finally(() => {
        setIsProjectBaselineReady(true);
      });
  }, [defaultProjectFileName, setOutputDir, setProjectPath]);

  return {
    defaultExportDir,
    isProjectBaselineReady
  };
}
