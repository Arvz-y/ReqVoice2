import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Download,
  FileText,
  Copy,
  Check,
  Code2,
  Table,
} from 'lucide-react';
import { api } from '../lib/api';

export const DatabaseView: React.FC = () => {
  const [dbStats, setDbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mysqlSchema, setMysqlSchema] = useState<string>('');
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    loadStats();
    loadSchema();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await api.database.getStats();
      setDbStats(data);
    } catch (e) {
      console.warn('Failed to load DB stats', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSchema = async () => {
    try {
      const schemaText = await api.database.getMysqlSchema();
      setMysqlSchema(schemaText);
    } catch (e) {
      console.warn('Failed to load MySQL schema', e);
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(mysqlSchema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-heading">
            MySQL Database & Archives
          </h2>
          <p className="text-xs text-slate-400">
            Relational storage, single-file schema exports, and markdown reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadStats}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href={api.database.downloadMysqlDumpUrl}
            download="reqvoice_mysql_dump.sql"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export MySQL (.sql)</span>
          </a>

          <a
            href={api.database.downloadSingleReportUrl}
            download="reqvoice_complete_report.md"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Report (.md)</span>
          </a>
        </div>
      </div>

      {/* Storage & Compression Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Recordings</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white font-heading">
            {dbStats?.storageMetrics?.totalVideosRecorded || 0}
          </p>
          <p className="text-[11px] text-slate-500">VP8 compressed</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Vault Size</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-400 font-heading">
            {dbStats?.storageMetrics?.compressedStorageMb || 0} MB
          </p>
          <p className="text-[11px] text-slate-500">SD 640x480 @ 600 kbps</p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Raw Equivalent</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-400 font-heading">
            {dbStats?.storageMetrics?.estimatedRawStorageMb || 0} MB
          </p>
          <p className="text-[11px] text-slate-500">Uncompressed weight</p>
        </div>
      </div>

      {/* MySQL Schema Specifications */}
      <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white font-heading flex items-center space-x-2">
              <Table className="w-4 h-4 text-indigo-400" />
              <span>MySQL Relational Tables</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Foreign key constraints, UTF8mb4 encoding, and indexing
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSchemaModal(!showSchemaModal)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showSchemaModal ? 'Hide DDL' : 'View DDL'}</span>
            </button>
            <button
              onClick={handleCopySchema}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchema ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Live SQL Preview Box if toggled */}
        {showSchemaModal && (
          <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-300 max-h-72 overflow-y-auto leading-relaxed shadow-inner">
            <pre>{mysqlSchema || '/* Loading MySQL Schema... */'}</pre>
          </div>
        )}

        {/* Relational Table Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-400">users</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">Auth</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Users with credentials, roles, avatar, and tutorial progress.
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-1 truncate">
              id (PK) • username • email • role • avatar_url
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-400">systems_under_study</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">Catalog</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Systems under review, lifecycle states, and stakeholder personas.
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-1 truncate">
              id (PK) • name • type • lifecycle_state • target_roles_json
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-400">interviews</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">Sessions</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Interviewer credentials, candidate info, and share tokens.
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-1 truncate">
              id (PK) • system_id (FK) • interviewer_id • share_token
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-400">interview_questions</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">Protocols</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Inquiry items with focus rationale and system categories.
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-1 truncate">
              id (PK) • interview_id (FK) • category • question_text
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-400">interview_responses</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Transcripts</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Candidate answers, Gemini transcription, and sentiment ratings.
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-1 truncate">
              id (PK) • interview_id (FK) • response_text • ai_transcript_json
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-400">video_vault</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Media</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              VP8 video metadata, duration, compression ratios, and storage IDs.
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-1 truncate">
              id (PK) • response_id (FK) • duration_seconds • compressed_size
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
