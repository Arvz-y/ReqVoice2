import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Mic,
  FileText,
  Database,
  Activity,
  Bot,
  Smartphone,
  Video,
  ExternalLink,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  User,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { UserProfile } from '../types';
import { useTheme } from './ThemeContext';

interface SidebarProps {
  currentUser: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenProfile: () => void;
  onOpenTutorial: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  isOpen,
  onToggle,
  onOpenProfile,
  onOpenTutorial,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'systems', label: 'Systems & Guides', icon: Layers, badge: null },
    { id: 'live', label: 'Interviewer Room', icon: Mic, badge: 'Active' },
    { id: 'reports', label: 'Reports & Transcripts', icon: FileText, badge: null },
    { id: 'analytics', label: 'Interview Analytics', icon: Activity, badge: null },
    { id: 'database', label: 'MySQL Database', icon: Database, badge: 'SQL' },
    { id: 'chat', label: 'AI Chatbot', icon: Bot, badge: 'Multi-AI' },
    { id: 'mobile', label: 'Mobile App / PWA', icon: Smartphone, badge: 'PWA' },
  ];

  const avatarSrc =
    currentUser.avatarUrl ||
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80';

  return (
    <>
      {/* Mobile backdrop when deployed */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-label="Close sidebar backdrop"
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="app-sidebar"
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col justify-between transition-all duration-300 ease-in-out select-none shadow-2xl lg:shadow-none ${
          isOpen
            ? 'w-72 translate-x-0'
            : '-translate-x-full lg:translate-x-0 lg:w-20'
        }`}
      >
        {/* Top Header / Brand */}
        <div className={`p-4 border-b border-slate-800/80 ${!isOpen ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'} w-full`}>
            
            {/* Logo and Brand Title */}
            <div
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center ${isOpen ? 'space-x-3' : 'justify-center'} cursor-pointer overflow-hidden group`}
              title="reqvoiceV2 Dashboard"
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Video className="w-5 h-5 text-indigo-400" />
                </div>
              </div>

              {isOpen && (
                <div className="flex flex-col min-w-0 transition-opacity duration-200">
                  <div className="flex items-center space-x-2">
                    <span className="font-heading text-lg font-bold tracking-tight text-white whitespace-nowrap">
                      reqvoice<span className="text-indigo-400">V2</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 uppercase tracking-wide">
                      MySQL
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap truncate">
                    Requirements Studio
                  </span>
                </div>
              )}
            </div>

            {/* Mobile-only close button for overlay drawer */}
            {isOpen && (
              <button
                id="btn-sidebar-close-mobile"
                onClick={onToggle}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer lg:hidden"
                title="Close Sidebar"
                aria-label="Close Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Middle Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 no-scrollbar">
          
          {/* Main Navigation Links */}
          <div className="space-y-1">
            {isOpen && (
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Workspace Navigation
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-item-${item.id}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    // On small screens, auto-close sidebar after selection
                    if (window.innerWidth < 1024) {
                      onToggle();
                    }
                  }}
                  className={`w-full flex items-center ${
                    isOpen ? 'justify-between px-3.5 py-2.5' : 'justify-center p-3'
                  } rounded-xl text-xs font-semibold transition-all cursor-pointer group relative ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                  }`}
                  title={!isOpen ? item.label : undefined}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                      } transition-colors`}
                    />
                    {isOpen && <span className="truncate">{item.label}</span>}
                  </div>

                  {isOpen && item.badge && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        isActive
                          ? 'bg-indigo-700 text-indigo-100'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Floating tooltip when sidebar is collapsed */}
                  {!isOpen && (
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-800 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {item.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Actions / Tutorial */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            {isOpen && (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Support & System
              </div>
            )}

            {/* Replay Tutorial Button */}
            <button
              id="sidebar-btn-tutorial"
              onClick={onOpenTutorial}
              className={`w-full flex items-center ${
                isOpen ? 'justify-start space-x-2.5 px-3.5 py-2' : 'justify-center p-3'
              } rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors cursor-pointer group relative`}
              title={!isOpen ? 'System Tutorial' : undefined}
            >
              <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
              {isOpen && <span>System Tutorial</span>}

              {!isOpen && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-800 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  System Tutorial
                </div>
              )}
            </button>
          </div>

        </div>

        {/* Footer: User Profile & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70">
          
          {isOpen ? (
            <div className="space-y-2">
              <div
                onClick={onOpenProfile}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 cursor-pointer transition-colors group"
                title="Open Profile Settings"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <img
                    src={avatarSrc}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-lg object-cover border border-indigo-500/40 shrink-0"
                  />
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-white truncate leading-tight">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      @{currentUser.username || 'user'}
                    </p>
                  </div>
                </div>
                <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="sidebar-btn-theme-toggle"
                  onClick={toggleTheme}
                  className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Light</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Dark</span>
                    </>
                  )}
                </button>

                <button
                  onClick={onLogout}
                  className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-xl bg-slate-900/60 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <button
                id="sidebar-btn-theme-collapsed"
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition-colors cursor-pointer relative group"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-500" />
                )}
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-800 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </div>
              </button>

              <button
                onClick={onOpenProfile}
                className="p-1 rounded-xl hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer relative group"
                title="Profile Settings"
              >
                <img
                  src={avatarSrc}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-lg object-cover border border-indigo-500/40"
                />
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-slate-200 text-xs rounded-lg border border-slate-800 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  @{currentUser.username || 'user'} • Settings
                </div>
              </button>

              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer relative group"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-rose-300 text-xs rounded-lg border border-slate-800 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  Sign Out
                </div>
              </button>
            </div>
          )}

        </div>
      </aside>
    </>
  );
};
