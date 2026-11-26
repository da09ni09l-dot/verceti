export default function DownloadLauncherFooter() {
  return (
    <footer className="verceti-download-footer">
      <div className="verceti-download-footer__copy">
        <strong>VERCETI ДЛЯ WINDOWS</strong>
        <span>Окремий застосунок для зручного доступу до спільноти · Windows 10/11 · x64</span>
      </div>
      <a
        className="verceti-download-footer__button"
        href="https://github.com/da09ni09l-dot/verceti/releases/latest/download/VERCETI-Setup-1.0.0.exe"
        aria-label="Завантажити VERCETI для Windows"
      >
        <span aria-hidden="true">↓</span>
        Завантажити VERCETI
      </a>
    </footer>
  );
}
