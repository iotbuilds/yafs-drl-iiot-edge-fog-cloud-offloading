import React, { useState } from 'react';
import { RefreshCw, Moon, Sun, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header({ onRefresh, onMobileMenuToggle }) {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuToggle} aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" />
          <span className="text-xs font-medium text-muted-foreground">YAFS Simulation Active</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRefresh} aria-label="Refresh dashboard">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </header>
  );
}
