import React from 'react';
import {
  Video,
  FileText,
  Plus,
  ArrowRight,
  Users,
  Layers,
  Sparkles,
  Share2,
} from 'lucide-react';
import { InterviewSession, SystemUnderStudy, UserProfile } from '../types';
import { MobileInstallBanner } from './MobileInstallBanner';

interface DashboardViewProps {
  currentUser: UserProfile;
  systems: SystemUnderStudy[];
  interviews: InterviewSession[];
  onSelectSystem: (systemId: string) => void;
  onStartLiveInterview: (interviewId: string) => void;
  onOpenCreateInterview: () => void;
  onOpenShareModal: (interview: InterviewSession) => void;
  onViewSummary: (interviewId: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  systems,
  interviews,
  onSelectSystem,
  onStartLiveInterview,
  onOpenCreateInterview,
  onOpenShareModal,
  onViewSummary,
  onNavigateToTab,
}) => {
  // Compute summary stats
  const totalInterviews = interviews.length;
  let totalVideos = 0;
  interviews.forEach((i) => {
    Object.values(i.responses || {}).forEach((r: any) => {
      if (r.videoRecording) totalVideos++;
    });
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* PWA Mobile Install Banner for Mobile Users */}
      <MobileInstallBanner />
      
      {/* Concise Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-7 shadow-xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Systems Requirements Intelligence</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight font-heading">
            Requirements Capture & Video Transcripts
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
            Collect stakeholder input through video, audio, and typed responses with automated Gemini AI transcription and structured MySQL storage.
          </p>

          <div className="pt-1">
            <button
              onClick={onOpenCreateInterview}
              className="flex items-center space-x-2 px-4 sm:px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-950/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Interview Session</span>
            </button>
          </div>
        </div>

        {/* Ambient subtle glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row - Clean 3-col layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Systems</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white font-heading">{systems.length}</p>
          <p className="text-[11px] text-slate-500 truncate">Architectures mapped</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Interviews</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white font-heading">{totalInterviews}</p>
          <p className="text-[11px] text-slate-500 truncate">Sessions logged</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Video Evidence</span>
            <Video className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white font-heading">{totalVideos}</p>
          <p className="text-[11px] text-slate-500 truncate">Recorded responses</p>
        </div>
      </div>

      {/* Main Grid: Sessions List + Systems Under Study */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Active Interview Sessions List */}
        <div className="lg:col-span-8 space-y-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white font-heading">Active Interview Sessions</h2>
            <p className="text-xs text-slate-400">Stakeholder questionnaires with video evidence and AI transcripts</p>
          </div>

          <div className="space-y-3">
            {interviews.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white font-heading">No Interview Sessions Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Ready to gather requirements? Launch your first interview with AI-generated Structured, Semi-Structured, or Unstructured questions.
                </p>
                <button
                  onClick={onOpenCreateInterview}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start First Interview</span>
                </button>
              </div>
            ) : (
              interviews.map((inv) => {
              const answersCount = Object.keys(inv.responses || {}).length;
              const hasVideos = Object.values(inv.responses || {}).some((r: any) => !!r.videoRecording);

              return (
                <div
                  key={inv.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-white">{inv.intervieweeName}</span>
                        <span className="text-xs text-indigo-400 font-medium">{inv.intervieweeRole}</span>
                        {inv.interviewType && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              inv.interviewType === 'Structured'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : inv.interviewType === 'Unstructured'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}
                          >
                            {inv.interviewType}
                          </span>
                        )}
                        {inv.status === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            In Progress
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">System: {inv.systemName}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => onViewSummary(inv.id)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Report</span>
                      </button>

                      <button
                        onClick={() => onOpenShareModal(inv)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition-colors cursor-pointer"
                        title="Share candidate link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges footer */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex items-center space-x-3">
                      <span>{answersCount} of {inv.questions.length} answered</span>
                      {hasVideos && (
                        <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                          <Video className="w-3 h-3" />
                          <span>Video Recorded</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onStartLiveInterview(inv.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 self-start sm:self-auto cursor-pointer"
                    >
                      <span>Session Monitor</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* Right Column: Systems Under Study */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-white font-heading">Systems Under Study</h3>
              <button
                onClick={() => onNavigateToTab('systems')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-2.5">
              {systems.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">No systems registered yet.</p>
                  <button
                    onClick={() => onNavigateToTab('systems')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 cursor-pointer"
                  >
                    Add your first system
                  </button>
                </div>
              ) : (
                systems.map((sys) => (
                  <div
                    key={sys.id}
                    onClick={() => onSelectSystem(sys.id)}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate max-w-[170px]">{sys.name}</h4>
                      <span className="text-[10px] uppercase font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full shrink-0">
                        {sys.lifecycleState}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{sys.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
