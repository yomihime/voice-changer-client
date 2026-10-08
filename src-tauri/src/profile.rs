//! Defer clearing the WebView profile until no WebView process owns its files.
//! The marker survives exit; the next startup removes only `profile/webview`.
use std::{
    fs,
    io::Write,
    path::Path,
    time::{Duration, Instant},
};

const RESET_MARKER: &str = "clear-webview-on-next-start";
const RESET_RETRY_TIMEOUT: Duration = Duration::from_secs(10);
const RESET_RETRY_INTERVAL: Duration = Duration::from_millis(100);

enum ResetFailure {
    UnsafePath(String),
    Io(&'static str, std::io::Error),
}

impl ResetFailure {
    fn retryable(&self) -> bool {
        #[cfg(windows)]
        if let Self::Io(_, error) = self {
            // WebView2 can retain handles briefly after the host has exited. Its
            // final cache writes can also make a directory nonempty during removal.
            return matches!(error.raw_os_error(), Some(5 | 32 | 33 | 145));
        }
        false
    }

    fn message(self) -> String {
        match self {
            Self::UnsafePath(message) => message,
            Self::Io(context, error) => {
                format!("{context}; close other client windows and retry: {error}")
            }
        }
    }
}

fn linked(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // Junctions and other reparse points are not necessarily reported as symlinks.
        return metadata.file_attributes() & 0x400 != 0;
    }
    #[cfg(not(windows))]
    false
}

fn checked_marker(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if !linked(&metadata) && metadata.is_file() => Ok(true),
        Ok(_) => Err("The profile reset marker is not a regular file".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("Cannot inspect profile reset marker: {error}")),
    }
}

pub fn request_reset(profile: &Path) -> Result<(), String> {
    let root = fs::canonicalize(profile)
        .map_err(|error| format!("Cannot resolve client profile: {error}"))?;
    if !root.is_dir() {
        return Err("Client profile is not a directory".into());
    }
    let marker = root.join(RESET_MARKER);
    if checked_marker(&marker)? {
        return Ok(());
    }
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&marker)
        .map_err(|error| format!("Cannot request profile reset: {error}"))?;
    file.write_all(b"Clear only the webview directory before the next client window opens.\n")
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("Cannot save profile reset request: {error}"))
}

fn checked_tree(path: &Path, root: &Path) -> Result<(), ResetFailure> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| ResetFailure::Io("Cannot inspect WebView profile", error))?;
    if linked(&metadata) {
        return Err(ResetFailure::UnsafePath(
            "Refusing to clear a WebView profile containing a link or reparse point".into(),
        ));
    }
    let resolved = fs::canonicalize(path)
        .map_err(|error| ResetFailure::Io("Cannot resolve WebView profile", error))?;
    if !resolved.starts_with(root) || resolved == root {
        return Err(ResetFailure::UnsafePath(
            "WebView profile resolved outside the client profile".into(),
        ));
    }
    if metadata.is_dir() {
        for entry in fs::read_dir(path)
            .map_err(|error| ResetFailure::Io("Cannot read WebView profile", error))?
        {
            checked_tree(
                &entry
                    .map_err(|error| ResetFailure::Io("Cannot read WebView profile entry", error))?
                    .path(),
                root,
            )?;
        }
    }
    Ok(())
}

pub fn apply_pending_reset(profile: &Path) -> Result<(), String> {
    apply_pending_reset_with_retry(profile, RESET_RETRY_TIMEOUT)
}

fn apply_pending_reset_with_retry(profile: &Path, timeout: Duration) -> Result<(), String> {
    let root = fs::canonicalize(profile)
        .map_err(|error| format!("Cannot resolve client profile: {error}"))?;
    let marker = root.join(RESET_MARKER);
    if !checked_marker(&marker)? {
        return Ok(());
    }
    let deadline = Instant::now() + timeout;
    loop {
        // Every attempt revalidates links and the canonical target. A partly
        // deleted directory is safe to retry; validation failures are never retried.
        match remove_webview(&root) {
            Ok(()) => break,
            Err(error) if error.retryable() && Instant::now() < deadline => {
                std::thread::sleep(
                    RESET_RETRY_INTERVAL.min(deadline.saturating_duration_since(Instant::now())),
                );
            }
            Err(error) => return Err(error.message()),
        }
    }
    fs::remove_file(marker).map_err(|error| format!("Cannot finish profile reset: {error}"))
}

fn remove_webview(root: &Path) -> Result<(), ResetFailure> {
    let target = root.join("webview");
    match fs::symlink_metadata(&target) {
        Ok(metadata) => {
            if linked(&metadata) || !metadata.is_dir() {
                return Err(ResetFailure::UnsafePath(
                    "Refusing to clear an unexpected WebView profile path".into(),
                ));
            }
            // Validate the absolute target and descendants before any recursive delete.
            checked_tree(&target, root)?;
            fs::remove_dir_all(&target)
                .map_err(|error| ResetFailure::Io("Cannot clear WebView profile", error))?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(ResetFailure::Io("Cannot inspect WebView profile", error)),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
    };
    static NEXT: AtomicU64 = AtomicU64::new(0);

    struct TestProfile(PathBuf);
    impl TestProfile {
        fn new() -> Self {
            let name = format!(
                "voice-changer-profile-test-{}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            );
            let root = std::env::temp_dir().join(name);
            fs::create_dir(&root).unwrap();
            Self(fs::canonicalize(root).unwrap())
        }
    }
    impl Drop for TestProfile {
        fn drop(&mut self) {
            // This exact canonical directory was created exclusively by this test.
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn pending_reset_removes_only_webview_and_is_idempotent() {
        let profile = TestProfile::new();
        fs::create_dir_all(profile.0.join("webview/Default/Cache")).unwrap();
        fs::write(profile.0.join("webview/Default/Cache/data"), b"site data").unwrap();
        fs::write(profile.0.join("shortcut-settings.json"), b"shortcuts").unwrap();
        fs::create_dir(profile.0.join("models")).unwrap();
        fs::write(profile.0.join("models/keep.txt"), b"unrelated").unwrap();
        request_reset(&profile.0).unwrap();
        request_reset(&profile.0).unwrap();
        assert!(
            profile.0.join("webview").exists(),
            "request must not clear a running WebView"
        );
        apply_pending_reset(&profile.0).unwrap();
        apply_pending_reset(&profile.0).unwrap();
        assert!(!profile.0.join("webview").exists());
        assert!(!profile.0.join(RESET_MARKER).exists());
        assert_eq!(
            fs::read(profile.0.join("shortcut-settings.json")).unwrap(),
            b"shortcuts"
        );
        assert_eq!(
            fs::read(profile.0.join("models/keep.txt")).unwrap(),
            b"unrelated"
        );
    }

    #[test]
    fn without_marker_existing_profile_is_untouched() {
        let profile = TestProfile::new();
        fs::create_dir(profile.0.join("webview")).unwrap();
        fs::write(profile.0.join("webview/keep.txt"), b"site data").unwrap();
        apply_pending_reset(&profile.0).unwrap();
        assert_eq!(
            fs::read(profile.0.join("webview/keep.txt")).unwrap(),
            b"site data"
        );
    }

    #[test]
    fn reset_handles_absent_webview_but_retains_marker_for_unexpected_file() {
        let profile = TestProfile::new();
        request_reset(&profile.0).unwrap();
        apply_pending_reset(&profile.0).unwrap();
        fs::write(profile.0.join("webview"), b"unexpected").unwrap();
        request_reset(&profile.0).unwrap();
        assert!(apply_pending_reset(&profile.0).is_err());
        assert!(profile.0.join(RESET_MARKER).exists());
        assert_eq!(fs::read(profile.0.join("webview")).unwrap(), b"unexpected");
    }

    #[test]
    fn rejects_linked_webview_without_touching_target() {
        let profile = TestProfile::new();
        let external = TestProfile::new();
        fs::write(external.0.join("keep.txt"), b"outside").unwrap();
        #[cfg(windows)]
        let result = std::os::windows::fs::symlink_dir(&external.0, profile.0.join("webview"));
        #[cfg(unix)]
        let result = std::os::unix::fs::symlink(&external.0, profile.0.join("webview"));
        #[cfg(windows)]
        if result
            .as_ref()
            .is_err_and(|error| error.raw_os_error() == Some(1314))
        {
            // Creating a Windows symlink needs Developer Mode or elevated privileges.
            return;
        }
        result.unwrap();
        request_reset(&profile.0).unwrap();
        assert!(apply_pending_reset(&profile.0).is_err());
        assert_eq!(fs::read(external.0.join("keep.txt")).unwrap(), b"outside");
        assert!(profile.0.join(RESET_MARKER).exists());
        #[cfg(windows)]
        fs::remove_dir(profile.0.join("webview")).unwrap();
        #[cfg(unix)]
        fs::remove_file(profile.0.join("webview")).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn reset_waits_for_a_real_windows_file_lock_to_be_released() {
        use std::os::windows::fs::OpenOptionsExt;
        let profile = TestProfile::new();
        fs::create_dir_all(profile.0.join("webview/Default")).unwrap();
        let file = profile.0.join("webview/Default/locked-cache");
        fs::write(&file, b"locked cache").unwrap();
        request_reset(&profile.0).unwrap();
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&file)
            .unwrap();
        let path = profile.0.clone();
        let (sender, receiver) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            sender
                .send(apply_pending_reset_with_retry(
                    &path,
                    Duration::from_secs(3),
                ))
                .unwrap();
        });
        assert!(
            matches!(
                receiver.recv_timeout(Duration::from_millis(150)),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout)
            ),
            "reset must retry while an actual Windows handle prevents deletion"
        );
        assert!(profile.0.join(RESET_MARKER).exists());
        drop(lock);
        receiver
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap();
        worker.join().unwrap();
        assert!(!profile.0.join("webview").exists());
        assert!(!profile.0.join(RESET_MARKER).exists());
    }

    #[cfg(windows)]
    #[test]
    fn persistent_windows_lock_has_bounded_retries_and_keeps_reset_marker() {
        use std::os::windows::fs::OpenOptionsExt;
        let profile = TestProfile::new();
        fs::create_dir(profile.0.join("webview")).unwrap();
        let file = profile.0.join("webview/locked-cache");
        fs::write(&file, b"locked cache").unwrap();
        request_reset(&profile.0).unwrap();
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&file)
            .unwrap();
        let started = Instant::now();
        assert!(apply_pending_reset_with_retry(&profile.0, Duration::from_millis(150)).is_err());
        assert!(started.elapsed() < Duration::from_secs(2));
        assert!(profile.0.join(RESET_MARKER).exists());
        assert!(file.exists());
        drop(lock);
        apply_pending_reset(&profile.0).unwrap();
        assert!(!profile.0.join("webview").exists());
    }
}
