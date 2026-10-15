import {
  CalendarDays,
  ChartColumn,
  ChartGantt,
  FolderKanban,
  LogOut,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../ui/Card';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

function navItems(projectId?: string): NavItem[] {
  const items: NavItem[] = [{ to: '/projects', label: 'Proyek', icon: FolderKanban }];
  if (projectId) {
    items.push(
      { to: `/projects/${projectId}/gantt`, label: 'Gantt', icon: ChartGantt },
      { to: `/projects/${projectId}/team`, label: 'Tim', icon: Users },
      { to: `/projects/${projectId}/calendar`, label: 'Kalender', icon: CalendarDays },
      { to: `/projects/${projectId}/analysis`, label: 'Analisis', icon: ChartColumn },
    );
  }
  return items;
}

export interface AppShellProps {
  projectId?: string;
  children: ReactNode;
}

export function AppShell({ projectId, children }: AppShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems(projectId);

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }): string =>
    `flex items-center gap-3 rounded-md px-3 py-2 text-body-sm font-medium transition-colors ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
    }`;

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid size-9 place-items-center rounded-md bg-brand-600 text-white">
            <ChartGantt aria-hidden className="size-5" />
          </span>
          <span className="text-body font-semibold text-ink">Gantt Chart</span>
        </div>

        <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass} end={item.end}>
              <item.icon aria-hidden className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name ?? 'Pengguna'} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-ink">{user?.name}</p>
              <p className="truncate text-caption text-ink-3">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari akun"
              title="Keluar"
              className="grid size-9 place-items-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <LogOut aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-md bg-brand-600 text-white">
              <ChartGantt aria-hidden className="size-4" />
            </span>
            <span className="text-body-sm font-semibold text-ink">Gantt Chart</span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar name={user?.name ?? 'Pengguna'} size={28} />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari akun"
              className="grid size-9 place-items-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-danger"
            >
              <LogOut aria-hidden className="size-4" />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-5 pb-24 sm:px-6 md:pb-8 lg:px-8">{children}</main>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-caption font-medium transition-colors ${
                isActive ? 'text-brand-700' : 'text-ink-3'
              }`
            }
          >
            <item.icon aria-hidden className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
