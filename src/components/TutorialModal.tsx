import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Layers,
  Link2,
  Video,
  Mic,
  BrainCircuit,
  Database,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Check,
} from 'lucide-react';
import { api } from '../lib/api';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFinished: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  onFinished,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to reqvoiceV2',
      badge: 'Step 1 of 5 • Overview',
      icon: Sparkles,
      iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      description:
        'reqvoiceV2 is an enterprise requirements discovery platform that captures stakeholder voice and video, performs simultaneous space-saving media compression, and extracts architectural requirements via Gemini AI.',
      highlights: [
        'Organize systems by lifecycle (Existing, Proposed, Modernization)',
        'Generate structured interview protocols across 5 requirement categories',
        'Secure user authentication with custom role and profile settings',
      ],
    },
    {
      title: 'Systems & Interview Guides',
      badge: 'Step 2 of 5 • Architecture',
      icon: Layers,
      iconColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      description:
        'Define the target systems under study and their respective stakeholder personas (e.g. Clinicians, Logistics VPs, System Administrators). ReqVoice dynamically creates tailored interview protocols.',
      highlights: [
        'Explore pre-configured guides with time allocations and phase tips',
        'Use AI to generate custom role-specific questions on demand',
        'Track completion status across all active system evaluations',
      ],
    },
    {
      title: 'AI Shareable Link & Candidate Portal',
      badge: 'Step 3 of 5 • Online Sharing',
      icon: Link2,
      iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      description:
        'Generate secure, online shareable links for remote interviewees. The portal displays brief interviewer context, questions to be answered, and allows answering via either typing or audio/video recording.',
      highlights: [
        'Concise layout: Brief interviewer info & focused question fields',
        'Dual Input: Interviewees can type text or record spoken voice with one click',
        'Instant test preview to verify candidate experience directly',
      ],
    },
    {
      title: 'Space-Saving Video & Real-Time AI Transcription',
      badge: 'Step 4 of 5 • AI & Media Vault',
      icon: Video,
      iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description:
        'Video and audio are recorded simultaneously and compressed on-the-fly (VP8/Opus variable bitrate at 640x480 SD resolution), achieving 75%+ space savings. Gemini AI automatically provides verbatim transcription and sentiment analysis.',
      highlights: [
        'Automatic sentiment classification (Positive, Constructive, Neutral, Negative)',
        'Sentiment score (0-100) and extracted key requirement tags',
        'Embedded video playback player in every response report',
      ],
    },
    {
      title: 'MySQL Database & Single-File Reporting',
      badge: 'Step 5 of 5 • Enterprise Storage',
      icon: Database,
      iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      description:
        'All data is mapped to a production MySQL relational schema. You can export complete single-file .sql dumps or generate a consolidated single-file requirements report ready for executive delivery.',
      highlights: [
        'Downloadable single-file MySQL .sql dump with full table schema and row data',
        'One-click consolidated Markdown/HTML requirements report',
        'IndexedDB client cache to prevent database overflow from large media streams',
      ],
    },
  ];

  const current = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleComplete = async () => {
    try {
      await api.auth.completeTutorial();
    } catch {}
    onFinished();
    onClose();
  };

  const StepIcon = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-6 sm:p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Top Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-indigo-400">
              {current.badge}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Close Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <div className="flex items-start space-x-3.5">
            <div className={`p-3 rounded-2xl border ${current.iconColor} shrink-0`}>
              <StepIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white font-heading tracking-tight">
                {current.title}
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {current.description}
              </p>
            </div>
          </div>

          {/* Highlights box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Key Capabilities:
            </span>
            <div className="space-y-2">
              {current.highlights.map((h, i) => (
                <div key={i} className="flex items-start space-x-2 text-xs text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Step dots navigation */}
        <div className="flex items-center justify-center space-x-2 pt-1">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentStep ? 'w-6 bg-indigo-500' : 'w-2 bg-slate-800 hover:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-4">
          {currentStep > 0 ? (
            <button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Skip Tutorial
            </button>
          )}

          <button
            onClick={handleNext}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-900/30 flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <span>{isLastStep ? 'Get Started' : 'Next Step'}</span>
            {isLastStep ? <Check className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>
    </div>
  );
};
