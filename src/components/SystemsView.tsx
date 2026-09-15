import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { SystemUnderStudy, InterviewQuestion, InterviewType } from '../types';
import { api } from '../lib/api';

interface SystemsViewProps {
  systems: SystemUnderStudy[];
  onRefreshSystems: () => void;
  onLaunchInterviewForSystem: (system: SystemUnderStudy) => void;
}

export const SystemsView: React.FC<SystemsViewProps> = ({
  systems,
  onRefreshSystems,
  onLaunchInterviewForSystem,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<SystemUnderStudy | null>(systems[0] || null);
  const [systemToDelete, setSystemToDelete] = useState<SystemUnderStudy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemType, setNewSystemType] = useState('Enterprise Application');
  const [newSystemDesc, setNewSystemDesc] = useState('');
  const [newSystemLifecycle, setNewSystemLifecycle] = useState<'existing' | 'proposed' | 'modernization'>('existing');
  const [isCreating, setIsCreating] = useState(false);

  // AI question suggestions
  const [suggestedQuestions, setSuggestedQuestions] = useState<InterviewQuestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>('Semi-Structured');

  useEffect(() => {
    if (selectedSystem && !systems.some((s) => s.id === selectedSystem.id)) {
      setSelectedSystem(systems[0] || null);
    } else if (!selectedSystem && systems.length > 0) {
      setSelectedSystem(systems[0]);
    }
  }, [systems, selectedSystem]);

  const handleCreateSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSystemName.trim()) return;

    setIsCreating(true);
    try {
      const res = await api.systems.create({
        name: newSystemName,
        type: newSystemType,
        description: newSystemDesc,
        lifecycleState: newSystemLifecycle,
        targetRoles: ['End User', 'Operational Lead', 'System Architect'],
      });
      onRefreshSystems();
      setSelectedSystem(res.system);
      setShowCreateModal(false);
      setNewSystemName('');
      setNewSystemDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to create system');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSystem = async () => {
    if (!systemToDelete) return;
    setIsDeleting(true);
    try {
      await api.systems.delete(systemToDelete.id);
      onRefreshSystems();
      if (selectedSystem?.id === systemToDelete.id) {
        const remaining = systems.filter((s) => s.id !== systemToDelete.id);
        setSelectedSystem(remaining[0] || null);
      }
      setSystemToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to remove system');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateQuestions = async () => {
    if (!selectedSystem) return;
    setIsSuggesting(true);
    try {
      const res = await api.gemini.suggestQuestions({
        systemName: selectedSystem.name,
        systemType: selectedSystem.type,
        role: selectedSystem.targetRoles[0] || 'Stakeholder',
        interviewType: interviewType,
      });
      setSuggestedQuestions(res.questions);
    } catch (err: any) {
      alert(err.message || 'Suggestion failed');
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-heading">
            Systems & Interview Guides
          </h2>
          <p className="text-xs text-slate-400">
            Define system scope, target stakeholder personas, and generate AI questionnaires
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register System</span>
        </button>
      </div>

      {/* Grid: Systems List & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Systems List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Systems ({systems.length})
            </h3>
          </div>

          <div className="space-y-2.5">
            {systems.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-400">No systems registered yet.</p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-2 cursor-pointer"
                >
                  Register your first system
                </button>
              </div>
            ) : (
              systems.map((sys) => {
                const isSelected = selectedSystem?.id === sys.id;
                return (
                  <div
                    key={sys.id}
                    onClick={() => {
                      setSelectedSystem(sys);
                      setSuggestedQuestions([]);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500 shadow-md'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white truncate">{sys.name}</span>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {sys.lifecycleState}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSystemToDelete(sys);
                          }}
                          title="Remove System"
                          aria-label={`Remove system ${sys.name}`}
                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{sys.description}</p>
                    <div className="text-[10px] text-slate-500 font-medium">
                      {sys.type}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected System Details & AI Questioning Protocol */}
        <div className="lg:col-span-8 space-y-6">
          {selectedSystem ? (
            <div className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    System Profile
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5 font-heading">
                    {selectedSystem.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">{selectedSystem.description}</p>
                </div>

                <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setSystemToDelete(selectedSystem)}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove System</span>
                  </button>

                  <button
                    onClick={() => onLaunchInterviewForSystem(selectedSystem)}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    <span>Start Interview</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Roles */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300">Stakeholders:</span>
                <div className="flex flex-wrap gap-2">
                  {selectedSystem.targetRoles?.map((role, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* AI Question Protocol Generator */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Gemini AI Question Protocol</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Auto-generate categorized questions according to the selected interview type
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateQuestions}
                    disabled={isSuggesting}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto shrink-0"
                  >
                    <span>{isSuggesting ? 'Generating...' : `Generate ${interviewType}`}</span>
                  </button>
                </div>

                {/* Interview Type Selection */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Interview Protocol:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['Structured', 'Semi-Structured', 'Unstructured'] as InterviewType[]).map((typeKey, idx) => {
                      const isSelected = interviewType === typeKey;
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => setInterviewType(typeKey)}
                          className={`p-2 rounded-xl text-left border text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-800 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/50'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <div className="font-bold flex items-center space-x-1.5">
                            <span className="text-[10px] text-indigo-400 font-mono">{idx + 1}.</span>
                            <span>{typeKey}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {typeKey === 'Structured'
                              ? 'Rigid, quantitative SLA metrics'
                              : typeKey === 'Semi-Structured'
                              ? 'Guided core + flexible probes'
                              : 'Open-ended vision & narrative'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {suggestedQuestions.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    {suggestedQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-400">
                            {q.category}
                          </span>
                          <span className="text-xs font-semibold text-white">{q.questionText}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">Rationale: {q.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-8 sm:p-12 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white font-heading">No System Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Register or select a system under study to configure stakeholder protocols and generate AI questionnaires.
              </p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register System</span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Modal: Create System */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <h3 className="text-base sm:text-lg font-bold text-white font-heading">Register System Under Study</h3>
            <form onSubmit={handleCreateSystem} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">System Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Global Supply Chain ERP"
                  value={newSystemName}
                  onChange={(e) => setNewSystemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Type / Category</label>
                <input
                  type="text"
                  placeholder="e.g. Supply Chain, FinTech, EMR/EHR"
                  value={newSystemType}
                  onChange={(e) => setNewSystemType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Lifecycle State</label>
                <select
                  value={newSystemLifecycle}
                  onChange={(e: any) => setNewSystemLifecycle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="existing">Existing Legacy System</option>
                  <option value="modernization">Modernization & Migration</option>
                  <option value="proposed">Proposed Greenfield System</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Scope & Problem Statement</label>
                <textarea
                  rows={3}
                  placeholder="Describe the operational goals, pain points, and boundaries..."
                  value={newSystemDesc}
                  onChange={(e) => setNewSystemDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                >
                  {isCreating ? 'Saving...' : 'Save System'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete System Confirmation */}
      {systemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="max-w-md w-full my-6 p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white font-heading">Remove System Under Study</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-white">"{systemToDelete.name}"</span>?
            </p>
            <p className="text-xs text-rose-400/90 leading-relaxed bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
              This action will permanently delete this system profile and all corresponding interview questionnaire records associated with it.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setSystemToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSystem}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Removing...' : 'Confirm Removal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
