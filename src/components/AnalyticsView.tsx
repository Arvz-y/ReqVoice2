import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, Brain, CheckCircle2, ChevronDown, Download, FileSearch,
  Lightbulb, MessageSquare, RefreshCw, AlertTriangle, Users, Video
} from 'lucide-react';
import { InterviewSession, SystemUnderStudy } from '../types';
import { api } from '../lib/api';

interface AnalyticsViewProps {
  interviews: InterviewSession[];
  systems: SystemUnderStudy[];
  selectedInterviewId?: string | null;
  onNavigateToTab?: (tab: string) => void;
}

type InsightItem = {
  finding?: string;
  question?: string;
  summary?: string;
  theme?: string;
  name?: string;
  description?: string;
  issue?: string;
  suggestion?: string;
  requirement?: string;
  priority?: string;
  rationale?: string;
  mentionCount?: number;
  evidenceIds?: string[];
};

type AIAnalytics = {
  systemId: string;
  systemName: string;
  generatedAt: string;
  sourceCounts: { interviews: number; responses: number; positive: number; neutral: number; negative: number; constructive: number };
  executiveSummary: string;
  keyFindings: InsightItem[];
  themes: InsightItem[];
  commonIssues: InsightItem[];
  commonSuggestions: InsightItem[];
  requirements: InsightItem[];
  questionInsights: InsightItem[];
  sentiment: { positive?: number; neutral?: number; negative?: number; constructive?: number };
  limitations: string[];
  evidence: { id: string; interviewId: string; interviewee: string; role: string; questionId: string; question: string; answer: string }[];
};

const pct = (n: number, total: number) => total ? Math.round((n / total) * 100) : 0;

const Bar: React.FC<{ label: string; value: number; total: number }> = ({ label, value, total }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-300">{label}</span>
      <span className="text-slate-500">{value} ({pct(value, total)}%)</span>
    </div>
    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
      <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${pct(value, total)}%` }} />
    </div>
  </div>
);


const LineGraph: React.FC<{ title: string; labels: string[]; series: { name: string; values: number[] }[]; max?: number }> = ({ title, labels, series, max }) => {
  const width=760,height=260,left=48,right=18,top=28,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
  const allValues=series.flatMap(s=>s.values), upper=Math.max(max||0,...allValues,1);
  const x=(i:number)=>labels.length<=1?left+plotW/2:left+(i/(labels.length-1))*plotW;
  const y=(v:number)=>top+plotH-(v/upper)*plotH;
  const points=(values:number[])=>values.map((v,i)=>x(i)+","+y(v)).join(" ");
  return <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
    <h3 className="text-sm font-bold text-white mb-3">{title}</h3>
    <div className="w-full overflow-x-auto"><svg viewBox={"0 0 "+width+" "+height} className="w-full min-w-[560px] h-64" role="img" aria-label={title}>
      {Array.from({length:5}).map((_,i)=>{const value=Math.round((upper/4)*(4-i));return <g key={i}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="currentColor" className="text-slate-800"/><text x={left-8} y={y(value)+4} textAnchor="end" className="fill-slate-500 text-[10px]">{value}</text></g>})}
      <line x1={left} x2={left} y1={top} y2={height-bottom} stroke="currentColor" className="text-slate-700"/><line x1={left} x2={width-right} y1={height-bottom} y2={height-bottom} stroke="currentColor" className="text-slate-700"/>
      {series.map((s,si)=><g key={s.name}><polyline fill="none" stroke="currentColor" className={si===0?"text-indigo-400":si===1?"text-emerald-400":"text-amber-400"} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points(s.values)}/>{s.values.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r="3.5" className={si===0?"fill-indigo-400":si===1?"fill-emerald-400":"fill-amber-400"}/>)}</g>)}
      {labels.map((label,i)=><text key={i} x={x(i)} y={height-18} textAnchor="middle" className="fill-slate-500 text-[9px]">{label}</text>)}
    </svg></div>
    <div className="flex flex-wrap gap-4 mt-1">{series.map((s,si)=><div key={s.name} className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className={"w-2.5 h-2.5 rounded-full "+(si===0?"bg-indigo-400":si===1?"bg-emerald-400":"bg-amber-400")}/>{s.name}</div>)}</div>
  </div>;
};

const InsightCard: React.FC<{ item: InsightItem; evidence: AIAnalytics['evidence']; label?: string }> = ({ item, evidence, label }) => {
  const [open, setOpen] = useState(false);
  const ids = item.evidenceIds || [];
  const supporting = evidence.filter(e => ids.includes(e.id));
  const title = item.finding || item.theme || item.name || item.issue || item.suggestion || item.requirement || 'Finding';
  const description = item.description || item.rationale;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          {label && <div className="text-[9px] uppercase tracking-widest text-indigo-400 mb-1">{label}</div>}
          <div className="text-sm font-semibold text-white">{title}</div>
          {description && <div className="text-[11px] leading-5 text-slate-400 mt-1">{description}</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.priority && <span className="text-[9px] px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-300">{item.priority}</span>}
          {typeof item.mentionCount === 'number' && <span className="text-[9px] text-slate-500">{item.mentionCount} mention{item.mentionCount === 1 ? '' : 's'}</span>}
        </div>
      </div>
      {supporting.length > 0 && (
        <button onClick={() => setOpen(!open)} className="mt-3 flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200">
          <FileSearch className="w-3.5 h-3.5" /> {open ? 'Hide' : 'Show'} supporting evidence ({supporting.length})
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
        {supporting.map(e => (
          <div key={e.id} className="rounded-lg bg-slate-900 p-3">
            <div className="text-[9px] text-slate-500 mb-1">{e.id} · {e.interviewee} · {e.role}</div>
            <div className="text-[10px] text-slate-400 mb-1">{e.question}</div>
            <div className="text-xs text-slate-200 leading-5">“{e.answer}”</div>
          </div>
        ))}
      </div>}
    </div>
  );
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ interviews, systems, selectedInterviewId, onNavigateToTab }) => {
  const selectedInterview = interviews.find(i => i.id === selectedInterviewId);
  const completed = useMemo(() => interviews.filter(i => i.status === 'completed'), [interviews]);

  // Keep systems visible even before the first completed interview. This lets
  // the analytics page be the starting point for generating the demo dataset
  // instead of trapping the user behind the "complete an interview first" state.
  const availableSystems = useMemo(() => systems, [systems]);

  const [systemId, setSystemId] = useState<string>('');
  const [aiData, setAiData] = useState<AIAnalytics | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    const preferred = selectedInterview?.systemId && availableSystems.some(s => s.id === selectedInterview.systemId)
      ? selectedInterview.systemId
      : availableSystems[0]?.id || '';
    if (!systemId || !availableSystems.some(s => s.id === systemId)) setSystemId(preferred);
  }, [selectedInterviewId, selectedInterview?.systemId, availableSystems]);

  useEffect(() => {
    setAiData(null);
    setAiError('');
  }, [systemId]);

  const scoped = useMemo(() => completed.filter(i => i.systemId === systemId), [completed, systemId]);

  const stats = useMemo(() => {
    const responses = scoped.flatMap(i => Object.values(i.responses || {}));
    const sentiment = responses.map((r: any) => r.aiTranscript?.sentiment).filter(Boolean);
    const videos = responses.filter((r: any) => r.videoRecording?.storageStatus === 'saved').length;
    const scores = responses.map((r: any) => r.aiTranscript?.sentimentScore).filter((v: any) => typeof v === 'number');
    const questions = new Map<string, { question: string; count: number }>();
    responses.forEach((r: any) => {
      const x = questions.get(r.questionId) || { question: r.questionText, count: 0 };
      x.count++;
      questions.set(r.questionId, x);
    });
    return {
      responses: responses.length, videos,
      positive: sentiment.filter(s => s === 'positive').length,
      neutral: sentiment.filter(s => s === 'neutral').length,
      negative: sentiment.filter(s => s === 'negative').length,
      constructive: sentiment.filter(s => s === 'constructive').length,
      avgScore: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
      questions: [...questions.values()],
    };
  }, [scoped]);

  const selectedSystem = systems.find(s => s.id === systemId);

  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState('');

  const generateDemo = async () => {
    setDemoLoading(true); setDemoMessage('');
    try {
      const result = await api.interviews.generateDemoDataset();
      setDemoMessage(result.created > 0 ? `Generated ${result.created} demo interviews with synthetic answers.` : 'Demo dataset already exists. No duplicates were created.');
      window.location.reload();
    } catch (e: any) {
      setDemoMessage(e?.message || 'Demo dataset generation failed.');
    } finally { setDemoLoading(false); }
  };

  const generateAI = async () => {
    if (!systemId) return;
    setLoadingAI(true); setAiError('');
    try {
      const result = await api.interviews.analyticsAI(systemId);
      setAiData(result);
    } catch (e: any) {
      setAiError(e?.message || 'AI analytics could not be generated.');
    } finally {
      setLoadingAI(false);
    }
  };

  const exportAnalytics = () => {
    const payload = {
      system: selectedSystem || { id: systemId },
      generatedAt: new Date().toISOString(),
      statistics: stats,
      aiAnalysis: aiData,
      interviews: scoped.map(i => ({
        id: i.id, interviewee: i.intervieweeName, role: i.intervieweeRole,
        completedAt: i.completedAt, responses: Object.values(i.responses || {}).map((r: any) => ({
          question: r.questionText, answer: r.aiTranscript?.transcript || r.responseText,
          sentiment: r.aiTranscript?.sentiment || null
        }))
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reqvoice-analytics-${(selectedSystem?.name || 'system').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!systemId && availableSystems.length === 0) {
    return (
      <div className="rounded-2xl border border-indigo-500/20 bg-slate-900 p-8 sm:p-10 text-center">
        <Activity className="w-10 h-10 mx-auto text-indigo-400 mb-3" />
        <h2 className="text-lg font-bold text-white">Interview Analytics</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-lg mx-auto">
          Analytics are generated from completed interview answers. You can first create an interview
          from <strong className="text-slate-200">Systems & Guides</strong>, or use the demo workspace
          to populate realistic synthetic interviews and answers.
        </p>
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          <button
            onClick={() => onNavigateToTab?.('systems')}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-200 text-xs font-semibold hover:bg-slate-800"
          >
            Go to Systems & Guides
          </button>
          <button
            onClick={generateDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold disabled:opacity-50"
          >
            {demoLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            {demoLoading ? 'Generating…' : 'Set Up Demo Interviews'}
          </button>
        </div>
        {demoMessage && <div className="text-[10px] text-emerald-300 mt-4">{demoMessage}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white font-heading">Interview Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">Analytics are scoped to the selected system under study and calculated from completed interview answers.</p>
          {scoped.length === 0 && (
            <p className="text-[10px] text-amber-300 mt-2">
              No completed answers for this system yet. Generate demo data or complete an interview to populate the charts.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={systemId} onChange={e => setSystemId(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none">
            {availableSystems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={generateDemo} disabled={demoLoading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 text-emerald-300 text-xs disabled:opacity-50" title="Creates synthetic interviews and answers for testing">
            {demoLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            {demoLoading ? 'Generating…' : 'Generate Demo Data'}
          </button>
          <button onClick={generateAI} disabled={loadingAI || !systemId} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50">
            {loadingAI ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {loadingAI ? 'Analyzing…' : 'Analyze with AI'}
          </button>
          <button onClick={exportAnalytics} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        {demoMessage && <div className="text-[10px] text-emerald-300 lg:text-right">{demoMessage}</div>}
      </div>

      {selectedSystem && (
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="text-[9px] uppercase tracking-widest text-indigo-400">System Under Study</div>
          <div className="text-lg font-bold text-white mt-1">{selectedSystem.name}</div>
          <div className="text-xs text-slate-400 mt-1">{selectedSystem.description}</div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Completed Interviews', scoped.length, Users],
          ['Total Answers', stats.responses, MessageSquare],
          ['Stored Videos', stats.videos, Video],
          ['Avg. Sentiment', stats.avgScore == null ? '—' : stats.avgScore, Activity],
          ['Questions Answered', stats.questions.length, CheckCircle2],
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400"><span className="text-[10px]">{label}</span><Icon className="w-4 h-4 text-indigo-400" /></div>
            <div className="mt-2 text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {scoped.length > 0 && (() => {
        const ordered=[...scoped].sort((a,b)=>new Date(a.completedAt||0).getTime()-new Date(b.completedAt||0).getTime());
        const labels=ordered.map((_,i)=>"I"+(i+1));
        const sentimentSeries=[
          {name:"Positive",values:ordered.map(i=>Object.values(i.responses||{}).filter((r:any)=>r.aiTranscript?.sentiment==="positive").length)},
          {name:"Constructive",values:ordered.map(i=>Object.values(i.responses||{}).filter((r:any)=>r.aiTranscript?.sentiment==="constructive").length)},
          {name:"Negative",values:ordered.map(i=>Object.values(i.responses||{}).filter((r:any)=>r.aiTranscript?.sentiment==="negative").length)}
        ];
        const responseSeries=[{name:"Answers per interview",values:ordered.map(i=>Object.values(i.responses||{}).length)}];
        return <div className="grid lg:grid-cols-2 gap-4"><LineGraph title="Answer Sentiment Trend" labels={labels} series={sentimentSeries}/><LineGraph title="Answers per Interview" labels={labels} series={responseSeries}/></div>;
      })()}

      {aiError && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-300"><AlertTriangle className="inline w-4 h-4 mr-2" />{aiError}</div>}

      {aiData ? (
        <>
          <div className="rounded-2xl bg-slate-900 border border-indigo-500/20 p-5">
            <div className="flex items-center gap-2 text-indigo-300 text-sm font-bold"><Brain className="w-4 h-4" /> AI Executive Summary</div>
            <p className="text-sm leading-6 text-slate-300 mt-3">{aiData.executiveSummary}</p>
            <div className="text-[9px] text-slate-600 mt-3">Generated from {aiData.sourceCounts.interviews} completed interview(s) and {aiData.sourceCounts.responses} answer(s). AI output is grounded in the supplied evidence.</div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-indigo-400" /> Key Findings & Themes</h3>
              <div className="space-y-3">
                {[...(aiData.keyFindings || []), ...(aiData.themes || [])].slice(0, 8).map((x, i) => <InsightCard key={i} item={x} evidence={aiData.evidence} />)}
              </div>
            </section>
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-indigo-400" /> Common Issues</h3>
              <div className="space-y-3">{(aiData.commonIssues || []).slice(0, 8).map((x, i) => <InsightCard key={i} item={x} evidence={aiData.evidence} />)}</div>
            </section>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><Lightbulb className="w-4 h-4 text-indigo-400" /> Common Suggestions</h3>
              <div className="space-y-3">{(aiData.commonSuggestions || []).slice(0, 8).map((x, i) => <InsightCard key={i} item={x} evidence={aiData.evidence} />)}</div>
            </section>
            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Derived Requirements</h3>
              <div className="space-y-3">{(aiData.requirements || []).slice(0, 8).map((x, i) => <InsightCard key={i} item={x} evidence={aiData.evidence} />)}</div>
            </section>
          </div>

          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><MessageSquare className="w-4 h-4 text-indigo-400" /> Question-by-Question Insights</h3>
            <div className="space-y-3">{(aiData.questionInsights || []).map((x, i) => <InsightCard key={i} item={{ ...x, finding: x.question || x.finding, description: x.summary || x.description }} evidence={aiData.evidence} label={`Question ${i + 1}`} />)}</div>
          </section>

          {aiData.limitations?.length > 0 && <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h3 className="text-sm font-bold text-amber-200 mb-2">Analysis Limitations</h3>
            <ul className="text-xs text-amber-100/70 space-y-1">{aiData.limitations.map((x, i) => <li key={i}>• {x}</li>)}</ul>
          </section>}

          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
            <h3 className="text-sm font-bold text-white mb-3">Evidence Used by AI</h3>
            <p className="text-[11px] text-slate-500 mb-3">Every AI finding can be traced back to these actual interview answers. This evidence remains separate from AI interpretation.</p>
            <div className="grid md:grid-cols-2 gap-3">
              {aiData.evidence.slice(0, 30).map(e => <div key={e.id} className="rounded-xl bg-slate-950 p-3 border border-slate-800"><div className="text-[9px] text-indigo-400">{e.id} · {e.interviewee}</div><div className="text-[10px] text-slate-500 mt-1">{e.question}</div><div className="text-xs text-slate-300 mt-2 leading-5">{e.answer}</div></div>)}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center">
          <Brain className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
          <h3 className="text-sm font-bold text-white">AI analysis is ready</h3>
          <p className="text-xs text-slate-500 mt-1">Click “Analyze with AI” to identify themes, issues, suggestions, requirements, sentiment, and question-level insights from this system’s completed interview answers.</p>
        </div>
      )}
    </div>
  );
};
