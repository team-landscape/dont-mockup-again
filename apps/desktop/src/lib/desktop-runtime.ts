import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export async function runPipeline(command: string, args: string[]) {
  return invokeCommand<string>('run_pipeline', { command, args });
}

export async function readTextFile(path: string) {
  return invokeCommand<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, content: string) {
  return invokeCommand<void>('write_text_file', { path, content });
}

export async function listPngFiles(path: string) {
  return invokeCommand<string[]>('list_png_files', { path });
}

export async function readFileBase64(path: string) {
  return invokeCommand<string>('read_file_base64', { path });
}

export async function listSystemFonts() {
  return invokeCommand<string[]>('list_system_fonts', {});
}

export async function writeFileBase64(path: string, dataBase64: string) {
  return invokeCommand<void>('write_file_base64', { path, dataBase64 });
}

export async function getDefaultExportDir() {
  return invokeCommand<string | null>('get_default_export_dir', {});
}

export async function pickOutputDir() {
  return invokeCommand<string | null>('pick_output_dir', {});
}

export async function pickProjectFile(preferredDir?: string) {
  return invokeCommand<string | null>('pick_project_file', { preferredDir });
}

export async function pickProjectSavePath(defaultFileName: string, preferredDir?: string) {
  return invokeCommand<string | null>('pick_project_save_path', { defaultFileName, preferredDir });
}

export function browserFileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Invalid file read result'));
        return;
      }

      const base64 = reader.result.split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export function isTauriRuntime() {
  return typeof window !== 'undefined'
    && typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';
}

async function invokeCommand<T>(command: string, payload: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error('Tauri runtime is not detected. Run `npm --prefix apps/desktop run tauri:dev`.');
  }

  return tauriInvoke<T>(command, payload);
}
