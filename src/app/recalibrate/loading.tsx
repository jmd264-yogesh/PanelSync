import { RecalibrateSkeleton } from "@/recalibrate/components/RecalibrateSkeleton";
import { Gauge, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/common/components/ThemeToggle';

export default function RecalibrateLoading() {
  return (
    <div className="app-shell" style={{ background: 'var(--bg-main)' }}>
      <header className="app-header">
        <div className="app-container app-header-inner" style={{ maxWidth: '1600px' }}>
          <div className="brand-lockup">
            <div className="brand-mark" style={{ background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)' }}>
              <Gauge size={20} />
            </div>
            <div>
              <div className="brand-name">
                Recalibrate<span>.</span>
              </div>
              <div className="brand-context">DE CoE Interview Console</div>
            </div>
          </div>

          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="app-main" style={{ paddingTop: '1.5rem' }}>
        <div className="app-container" style={{ maxWidth: 'none' }}>
          <RecalibrateSkeleton />
        </div>
      </main>
    </div>
  );
}
