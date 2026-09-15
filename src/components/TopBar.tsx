import React from 'react';
import {
  PanelLeftOpen,
  PanelLeftClose,
  HelpCircle,
  Database,
  Layers,
  FileText,
  Mic,
  LayoutDashboard,
  Bot,
  Smartphone,
  Sun,
  Moon,
} from 'lucide-react';
import { UserProfile } from '../types';
import { MobileInstallBanner } from './MobileInstallBanner';
import { useTheme } from './ThemeContext';

interface TopBarProps {
  currentUser: UserProfile;
  activeTab: string;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenProfile: () => void;
  onOpenTutorial: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  activeTab,
  isSidebarOpen,
  onToggleSidebar,
  onOpenProfile,
  onOpenTutorial,
}) => {
  const { theme, toggleTheme } = useTheme();

  const getTabDetails = (tab: string) => {
    switch (tab) {
      case 'dashboard':
        return { title: 'Overview', icon: LayoutDashboard, subtitle: 'Metrics & active sessions' };
      case 'systems':
        return { title: 'Systems & Guides', icon: Layers, subtitle: 'Architectures & interview protocols' };
      case 'live':
        return { title: 'Session Monitor', icon: Mic, subtitle: 'Real-time proctoring (read-only)' };
      case 'reports':
        return { title: 'Reports & Transcripts', icon: FileText, subtitle: 'Video evidence & AI transcripts' };
      case 'database':
        return { title: 'MySQL Database', icon: Database, subtitle: 'Relational storage & exports' };
      case 'chat':
        return { title: 'AI Chatbot', icon: Bot, subtitle: 'Multi-model requirements assistant' };
      case 'mobile':
        return { title: 'Mobile App Companion', icon: Smartphone, subtitle: 'Field device & PWA controls' };
      default:
        return { title: 'Requirements Studio', icon: LayoutDashboard, subtitle: 'reqvoiceV2' };
    }
  };

  const currentTabInfo = getTabDetails(activeTab);
  const TabIcon = currentTabInfo.icon;
  const avatarSrc =
    currentUser.avatarUrl ||
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80';

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 lg:px-8 flex items-center justify-between font-sans">
      
      {/* Left: Sidebar Toggle & Page Title */}
      <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
        <button
          id="btn-deploy-sidebar"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
          title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          aria-label={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
            <TabIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-white leading-tight font-heading truncate">
              {currentTabInfo.title}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden sm:block">
              {currentTabInfo.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Actions & User Avatar */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* Compact PWA Mobile Install Button */}
        <div className="hidden sm:block">
          <MobileInstallBanner compact={true} />
        </div>

        {/* Quick Light / Dark Mode Toggle Button */}
        <button
          id="btn-quick-theme-toggle"
          onClick={toggleTheme}
          className="flex items-center space-x-1.5 p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer shadow-sm group"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
              <span className="text-xs font-semibold hidden md:inline text-slate-300 group-hover:text-white">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-500 group-hover:-rotate-12 transition-transform" />
              <span className="text-xs font-semibold hidden md:inline text-slate-700 group-hover:text-slate-900">Dark</span>
            </>
          )}
        </button>

        {/* Tutorial Link */}
        <button
          onClick={onOpenTutorial}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 border border-slate-800 transition-colors cursor-pointer hidden sm:flex items-center"
          title="System Tutorial"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* User Avatar & Profile */}
        <button
          onClick={onOpenProfile}
          className="flex items-center space-x-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
          title="Profile & Settings"
        >
          <img
            src={avatarSrc}
            alt={currentUser.name}
            className="w-7 h-7 rounded-lg object-cover border border-indigo-500/40"
          />
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-white leading-none">
              {currentUser.name.split(' ')[0]}
            </p>
            <p className="text-[9px] text-slate-400 font-mono">
              @{currentUser.username || 'user'}
            </p>
          </div>
        </button>
      </div>

    </header>
  );
};
