import React, { useState, useEffect } from 'react';
import {
  Video,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Share2,
  Clock,
  RefreshCw,
  Eye,
  Smile,
  Frown,
  Meh,
  ThumbsUp,
  BrainCircuit,
  Lock,
  Copy,
} from 'lucide-react';
import { InterviewSession, InterviewQuestion } from '../types';
import { getVideoBlobUrl } from '../lib/videoStorage';
import { AnswerVideoPlayer } from './AnswerVideoPlayer';

interface LiveInterviewRoomProps {
  interview: InterviewSession;
  onFinishInterview: () => void;
  onOpenShareModal: () => void;
  onRefreshInterview: () => void;
}

export const LiveInterviewRoom: React.FC<LiveInterviewRoomProps> = ({
  interview,
  onFinishInterview,
  onOpenShareModal,
  onRefreshInterview,
}) => {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [videoBlobUrls, setVideoBlobUrls] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const questions = interview?.questions || [];
  const totalQuestions = questions.length;
  const currentQ: InterviewQuestion | undefined = questions[activeQuestionIndex];
  const currentResponse = currentQ ? interview?.responses?.[currentQ.id] : undefined;

  const answeredCount = Object.keys(interview?.responses || {}).length;
  const isAllAnswered = totalQuestions > 0 && answeredCount >= totalQuestions;

  // Resolve video blob URLs from IndexedDB for any recorded video
  useEffect(() => {
    let isMounted = true;
    const loadVideos = async () => {
      if (!interview.responses) return;
      const urls: Record<string, string> = {};
      for (const [qId, resp] of Object.entries(interview.responses)) {
        if ((resp as any)?.videoRecording) {
          const rec = (resp as any).videoRecording;
          if (rec.videoUrl) {
            urls[qId] = rec.videoUrl;
          } else if (rec.id) {
            try {
              const url = await getVideoBlobUrl(rec.id);
              urls[qId] = url || `/api/videos/${rec.id}`;
            } catch {
              urls[qId] = `/api/videos/${rec.id}`;
            }
          }
        }
      }
      if (isMounted) {
        setVideoBlobUrls((prev) => ({ ...prev, ...urls }));
      }
    };
    loadVideos();
    return () => {
      isMounted = false;
    };
  }, [interview.responses]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshInterview();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/?token=${interview.shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return <Smile className="w-3.5 h-3.5 text-emerald-400" />;
      case 'negative':
        return <Frown className="w-3.5 h-3.5 text-rose-400" />;
      case 'constructive':
        return <ThumbsUp className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Meh className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
      case 'negative':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-300';
      case 'constructive':
        return 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300';
      default:
        return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    }
  };

  if (!interview || totalQuestions === 0) {
    return (
      <div className="p-8 sm:p-12 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">No Questions in Session</h3>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          This interview session has no registered questions. You can launch or configure a session with questions from the Overview or Systems page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Session Monitor Header */}
      <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center space-x-1">
              <Eye className="w-3 h-3" />
              <span>Session Monitor (Read-Only)</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
              {interview.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white font-heading">
            {interview.intervieweeName} •{' '}
            <span className="text-slate-400 font-normal">{interview.intervieweeRole}</span>
          </h2>
          <p className="text-xs text-slate-400">
            System: <span className="text-white font-medium">{interview.systemName}</span>
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onOpenShareModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/40 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Link</span>
          </button>

          <button
            type="button"
            onClick={onFinishInterview}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isAllAnswered ? 'Synthesize Report' : 'Complete Session'}</span>
          </button>
        </div>
      </div>

      {/* Proctor Notice Banner */}
      <div className="p-3.5 px-4 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Interviewer Monitor:</strong> Responses and videos are submitted exclusively by the interviewee through their unique link.
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors flex items-center space-x-1 cursor-pointer self-start sm:self-auto shrink-0"
        >
          {linkCopied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{linkCopied ? 'Link Copied' : 'Copy Link'}</span>
        </button>
      </div>

      {/* Progress & Question Tabs */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center space-x-2">
          {interview.questions.map((q, idx) => {
            const hasAnswer = !!interview.responses?.[q.id];
            const isActive = idx === activeQuestionIndex;
            return (
              <button
                key={q.id || idx}
                onClick={() => setActiveQuestionIndex(idx)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : hasAnswer
                    ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>Q{idx + 1}</span>
                {hasAnswer ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                )}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-400 whitespace-nowrap">
          Answered: <strong className="text-white">{answeredCount}</strong> / {totalQuestions}
        </span>
      </div>

      {/* Active Question & Answer Inspector */}
      {currentQ ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Question Details & Focus (Read-Only) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center">
                    {activeQuestionIndex + 1}
                  </span>
                  <span className="text-xs text-slate-400">Question {activeQuestionIndex + 1} of {totalQuestions}</span>
                </div>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                  {currentQ.category?.replace('_', ' ')}
                </span>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {currentQ.questionText}
                </h3>
                {currentQ.rationale && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                    <strong className="text-indigo-400 font-semibold">Focus:</strong>{' '}
                    {currentQ.rationale}
                  </div>
                )}
              </div>

              {/* Contextual Probes */}
              {currentQ.suggestedFollowups && currentQ.suggestedFollowups.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Contextual Follow-up Inquiries:
                  </span>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {currentQ.suggestedFollowups.map((f, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <span className="text-indigo-400 font-bold">→</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Navigation pagination */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeQuestionIndex === 0}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={activeQuestionIndex >= totalQuestions - 1}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>

          {/* Right Column: Interviewee Response & Video Evidence */}
          <div className="lg:col-span-6 space-y-5">
            <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <BrainCircuit className="w-4 h-4 text-indigo-400" />
                  <span>Interviewee Response</span>
                </span>

                {currentResponse ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Answer Received</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Awaiting Response</span>
                  </span>
                )}
              </div>

              {currentResponse ? (
                <div className="space-y-4">
                  
                  {/* Video Playback & Alternative Review Player */}
                  {(videoBlobUrls[currentQ.id] || currentResponse.videoRecording) && (
                    <AnswerVideoPlayer
                      videoRecording={currentResponse.videoRecording}
                      fallbackVideoUrl={videoBlobUrls[currentQ.id]}
                      transcriptText={currentResponse.aiTranscript?.transcript || currentResponse.responseText}
                      speakerName={interview.intervieweeName}
                    />
                  )}

                  {/* AI Verbatim Transcript Card */}
                  {currentResponse.aiTranscript && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                          AI Transcript
                        </span>
                        
                        {/* Sentiment badge */}
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border flex items-center space-x-1 ${getSentimentBadge(currentResponse.aiTranscript.sentiment)}`}>
                          {getSentimentIcon(currentResponse.aiTranscript.sentiment)}
                          <span>{currentResponse.aiTranscript.sentiment || 'Constructive'}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed italic">
                        "{currentResponse.aiTranscript.transcript}"
                      </p>

                      {/* Key requirements extracted */}
                      {currentResponse.aiTranscript.keyRequirements && currentResponse.aiTranscript.keyRequirements.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Key Requirements:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {currentResponse.aiTranscript.keyRequirements.map((r: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[10px] text-indigo-200 font-medium">
                                ✓ {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Written typed response */}
                  {currentResponse.responseText && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Written Statement:
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {currentResponse.responseText}
                      </p>
                    </div>
                  )}

                </div>
              ) : (
                /* Awaiting Response Empty State */
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Awaiting Response from {interview.intervieweeName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      The interviewee will answer this question using their unique session link.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{linkCopied ? 'Link Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Check Updates</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
          No questions configured in this interview session.
        </div>
      )}

    </div>
  );
};
