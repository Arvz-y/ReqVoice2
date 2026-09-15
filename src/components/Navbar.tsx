import React from 'react';
import {
  Mic,
  Video,
  FileText,
  Database,
  LayoutDashboard,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  User,
  HelpCircle,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  currentUser: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSharePreview: () => void;
  onOpenProfile: () => void;
  onOpenTutorial: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenSharePreview,
  onOpenProfile,
  onOpenTutorial,
  onLogout,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'systems', label: 'Systems & Guides', icon: Layers },
    { id: 'live', label: 'Interviewer Room', icon: Mic },
    { id: 'reports', label: 'Reports & Transcripts', icon: FileText },
    { id: 'database', label: 'MySQL Database', icon: Database },
  ];

  const avatarSrc = currentUser.avatarUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80';

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer select-none" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Video className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading text-lg font-bold tracking-tight text-white">
                  ReqVoice <span className="text-indigo-400">AI</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                  MySQL & AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Requirements Interview Intelligence</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Tutorial Button */}
            <button
              onClick={onOpenTutorial}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-indigo-400 border border-slate-800 text-xs transition-colors cursor-pointer hidden sm:flex items-center space-x-1.5"
              title="Replay System Tutorial"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <span className="text-xs">Tutorial</span>
            </button>

            {/* Direct Launch to Interviewee Camera Portal */}
            <button
              id="btn-open-interviewee-portal"
              onClick={onOpenSharePreview}
              className="flex items-center space-x-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
              title="Open the Interviewee Video & Audio Recording portal"
            >
              <Video className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Interviewee Portal</span>
              <span className="sm:hidden">Portal</span>
              <ExternalLink className="w-3 h-3 text-emerald-200" />
            </button>

            {/* User Profile Button */}
            <button
              onClick={onOpenProfile}
              className="flex items-center space-x-2 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors cursor-pointer"
              title="Manage Profile & Settings"
            >
              <img
                src={avatarSrc}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover border border-indigo-500/40"
              />
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold text-white leading-tight">
                  {currentUser.name.split(' ')[0]}
                </p>
                <p className="text-[10px] text-slate-400 font-mono leading-none">
                  @{currentUser.username || 'user'}
                </p>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
            </button>

            {/* Quick Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t border-slate-800/60 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
};
