import { NavLink, useLocation } from 'react-router-dom';
import { 
  MessageSquare, 
  ClipboardList, 
  Boxes, 
  Play, 
  BarChart3, 
  Download,
  Key,
  Leaf,
  ChevronRight
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  builderOnly?: boolean;
  hideWhenEnvKeys?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', icon: MessageSquare, label: 'Benchmark' },
  { to: '/evaluation', icon: ClipboardList, label: 'Evaluation' },
  { to: '/providers', icon: Boxes, label: 'Providers' },
  { to: '/run', icon: Play, label: 'Run', builderOnly: true },
  { to: '/results', icon: BarChart3, label: 'Results' },
  { to: '/import-export', icon: Download, label: 'Import/Export' },
  { to: '/api-keys', icon: Key, label: 'API Keys', builderOnly: true, hideWhenEnvKeys: true },
];

export function Sidebar() {
  const { mode, hasEnvKeys } = useApp();
  const location = useLocation();

  const visibleItems = navItems.filter(item => {
    if (item.builderOnly && mode === 'viewer') return false;
    if (item.hideWhenEnvKeys && hasEnvKeys) return false;
    return true;
  });

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Leaf className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sidebar-foreground text-sm leading-tight">
              AI Wellness
            </h1>
            <p className="text-xs text-muted-foreground">Benchmark</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className={cn(
                "w-4.5 h-4.5 transition-transform duration-200",
                !isActive && "group-hover:scale-110"
              )} />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-4 h-4 opacity-70" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Mode indicator */}
      <div className="p-4 border-t border-sidebar-border">
        <div className={cn(
          "px-3 py-2 rounded-lg text-xs font-medium",
          mode === 'builder' 
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}>
          {mode === 'builder' ? '🔧 Builder Mode' : '📊 Viewer Mode'}
        </div>
      </div>
    </aside>
  );
}
