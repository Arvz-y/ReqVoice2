import React, { useState } from 'react';
import {
  Smartphone,
  Video,
  Mic,
  BatteryCharging,
  Cpu,
  Flame,
  CheckCircle,
  Sliders,
  Maximize,
  HelpCircle,
  Camera,
  Layers,
} from 'lucide-react';
import { SystemUnderStudy, InterviewSession } from '../types';
import { MobileInstallBanner } from './MobileInstallBanner';

interface MobileExperienceModeProps {
  systems: SystemUnderStudy[];
  interviews: InterviewSession[];
  onStartInterview: () => void;
  onOpenChat: () => void;
  onNavigateToReports: () => void;
}

export const MobileExperienceMode: React.FC<MobileExperienceModeProps> = ({
  systems,
  interviews,
  onStartInterview,
  onOpenChat,
  onNavigateToReports,
}) => {
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [powerSaveMode, setPowerSaveMode] = useState<boolean>(true);
  const [sdCompressionEnabled, setSdCompressionEnabled] = useState<boolean>(true);
  const [autoUploadWifiOnly, setAutoUploadWifiOnly] = useState<boolean>(false);

  const completedInterviews = interviews.filter((i) => i.status === 'completed');
  const activeSystemsCount = systems.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile App Install Banner */}
      <MobileInstallBanner />

      {/* Mobile App Header Badge */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  Mobile Companion Edition
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  On-Device Optimized
                </span>
              </div>
              <p className="text-xs text-slate-400">
                PWA-ready for field interviews, mobile stakeholder discovery & on-site audio/video capture
              </p>
            </div>
          </div>

          <button
            onClick={onStartInterview}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 active:scale-95 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Launch Field Recorder</span>
          </button>
        </div>
      </div>

      {/* Quick Mobile Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={onStartInterview}
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <Video className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-200">Start Interview</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Front/Back cam capture</div>
        </div>

        <div
          onClick={onOpenChat}
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-200">AI Requirements Copilot</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Gemini 2.5 Flash / Pro</div>
        </div>

        <div
          onClick={onNavigateToReports}
          className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-200">Transcripts & Specs</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{completedInterviews.length} sessions logged</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2.5">
            <Layers className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-200">Systems Catalog</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{activeSystemsCount} registered systems</div>
        </div>
      </div>

      {/* Mobile Hardware & Recording Optimization Controls */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white">Mobile Device Optimization Settings</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Camera Selection */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Camera Lens</div>
              <div className="text-[10px] text-slate-400">Default lens for field interviews</div>
            </div>
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setCameraFacing('user')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  cameraFacing === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Front / Selfie
              </button>
              <button
                onClick={() => setCameraFacing('environment')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  cameraFacing === 'environment'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Back / Field
              </button>
            </div>
          </div>

          {/* SD Compression */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">SD VP8/AAC Compression</div>
              <div className="text-[10px] text-slate-400">Reduces cellular data footprint by ~76%</div>
            </div>
            <button
              onClick={() => setSdCompressionEnabled(!sdCompressionEnabled)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                sdCompressionEnabled ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  sdCompressionEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Battery Saver */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Battery Saver Profile</div>
              <div className="text-[10px] text-slate-400">Limits canvas framerate during long sessions</div>
            </div>
            <button
              onClick={() => setPowerSaveMode(!powerSaveMode)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                powerSaveMode ? 'bg-emerald-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  powerSaveMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Wi-Fi Sync */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Wi-Fi Only Sync</div>
              <div className="text-[10px] text-slate-400">Queue heavy video chunks until Wi-Fi connects</div>
            </div>
            <button
              onClick={() => setAutoUploadWifiOnly(!autoUploadWifiOnly)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                autoUploadWifiOnly ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  autoUploadWifiOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Field Tips & Guidelines Card */}
      <div className="rounded-2xl bg-indigo-950/30 border border-indigo-800/40 p-4 text-xs text-indigo-200/90 space-y-2">
        <div className="font-semibold text-white flex items-center space-x-1.5">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>Field Interviewing Best Practices on Mobile:</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
          <li>Keep your smartphone in landscape orientation during group requirements walk-throughs for optimal framing.</li>
          <li>The browser MediaRecorder utilizes hardware-accelerated VP8/H.264 encoders on iOS Safari and Chrome for Android.</li>
          <li>You can add reqvoiceV2 to your home screen using the banner above for native full-screen app execution without browser address bars.</li>
        </ul>
      </div>
    </div>
  );
};
