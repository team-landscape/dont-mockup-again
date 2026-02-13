#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[cfg(target_os = "macos")]
use objc2_web_kit::WKWebView;

#[cfg(target_os = "macos")]
fn disable_swipe_navigation<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    if let Err(error) = window.with_webview(|webview| unsafe {
        let view: &WKWebView = &*webview.inner().cast();
        view.setAllowsBackForwardNavigationGestures(false);
    }) {
        eprintln!(
            "failed to disable back-forward swipe gestures for webview `{}`: {}",
            window.label(),
            error
        );
    }
}

#[cfg(target_os = "macos")]
fn disable_swipe_navigation_in_webview<R: tauri::Runtime>(webview: &tauri::Webview<R>) {
    if let Err(error) = webview.with_webview(|platform_webview| unsafe {
        let view: &WKWebView = &*platform_webview.inner().cast();
        view.setAllowsBackForwardNavigationGestures(false);
    }) {
        eprintln!(
            "failed to disable back-forward swipe gestures for webview `{}`: {}",
            webview.label(),
            error
        );
    }
}

fn project_root() -> PathBuf {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
    root.canonicalize().unwrap_or(root)
}

fn resolve_project_path(input: &str) -> PathBuf {
    let candidate = PathBuf::from(input);
    if candidate.is_absolute() {
        candidate
    } else {
        project_root().join(candidate)
    }
}

fn resolve_dialog_directory(preferred_dir: Option<String>) -> Option<PathBuf> {
    let raw = preferred_dir?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let candidate = resolve_project_path(trimmed);
    let directory = if candidate.is_file() {
        candidate.parent()?.to_path_buf()
    } else {
        candidate
    };

    if directory.exists() && directory.is_dir() {
        Some(directory)
    } else {
        None
    }
}

fn collect_png_files(dir: &PathBuf, acc: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|error| format!("read_dir failed: {}", error))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("read_dir entry failed: {}", error))?;
        let path = entry.path();
        if path.is_dir() {
            collect_png_files(&path, acc)?;
            continue;
        }

        let is_png = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("png"))
            .unwrap_or(false);

        if is_png {
            acc.push(path);
        }
    }

    Ok(())
}

fn fallback_font_list() -> Vec<String> {
    [
        "SF Pro",
        "SF Pro Display",
        "SF Pro Text",
        "Apple SD Gothic Neo",
        "Helvetica Neue",
        "Arial",
        "Noto Sans",
        "Roboto",
        "Inter",
    ]
    .iter()
    .map(|item| item.to_string())
    .collect()
}

fn normalize_font_list(fonts: Vec<String>) -> Vec<String> {
    let mut unique = BTreeSet::new();
    for font in fonts {
        let trimmed = font.trim();
        if !trimmed.is_empty() {
            unique.insert(trimmed.to_string());
        }
    }

    if unique.is_empty() {
        return fallback_font_list();
    }

    unique.into_iter().collect()
}

fn collect_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("system_profiler")
            .args(["SPFontsDataType", "-detailLevel", "mini"])
            .output()
            .map_err(|error| format!("failed to execute system_profiler: {}", error))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let raw = String::from_utf8_lossy(&output.stdout);
        let mut fonts = Vec::new();
        for line in raw.lines() {
            let trimmed = line.trim();
            if let Some(name) = trimmed.strip_prefix("Full Name:") {
                fonts.push(name.trim().to_string());
                continue;
            }

            if let Some(name) = trimmed.strip_prefix("Family:") {
                fonts.push(name.trim().to_string());
            }
        }

        return Ok(normalize_font_list(fonts));
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("fc-list")
            .args([":", "family"])
            .output()
            .map_err(|error| format!("failed to execute fc-list: {}", error))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let raw = String::from_utf8_lossy(&output.stdout);
        let mut fonts = Vec::new();
        for line in raw.lines() {
            let families = line.split(':').next_back().unwrap_or(line);
            for family in families.split(',') {
                fonts.push(family.trim().to_string());
            }
        }

        return Ok(normalize_font_list(fonts));
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts' | Select-Object -Property * -ExcludeProperty PS* | ForEach-Object { $_.PSObject.Properties.Name }",
            ])
            .output()
            .map_err(|error| format!("failed to execute powershell: {}", error))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }

        let raw = String::from_utf8_lossy(&output.stdout);
        let mut fonts = Vec::new();
        for line in raw.lines() {
            let cleaned = line
                .replace('\u{feff}', "")
                .split('(')
                .next()
                .unwrap_or("")
                .trim()
                .to_string();

            if !cleaned.is_empty() {
                fonts.push(cleaned);
            }
        }

        return Ok(normalize_font_list(fonts));
    }

    #[allow(unreachable_code)]
    Ok(fallback_font_list())
}

#[tauri::command]
fn run_pipeline(command: String, args: Vec<String>) -> Result<String, String> {
    let workspace_root = project_root();
    let script = workspace_root.join("scripts/pipeline.js");

    let output = Command::new("node")
        .arg("--import")
        .arg("tsx")
        .arg(script)
        .arg(command)
        .args(args)
        .current_dir(workspace_root)
        .output()
        .map_err(|error| format!("failed to execute node: {}", error))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let resolved = resolve_project_path(&path);
    fs::read_to_string(&resolved).map_err(|error| format!("failed to read {}: {}", resolved.display(), error))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    let resolved = resolve_project_path(&path);

    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("failed to create parent dirs: {}", error))?;
    }

    fs::write(&resolved, content).map_err(|error| format!("failed to write {}: {}", resolved.display(), error))
}

#[tauri::command]
fn list_png_files(path: String) -> Result<Vec<String>, String> {
    let resolved = resolve_project_path(&path);
    if !resolved.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_png_files(&resolved, &mut files)?;
    files.sort();

    let root = project_root();
    let results = files
        .into_iter()
        .map(|file| {
            file.strip_prefix(&root)
                .map(|relative| relative.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|_| file.to_string_lossy().replace('\\', "/"))
        })
        .collect::<Vec<String>>();

    Ok(results)
}

#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    let resolved = resolve_project_path(&path);
    let bytes = fs::read(&resolved).map_err(|error| format!("failed to read {}: {}", resolved.display(), error))?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
fn write_file_base64(path: String, data_base64: String) -> Result<(), String> {
    let resolved = resolve_project_path(&path);

    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("failed to create parent dirs: {}", error))?;
    }

    let bytes = STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|error| format!("failed to decode base64: {}", error))?;

    fs::write(&resolved, bytes).map_err(|error| format!("failed to write {}: {}", resolved.display(), error))?;
    Ok(())
}

#[tauri::command]
fn get_default_export_dir(app: tauri::AppHandle) -> Option<String> {
    let home_dir = app.path().home_dir().ok()?;
    let default_dir = home_dir.join("dont mockup again");

    fs::create_dir_all(&default_dir).ok()?;
    Some(default_dir.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn pick_output_dir() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn pick_project_file(preferred_dir: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new().add_filter("dont mockup again project", &["json"]);
    if let Some(directory) = resolve_dialog_directory(preferred_dir) {
        dialog = dialog.set_directory(directory);
    }
    dialog.pick_file().map(|path| path.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn pick_project_save_path(default_file_name: Option<String>, preferred_dir: Option<String>) -> Option<String> {
    let file_name = default_file_name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "project.storeshot.json".to_string());

    let mut dialog = rfd::FileDialog::new()
        .add_filter("dont mockup again project", &["json"])
        .set_file_name(&file_name);
    if let Some(directory) = resolve_dialog_directory(preferred_dir) {
        dialog = dialog.set_directory(directory);
    }

    dialog.save_file().map(|path| path.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn list_system_fonts() -> Result<Vec<String>, String> {
    Ok(collect_system_fonts().unwrap_or_else(|_| fallback_font_list()))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            for (_, webview_window) in app.webview_windows() {
                disable_swipe_navigation(&webview_window);
            }

            Ok(())
        })
        .on_page_load(|window, _payload| {
            #[cfg(target_os = "macos")]
            disable_swipe_navigation_in_webview(window);
        })
        .invoke_handler(tauri::generate_handler![
            run_pipeline,
            read_text_file,
            write_text_file,
            list_png_files,
            read_file_base64,
            write_file_base64,
            get_default_export_dir,
            pick_output_dir,
            pick_project_file,
            pick_project_save_path,
            list_system_fonts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
