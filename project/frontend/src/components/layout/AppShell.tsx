import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Briefcase,
  ChevronRight,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getHomePath } from '../../lib/roles'
import { cn } from '../../lib/cn'
import { Button } from '../ui/Button'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const CRUMBS: Array<{ match: (path: string) => boolean; label: string }> = [
  { match: (p) => p === '/customer/dashboard', label: 'Dashboard' },
  { match: (p) => p === '/agent/dashboard', label: 'Agent workspace' },
  { match: (p) => p === '/admin/dashboard', label: 'Admin console' },
  { match: (p) => p === '/reviewer/queue', label: 'Review queue' },
  { match: (p) => p === '/complaints/new', label: 'New complaint' },
  { match: (p) => p.startsWith('/complaints/'), label: 'Complaint detail' },
]

function initials(name: string): string {
  return name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function SidebarContent({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="grid size-7 place-items-center rounded-md bg-brand-600 text-white shadow-sm">
          <ShieldCheck className="size-4" aria-hidden="true" />
        </span>
        <span className="text-[15px] font-bold tracking-tight text-ink">SupportNova</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-soft hover:bg-canvas hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn('size-4 shrink-0', isActive ? 'text-brand-600' : 'text-faint group-hover:text-muted')}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-faint">GenAI analysis · Python verified</p>
      </div>
    </div>
  )
}

/**
 * Authenticated app shell: fixed sidebar (lg+), off-canvas drawer below lg,
 * topbar with breadcrumb + identity + sign-out. Every protected route renders
 * inside it, so spacing and typography never drift between pages (design.md §10.2).
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const home = getHomePath(user?.role)
  const role = user?.role ?? ''

  const sections = useMemo<NavSection[]>(() => {
    const workspace: NavItem[] = [
      { to: home, label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/complaints/new', label: 'New complaint', icon: FilePlus2 },
    ]

    const operations: NavItem[] = []
    if (['reviewer', 'manager', 'admin'].includes(role)) {
      operations.push({ to: '/reviewer/queue', label: 'Review queue', icon: Inbox })
    }
    if (['agent', 'manager', 'admin'].includes(role)) {
      operations.push({ to: '/agent/dashboard', label: 'Agent workspace', icon: Briefcase })
    }

    const analytics: NavItem[] = []
    if (['admin', 'manager'].includes(role)) {
      analytics.push({ to: '/admin/dashboard', label: 'Admin console', icon: BarChart3 })
    }

    const built: NavSection[] = [{ title: 'Workspace', items: workspace }]
    if (operations.length) built.push({ title: 'Operations', items: operations })
    if (analytics.length) built.push({ title: 'Analytics', items: analytics })
    return built
  }, [home, role])

  const crumb = CRUMBS.find((entry) => entry.match(location.pathname))?.label ?? 'Dashboard'

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Trap the page behind the drawer on small screens.
  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarContent sections={sections} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[85vw] border-r border-border bg-surface shadow-pop">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 rounded p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            <SidebarContent sections={sections} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="-ml-1 rounded-md p-2 text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex items-center gap-1.5 text-sm">
                <li className="hidden text-muted sm:block">SupportNova</li>
                <li aria-hidden="true" className="hidden text-faint sm:block">
                  <ChevronRight className="size-3.5" />
                </li>
                <li className="truncate font-medium text-ink">{crumb}</li>
              </ol>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted ring-1 ring-border sm:inline-flex">
                <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                {role}
              </span>

              <div className="flex items-center gap-2">
                <span
                  className="grid size-8 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white"
                  aria-hidden="true"
                >
                  {initials(user.username)}
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="max-w-32 truncate text-[13px] font-semibold text-ink">
                    {user.username}
                  </p>
                  <p className="text-[11px] text-muted">{user.email}</p>
                </div>
              </div>

              <Button variant="ghost" size="sm" icon={<LogOut className="size-4" />} onClick={handleLogout}>
                <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
