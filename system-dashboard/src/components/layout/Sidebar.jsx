import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Factory, Network, Server, SlidersHorizontal,
  Thermometer, GitBranch, BarChart3, Table2, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/plant', label: 'Plant View', icon: Factory },
  { path: '/topology', label: 'Network Topology', icon: Network },
  { path: '/node', label: 'Node Details', icon: Server },
  { path: '/factors', label: '7F Factors', icon: SlidersHorizontal },
  { path: '/sensors', label: '7S Sensors', icon: Thermometer },
  { path: '/offloading', label: 'Offloading', icon: GitBranch },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/tables', label: 'Tables & Logs', icon: Table2 },
  { path: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Network className="w-4 h-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="ml-3 text-sm font-bold text-sidebar-foreground tracking-tight truncate">
            IIoT DRL Dashboard
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse button */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}