import React, { useState } from 'react';
import { Smartphone, Download, Share, PlusSquare, X, Check, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MobileInstallBannerProps {
  compact?: boolean;
}

export const MobileInstallBanner: React.FC<MobileInstallBannerProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  if (compact) {
    if (isInstallable) {
      return (
        <button
          onClick={install}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
          title="Install reqvoiceV2 to home screen"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      );
    }
    if (isIOS) {
      return (
        <>
          <button
            onClick={() => setShowIOSGuide(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs font-medium transition-all"
            title="Install on iPhone / iPad"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install iOS</span>
          </button>

          {showIOSGuide && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
              <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
                  </div>
                  <button
                    onClick={() => setShowIOSGuide(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
                    <Share className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>1. Tap the <strong>Share</strong> button in your Safari bottom bar.</span>
                  </div>
                  <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
                    <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                  </div>
                  <div className="flex items-start space-x-2 p-2 rounded-xl bg-slate-800/60 border border-slate-700/40">
                    <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>3. Launch <strong>reqvoiceV2</strong> with full-screen native mobile experience.</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
                >
                  Got It
                </button>
              </div>
            </div>
          )}
        </>
      );
    }
    return null;
  }

  // Full banner mode (featured on mobile screens)
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-violet-950/80 border border-indigo-500/30 p-3.5 sm:p-4 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
            <Smartphone className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-tight truncate">
                Install Mobile App
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Full-screen camera capture, low battery mode & offline sync
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {isInstallable ? (
            <button
              onClick={install}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          ) : isIOS ? (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Add to Home</span>
            </button>
          ) : (
            <button
              onClick={install}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-600/70 hover:bg-indigo-600 text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Get App</span>
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40">
                <Share className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>1. Tap the <strong>Share</strong> icon in the Safari navigation bar.</span>
              </div>
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40">
                <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>2. Select <strong>Add to Home Screen</strong> from the actions list.</span>
              </div>
              <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>3. Enjoy hardware-accelerated camera and offline audio compression directly on your device.</span>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
