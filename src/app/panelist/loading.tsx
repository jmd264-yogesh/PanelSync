import { PanelistSkeleton } from "@/panelist/components/PanelistSkeleton";
import { Calendar, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/common/components/ThemeToggle';

export default function PanelistLoading() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner" style={{ maxWidth: '1200px' }}>
          <div className="brand-lockup">
            <div className="brand-mark">
              <Calendar size={20} />
            </div>
            <div>
              <div className="brand-name">
                Panel<span>Sync</span>
              </div>
              <div className="brand-context">Panelist Portal</div>
            </div>
          </div>

          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-container" style={{ maxWidth: '1200px' }}>
          <PanelistSkeleton />
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-container flex-between text-muted text-xs" style={{ maxWidth: '1200px' }}>
          <p>© 2026 PanelSync. Panelist Portal.</p>
        </div>
      </footer>
    </div>
  );
}
