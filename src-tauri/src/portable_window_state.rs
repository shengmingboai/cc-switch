use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

use crate::error::AppError;

const MAIN_WINDOW_LABEL: &str = "main";
const WINDOW_STATE_FILE_NAME: &str = ".window-state.json";

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
struct PortableWindowState {
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    #[serde(default)]
    prev_x: i32,
    #[serde(default)]
    prev_y: i32,
    maximized: bool,
}

struct PortableWindowStateCache(Mutex<HashMap<String, PortableWindowState>>);

fn state_path() -> std::path::PathBuf {
    crate::config::get_app_config_dir().join(WINDOW_STATE_FILE_NAME)
}

fn load_saved_states() -> HashMap<String, PortableWindowState> {
    let path = state_path();
    if !path.exists() {
        return HashMap::new();
    }

    match crate::config::read_json_file(&path) {
        Ok(states) => states,
        Err(error) => {
            log::warn!(
                "读取便携窗口状态失败，将使用默认窗口配置。路径: {}, 错误: {error}",
                path.display()
            );
            HashMap::new()
        }
    }
}

pub fn initialize(app_handle: &tauri::AppHandle) {
    if app_handle.try_state::<PortableWindowStateCache>().is_none() {
        app_handle.manage(PortableWindowStateCache(Mutex::new(load_saved_states())));
    }
}

pub fn track_main_window(window: &WebviewWindow) -> Result<(), AppError> {
    restore_main_window(window)?;
    ensure_main_window_state(window)?;

    let tracked_window = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { .. } => {
            if let Err(error) = refresh_main_window_state(&tracked_window) {
                log::warn!("关闭窗口前刷新便携窗口状态失败: {error}");
            }
        }
        WindowEvent::Moved(position) => {
            update_position_from_event(&tracked_window, *position);
        }
        WindowEvent::Resized(size) => {
            update_size_from_event(&tracked_window, *size);
        }
        _ => {}
    });

    Ok(())
}

fn ensure_main_window_state(window: &WebviewWindow) -> Result<(), AppError> {
    let initial_state = capture_current_state(window)?;
    let cache = window.state::<PortableWindowStateCache>();
    cache
        .0
        .lock()?
        .entry(MAIN_WINDOW_LABEL.to_string())
        .or_insert(initial_state);
    Ok(())
}

fn capture_current_state(window: &WebviewWindow) -> Result<PortableWindowState, AppError> {
    let size = window
        .inner_size()
        .map_err(|error| AppError::Message(format!("读取窗口大小失败: {error}")))?;
    let position = window
        .outer_position()
        .map_err(|error| AppError::Message(format!("读取窗口位置失败: {error}")))?;
    let maximized = window
        .is_maximized()
        .map_err(|error| AppError::Message(format!("读取窗口最大化状态失败: {error}")))?;

    Ok(PortableWindowState {
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
        prev_x: position.x,
        prev_y: position.y,
        maximized,
    })
}

fn refresh_main_window_state(window: &WebviewWindow) -> Result<(), AppError> {
    let minimized = window
        .is_minimized()
        .map_err(|error| AppError::Message(format!("读取窗口最小化状态失败: {error}")))?;
    let maximized = window
        .is_maximized()
        .map_err(|error| AppError::Message(format!("读取窗口最大化状态失败: {error}")))?;

    let normal_geometry = if minimized || maximized {
        None
    } else {
        let size = window
            .inner_size()
            .map_err(|error| AppError::Message(format!("读取窗口大小失败: {error}")))?;
        let position = window
            .outer_position()
            .map_err(|error| AppError::Message(format!("读取窗口位置失败: {error}")))?;
        Some((size, position))
    };

    let cache = window.state::<PortableWindowStateCache>();
    let mut states = cache.0.lock()?;
    let state = states.entry(MAIN_WINDOW_LABEL.to_string()).or_default();
    state.maximized = maximized;

    if let Some((size, position)) = normal_geometry {
        state.width = size.width;
        state.height = size.height;
        state.x = position.x;
        state.y = position.y;
        state.prev_x = position.x;
        state.prev_y = position.y;
    }

    Ok(())
}

fn update_position_from_event(window: &WebviewWindow, position: PhysicalPosition<i32>) {
    if window.is_minimized().unwrap_or_default() || window.is_maximized().unwrap_or_default() {
        return;
    }

    let cache = window.state::<PortableWindowStateCache>();
    let Ok(mut states) = cache.0.lock() else {
        log::warn!("更新便携窗口位置时窗口状态锁已损坏");
        return;
    };
    let state = states.entry(MAIN_WINDOW_LABEL.to_string()).or_default();
    state.x = position.x;
    state.y = position.y;
    state.prev_x = position.x;
    state.prev_y = position.y;
}

fn update_size_from_event(window: &WebviewWindow, size: PhysicalSize<u32>) {
    if window.is_minimized().unwrap_or_default() {
        return;
    }

    let maximized = window.is_maximized().unwrap_or_default();
    let cache = window.state::<PortableWindowStateCache>();
    let Ok(mut states) = cache.0.lock() else {
        log::warn!("更新便携窗口大小时窗口状态锁已损坏");
        return;
    };
    let state = states.entry(MAIN_WINDOW_LABEL.to_string()).or_default();
    state.maximized = maximized;

    if !maximized && size.width > 0 && size.height > 0 {
        state.width = size.width;
        state.height = size.height;
    }
}

fn restore_main_window(window: &WebviewWindow) -> Result<(), AppError> {
    let saved_state = {
        let cache = window.state::<PortableWindowStateCache>();
        let saved_state = cache.0.lock()?.get(MAIN_WINDOW_LABEL).cloned();
        saved_state
    };
    let Some(saved_state) = saved_state else {
        return Ok(());
    };

    let restored_position = PhysicalPosition::new(
        if saved_state.maximized {
            saved_state.prev_x
        } else {
            saved_state.x
        },
        if saved_state.maximized {
            saved_state.prev_y
        } else {
            saved_state.y
        },
    );
    let restored_size = PhysicalSize::new(saved_state.width, saved_state.height);

    if saved_state.width > 0 && saved_state.height > 0 {
        window
            .set_size(restored_size)
            .map_err(|error| AppError::Message(format!("恢复窗口大小失败: {error}")))?;

        let position_is_visible = window
            .available_monitors()
            .map_err(|error| AppError::Message(format!("读取显示器信息失败: {error}")))?
            .iter()
            .any(|monitor| monitor_intersects(monitor, restored_position, restored_size));
        if position_is_visible {
            window
                .set_position(restored_position)
                .map_err(|error| AppError::Message(format!("恢复窗口位置失败: {error}")))?;
        }
    }

    if saved_state.maximized {
        window
            .maximize()
            .map_err(|error| AppError::Message(format!("恢复窗口最大化状态失败: {error}")))?;
    }

    Ok(())
}

fn monitor_intersects(
    monitor: &tauri::Monitor,
    window_position: PhysicalPosition<i32>,
    window_size: PhysicalSize<u32>,
) -> bool {
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();

    let window_left = i64::from(window_position.x);
    let window_top = i64::from(window_position.y);
    let window_right = window_left + i64::from(window_size.width);
    let window_bottom = window_top + i64::from(window_size.height);

    let monitor_left = i64::from(monitor_position.x);
    let monitor_top = i64::from(monitor_position.y);
    let monitor_right = monitor_left + i64::from(monitor_size.width);
    let monitor_bottom = monitor_top + i64::from(monitor_size.height);

    window_left < monitor_right
        && window_right > monitor_left
        && window_top < monitor_bottom
        && window_bottom > monitor_top
}

pub fn save(app_handle: &tauri::AppHandle) -> Result<(), AppError> {
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        refresh_main_window_state(&window)?;
    }
    save_cached(app_handle)
}

pub fn save_cached(app_handle: &tauri::AppHandle) -> Result<(), AppError> {
    let Some(cache) = app_handle.try_state::<PortableWindowStateCache>() else {
        return Ok(());
    };
    let states = cache.0.lock()?.clone();
    crate::config::write_json_file(&state_path(), &states)
}
