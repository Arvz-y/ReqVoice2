import React, { useState } from 'react';
import { X, Copy, CheckCircle2, Video, ExternalLink, Sparkles, RefreshCw } from 'lucide-react';
import { InterviewSession } from '../types';
import { api } from '../lib/api';

interface ShareModalProps {
  interview: InterviewSession | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDirectTest: (token: string) => void;
  onLinkUpdated?: (newToken: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  interview,
  isOpen,
  onClose,
  onOpenDirectTest,
  onLinkUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentToken, setCurrentToken] = useState(interview?.shareToken || '');

  if (!isOpen || !interview) return null;

  const activeToken = currentToken || interview.shareToken;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${origin}/?token=${activeToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateAILink = async () => {
    setGenerating(true);
    try {
      const res = await api.interviews.generateAILink(interview.id);
      if (res.shareToken) {
        setCurrentToken(res.shareToken);
        if (onLinkUpdated) onLinkUpdated(res.shareToken);
      }
    } catch (err: any) {
      alert(`Could not generate link: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-sans overflow-y-auto">
      <div className="max-w-md w-full my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-heading">
                Interviewee Portal Link
              </h3>
              <p className="text-[11px] text-slate-400">
                Share this link with the candidate to record responses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3.5">
          
          {/* Target candidate info */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Interviewee:</span>
              <span className="font-semibold text-white">{interview.intervieweeName} ({interview.intervieweeRole})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">System:</span>
              <span className="text-slate-300 font-medium">{interview.systemName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Questions:</span>
              <span className="text-indigo-400 font-medium">{interview.questions.length} questions configured</span>
            </div>
          </div>

          {/* Generated Link Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                Unique Access URL
              </label>
              <button
                type="button"
                onClick={handleGenerateAILink}
                disabled={generating}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${generating ? 'animate-spin' : ''}`} />
                <span>{generating ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer shrink-0"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Direct Test Portal Button */}
          <button
            onClick={() => {
              onClose();
              onOpenDirectTest(activeToken);
            }}
            className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            <Video className="w-4 h-4" />
            <span>Open Candidate View Preview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

        </div>

      </div>
    </div>
  );
};
