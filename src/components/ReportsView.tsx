import React, { useState, useEffect } from 'react';
import {
  FileText,
  Play,
  Video,
  Sparkles,
  Printer,
  RotateCcw,
  CheckCircle2,
  Smile,
  Frown,
  Meh,
  Copy,
  Layers,
  Share2,
} from 'lucide-react';
import { InterviewSession, SystemUnderStudy, InterviewResponse } from '../types';
import { api } from '../lib/api';
import { getVideoBlobUrl, blobToBase64 } from '../lib/videoStorage';
import { AnswerVideoPlayer } from './AnswerVideoPlayer';

interface ReportsViewProps {
  systems: SystemUnderStudy[];
  interviews: InterviewSession[];
  selectedInterviewId: string | null;
  onRefreshInterviews: () => void;
  onOpenShareModal: (interview: InterviewSession) => void;
  onNavigateToLive?: (interviewId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  interviews,
  selectedInterviewId,
  onRefreshInterviews,
  onOpenShareModal,
  onNavigateToLive,
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string>(
    selectedInterviewId || (interviews[0]?.id ?? '')
  );
  const [activeTab, setActiveTab] = useState<'individual' | 'matrix'>('individual');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [transcribingQId, setTranscribingQId] = useState<string | null>(null);
  const [videoBlobUrls, setVideoBlobUrls] = useState<Record<string, string>>({});
  const [copiedQId, setCopiedQId] = useState<string | null>(null);

  // Sync selectedInterviewId
  useEffect(() => {
    if (selectedInterviewId) {
      setActiveSessionId(selectedInterviewId);
    } else if (interviews.length > 0 && !activeSessionId) {
      setActiveSessionId(interviews[0].id);
    }
  }, [selectedInterviewId, interviews]);

  const currentInterview = interviews.find((i) => i.id === activeSessionId) || interviews[0];

  // Pre-load video object URLs from IndexedDB or streaming endpoints
  useEffect(() => {
    if (!currentInterview?.responses) return;

    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const [qId, resp] of Object.entries(currentInterview.responses)) {
        const vid = (resp as InterviewResponse)?.videoRecording;
        if (vid) {
          if (vid.videoUrl) {
            urls[qId] = vid.videoUrl;
          } else if (vid.id) {
            try {
              const dbUrl = await getVideoBlobUrl(vid.id);
              urls[qId] = dbUrl || `/api/videos/${vid.id}`;
            } catch {
              urls[qId] = `/api/videos/${vid.id}`;
            }
          }
        }
      }
      setVideoBlobUrls(urls);
    };

    loadUrls();
  }, [currentInterview]);

  // Re-Synthesize Executive Summary Report with Gemini AI
  const handleReSynthesizeReport = async () => {
    if (!currentInterview) return;
    setIsSynthesizing(true);
    try {
      await api.interviews.finish(currentInterview.id);
      onRefreshInterviews();
    } catch (err: any) {
      alert(err.message || 'Report synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Re-Transcribe specific question video with Gemini AI
  const handleReTranscribeVideo = async (qId: string) => {
    if (!currentInterview) return;
    setTranscribingQId(qId);
    try {
      const response = currentInterview.responses?.[qId];
      const q = currentInterview.questions.find((x) => x.id === qId);
      if (!response?.videoRecording) {
        alert('No video available to transcribe.');
        return;
      }

      const mediaUrl = response.videoRecording.videoUrl || api.videos.getUrl(response.videoRecording.id);
      const mediaResponse = await fetch(mediaUrl);
      if (!mediaResponse.ok) throw new Error('The recorded video is not accessible. No transcript was generated.');
      const mediaBlob = await mediaResponse.blob();
      if (!mediaBlob.size) throw new Error('The recorded video is empty. No transcript was generated.');
      const base64Media = await blobToBase64(mediaBlob);
      const res = await api.gemini.transcribeVideo({
        base64Media,
        mimeType: mediaBlob.type || response.videoRecording.mimeType || 'video/webm',
        questionText: q?.questionText || 'Requirements inquiry',
        category: q?.category,
        durationSeconds: response.videoRecording.durationSeconds,
      });

      if (res) {
        await api.interviews.saveResponse(currentInterview.id, {
          questionId: qId,
          responseText: response.responseText || '',
          videoRecording: response.videoRecording,
          aiTranscript: res,
        });
      }

      onRefreshInterviews();
    } catch (err: any) {
      alert(err.message || 'Transcription failed.');
    } finally {
      setTranscribingQId(null);
    }
  };

  const copyTranscript = (text: string, qId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedQId(qId);
    setTimeout(() => setCopiedQId(null), 2000);
  };

  if (!interviews || interviews.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-heading">
              Requirements & Video Transcripts
            </h2>
            <p className="text-xs text-slate-400">
              Review stakeholder video responses, Gemini transcriptions, and synthesized specifications
            </p>
          </div>
        </div>

        <div className="p-8 sm:p-12 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-xl mx-auto my-8 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white font-heading">No Interview Sessions Yet</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            There are no interview sessions logged in your account space yet. Launch a stakeholder interview from the Systems view to record evidence and generate AI-synthesized specifications.
          </p>
        </div>
      </div>
    );
  }

  const report = currentInterview?.summaryReport;
  const questionsList = currentInterview?.questions || [];

  return (
    <div className="space-y-6">

      {/* Top Header & Session Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-heading">
            Requirements & Video Transcripts
          </h2>
          <p className="text-xs text-slate-400">
            Review stakeholder video responses, Gemini transcriptions, and synthesized specifications
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'individual'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Individual Report
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Comparison Matrix
          </button>
        </div>
      </div>

      {activeTab === 'individual' && currentInterview ? (
        <div className="space-y-6">
          
          {/* Controls Bar: Select Interview Session */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-3">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Session:</span>
              <select
                value={activeSessionId}
                onChange={(e) => setActiveSessionId(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                {interviews.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.intervieweeName} ({inv.intervieweeRole}) — {inv.systemName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0 self-end sm:self-auto">
              {onNavigateToLive && (
                <button
                  type="button"
                  onClick={() => onNavigateToLive(currentInterview.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Live Monitor</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onOpenShareModal(currentInterview)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Candidate Link</span>
              </button>

              <button
                onClick={handleReSynthesizeReport}
                disabled={isSynthesizing || !currentInterview}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSynthesizing ? 'Synthesizing...' : 'Re-Synthesize'}</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Pending Report Banner if not yet synthesized */}
          {!report && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <h3 className="text-sm font-bold text-white">Executive Summary In Progress</h3>
                  </div>
                  <p className="text-xs text-slate-400">
                    A synthesis report has not been generated for this session yet. Click "Generate AI Report" to synthesize requirements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReSynthesizeReport}
                  disabled={isSynthesizing}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSynthesizing ? 'Synthesizing...' : 'Generate AI Report'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Executive Summary Card */}
          {report && (
            <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    Executive Summary
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5 font-heading">
                    {currentInterview.systemName}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {currentInterview.intervieweeName} • {currentInterview.intervieweeRole} ({currentInterview.intervieweeDept || 'Operations'})
                  </p>
                </div>

                {/* Sentiment Pill */}
                <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Sentiment:
                  </span>
                  <div className="flex items-center space-x-1">
                    {report.overallSentiment?.dominant === 'positive' ? (
                      <Smile className="w-3.5 h-3.5 text-emerald-400" />
                    ) : report.overallSentiment?.dominant === 'negative' ? (
                      <Frown className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Meh className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="text-xs font-bold text-white capitalize">
                      {report.overallSentiment?.dominant || 'Neutral'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                {report.executiveSummary}
              </p>

              {/* Categorized Requirements Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {/* Workflows */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                    Current Workflows
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {report.currentWorkflows?.map((wf: string, idx: number) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>{wf}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Expectations */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    User Expectations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {report.userExpectations?.map((exp: string, idx: number) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-emerald-400 font-bold">•</span>
                        <span>{exp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Limitations */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    System Limitations
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {report.systemLimitations?.map((lim: string, idx: number) => (
                      <li key={idx} className="flex items-start space-x-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* RECORDED QUESTION RESPONSES WITH EMBEDDED VIDEO PLAYBACK & AI TRANSCRIPTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white font-heading">
                  Question Evidence & AI Transcripts
                </h3>
                <p className="text-xs text-slate-400">
                  Recorded stakeholder videos and synchronized transcriptions
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                {Object.keys(currentInterview.responses || {}).length} / {questionsList.length} Answered
              </span>
            </div>

            {/* Questions List */}
            <div className="space-y-5">
              {questionsList.map((q, qIndex) => {
                const response: InterviewResponse | undefined = currentInterview.responses?.[q.id];
                const videoData = response?.videoRecording;
                const transcriptData = response?.aiTranscript;
                const videoUrl = videoBlobUrls[q.id] || videoData?.videoUrl;
                const isTranscribing = transcribingQId === q.id;

                return (
                  <div
                    key={q.id}
                    id={`report-question-${q.id}`}
                    className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-md transition-all"
                  >
                    {/* Question Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center space-x-2">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center justify-center">
                            Q{qIndex + 1}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
                            {q.category.replace('_', ' ')}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-white pt-1">
                          {q.questionText}
                        </h4>
                        {q.rationale && (
                          <p className="text-xs text-slate-400 italic">
                            Focus: {q.rationale}
                          </p>
                        )}
                      </div>

                      {/* Video Status Badge */}
                      {videoData && (
                        <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold self-start shrink-0">
                          <Video className="w-3.5 h-3.5" />
                          <span>Video ({videoData.durationSeconds}s)</span>
                        </span>
                      )}
                    </div>

                    {/* Question Content: Video Player & AI Transcription */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      
                      {/* Left: Video Player */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                          <span className="flex items-center space-x-1.5">
                            <Play className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
                            <span>Video Recording</span>
                          </span>
                          {videoData?.compressionStats && (
                            <span className="text-[11px] text-emerald-400 font-mono">
                              {(videoData.compressionStats.compressedBytes / (1024 * 1024)).toFixed(1)} MB (Saved {videoData.compressionStats.savingsPercentage}%)
                            </span>
                          )}
                        </div>

                        {/* Enhanced Video Player with Speed Control, Fallback Audio & Offline Download */}
                        <AnswerVideoPlayer
                          videoRecording={videoData}
                          fallbackVideoUrl={videoUrl}
                          transcriptText={transcriptData?.transcript}
                          speakerName={currentInterview.intervieweeName}
                        />
                      </div>

                      {/* Right: AI Transcription Section */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-300 flex items-center space-x-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            <span>AI Transcript</span>
                          </span>

                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleReTranscribeVideo(q.id)}
                              disabled={isTranscribing}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-indigo-300 border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                              title="Re-run transcription"
                            >
                              <RotateCcw className={`w-3 h-3 ${isTranscribing ? 'animate-spin' : ''}`} />
                              <span>{isTranscribing ? 'Transcribing...' : 'Re-Transcribe'}</span>
                            </button>

                            {transcriptData?.transcript && (
                              <button
                                type="button"
                                onClick={() => copyTranscript(transcriptData.transcript, q.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition-colors cursor-pointer"
                                title="Copy transcript"
                              >
                                {copiedQId === q.id ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Transcript Box */}
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 min-h-[140px] flex flex-col justify-between">
                          {transcriptData ? (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 text-[11px]">
                                  <span className="text-slate-400">
                                    Speaker: <strong className="text-white">{transcriptData.speaker || currentInterview.intervieweeName}</strong>
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold text-[10px]">
                                    {transcriptData.confidence}% Confidence
                                  </span>
                                </div>

                                <p className="text-xs text-slate-200 leading-relaxed italic">
                                  "{transcriptData.transcript}"
                                </p>
                              </div>

                              {/* Extracted System Requirements Badges */}
                              {transcriptData.keyRequirements && transcriptData.keyRequirements.length > 0 && (
                                <div className="pt-2 border-t border-slate-800/60 space-y-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                                    Requirements:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {transcriptData.keyRequirements.map((reqText: string, rIdx: number) => (
                                      <span
                                        key={rIdx}
                                        className="px-2 py-0.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-[10px] text-indigo-200 font-medium"
                                      >
                                        ✓ {reqText}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : response?.responseText ? (
                            <div className="space-y-2">
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {response.responseText}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleReTranscribeVideo(q.id)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                              >
                                Generate AI transcript
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-xs text-slate-500">
                              Awaiting candidate response.
                            </div>
                          )}
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        /* COMPARISON MATRIX VIEW */
        <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-bold text-white font-heading">
              Cross-Stakeholder Requirements Matrix
            </h3>
            <p className="text-xs text-slate-400">
              Comparative view across different organizational roles and operational workflows
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300 border-collapse min-w-[600px]">
              <thead className="bg-slate-950">
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Stakeholder</th>
                  <th className="py-3 px-4">Core Workflows</th>
                  <th className="py-3 px-4">Key Pain Points</th>
                  <th className="py-3 px-4">Expectations</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {interviews.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                      <div>{inv.intervieweeName}</div>
                      <div className="text-[11px] text-indigo-400 font-normal">{inv.intervieweeRole}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs leading-relaxed">
                      {inv.summaryReport?.currentWorkflows?.[0] || 'Operational tasks'}
                    </td>
                    <td className="py-3 px-4 max-w-xs text-rose-300 leading-relaxed">
                      {inv.summaryReport?.systemLimitations?.[0] || 'None identified'}
                    </td>
                    <td className="py-3 px-4 max-w-xs text-emerald-300 leading-relaxed">
                      {inv.summaryReport?.userExpectations?.[0] || 'Reliable execution'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        {onNavigateToLive && (
                          <button
                            type="button"
                            onClick={() => onNavigateToLive(inv.id)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Live Room
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSessionId(inv.id);
                            setActiveTab('individual');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors cursor-pointer"
                        >
                          View Report
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
