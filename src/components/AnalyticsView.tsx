import React, { useMemo } from 'react';
import { Activity, BarChart3, MessageSquare, TrendingUp, Video, Users } from 'lucide-react';
import { InterviewSession } from '../types';

interface AnalyticsViewProps {
  interviews: InterviewSession[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const LineChart: React.FC<{ data: { label: string; value: number }[]; title: string; suffix?: string }> = ({ data, title, suffix = '' }) => {
  const width = 760;
  const height = 260;
  const pad = { left: 48, right: 24, top: 28, bottom: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = 100;
  const points = data.map((d, i) => {
    const x = data.length <= 1 ? pad.left + plotW / 2 : pad.left + (i * plotW) / (data.length - 1);
    const y = pad.top + plotH - (clamp(d.value, 0, max) / max) * plotH;
    return { ...d, x, y };
  });
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">0–100{suffix}</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px] h-[260px]" role="img" aria-label={title}>
          {[0, 25, 50, 75, 100].map(v => {
            const y = pad.top + plotH - (v / 100) * plotH;
            return (
              <g key={v}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="currentColor" className="text-slate-800" strokeWidth="1" />
                <text x={pad.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[10px]">{v}</text>
              </g>
            );
          })}
          {points.length > 0 && <path d={path} fill="none" stroke="currentColor" className="text-indigo-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((p, i) => (
            <g key={`${p.label}-${i}`}>
              <circle cx={p.x} cy={p.y} r="4.5" fill="currentColor" className="text-indigo-400" />
              <text x={p.x} y={p.y - 11} textAnchor="middle" className="fill-slate-300 text-[9px]">{Math.round(p.value)}{suffix}</text>
              <text x={p.x} y={height - 15} textAnchor="middle" className="fill-slate-500 text-[9px]">{p.label}</text>
            </g>
          ))}
          {points.length === 0 && <text x={width / 2} y={height / 2} textAnchor="middle" className="fill-slate-500 text-sm">No completed feedback yet</text>}
        </svg>
      </div>
    </div>
  );
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ interviews }) => {
  const completed = useMemo(() => interviews.filter(i => i.status === 'completed'), [interviews]);

  const analytics = useMemo(() => {
    const sessions = [...completed].sort((a, b) => new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime());
    const sentiment = (inv: InterviewSession) => {
      const values = Object.values(inv.responses || {})
        .map((r: any) => r.aiTranscript?.sentimentScore)
        .filter((v: any) => typeof v === 'number');
      return values.length ? values.reduce((a: number, b: number) => a + b, 0) / values.length : null;
    };
    const trend = sessions.map((inv, idx) => ({
      label: new Date(inv.completedAt || inv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: sentiment(inv) ?? 0,
      index: idx,
    }));
    const candidates = sessions.map(inv => ({
      name: inv.intervieweeName || 'Anonymous',
      role: inv.intervieweeRole || 'Stakeholder',
      score: sentiment(inv),
      responses: Object.keys(inv.responses || {}).length,
      videos: Object.values(inv.responses || {}).filter((r: any) => r.videoRecording?.storageStatus === 'saved').length,
    }));
    const avg = trend.length ? trend.reduce((a, b) => a + b.value, 0) / trend.length : 0;
    const videoCount = candidates.reduce((a, c) => a + c.videos, 0);
    const responseCount = candidates.reduce((a, c) => a + c.responses, 0);
    return { trend, candidates, avg, videoCount, responseCount };
  }, [completed]);

  const comparison = analytics.candidates.map(c => ({ label: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name, value: c.score ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-heading">Interview Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">Clear trends and candidate feedback comparisons based only on recorded interview evidence.</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <Activity className="w-3.5 h-3.5" /> Live from interview results
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Completed Sessions', completed.length, Users],
          ['Responses', analytics.responseCount, MessageSquare],
          ['Stored Videos', analytics.videoCount, Video],
          ['Avg. Feedback Score', Math.round(analytics.avg), TrendingUp],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400"><span className="text-[11px]">{label}</span><Icon className="w-4 h-4 text-indigo-400" /></div>
            <div className="mt-2 text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <LineChart data={analytics.trend} title="Feedback Trend Over Time" suffix="" />

      <LineChart data={comparison} title="Candidate Feedback Comparison" suffix="" />

      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-400" /> Candidate Feedback Details</h3>
          <p className="text-[11px] text-slate-500 mt-1">Scores are averages of available AI sentiment scores from verified recorded responses.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[620px]">
            <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr><th className="text-left p-3">Candidate / Stakeholder</th><th className="text-left p-3">Role</th><th className="text-right p-3">Responses</th><th className="text-right p-3">Stored Videos</th><th className="text-right p-3">Feedback Score</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {analytics.candidates.map((c, i) => (
                <tr key={`${c.name}-${i}`} className="hover:bg-slate-800/30">
                  <td className="p-3 font-semibold text-white">{c.name}</td>
                  <td className="p-3 text-slate-400">{c.role}</td>
                  <td className="p-3 text-right text-slate-300">{c.responses}</td>
                  <td className="p-3 text-right text-slate-300">{c.videos}</td>
                  <td className="p-3 text-right font-semibold text-indigo-300">{c.score == null ? 'No recorded score' : Math.round(c.score)}</td>
                </tr>
              ))}
              {analytics.candidates.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Complete an interview to populate analytics.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
