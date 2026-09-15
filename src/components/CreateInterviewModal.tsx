import React, { useState } from 'react';
import {
  X,
  Sparkles,
  User,
  Briefcase,
  Mail,
  Building,
  Plus,
  Trash2,
  Bot,
  PenTool,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { SystemUnderStudy, InterviewQuestion, InterviewType } from '../types';
import { api } from '../lib/api';

interface CreateInterviewModalProps {
  systems: SystemUnderStudy[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newInterview: any) => void;
}

const CATEGORY_OPTIONS: { id: InterviewQuestion['category']; label: string }[] = [
  { id: 'workflow', label: 'Daily Workflow & Cadence' },
  { id: 'pain_point', label: 'Bottlenecks & Pain Points' },
  { id: 'expectation', label: 'SLA & Latency Expectations' },
  { id: 'limitation', label: 'Architectural Limitations' },
  { id: 'desired_feature', label: 'Prioritized Desired Features' },
];

const INTERVIEW_TYPE_DETAILS: Record<
  InterviewType,
  {
    num: string;
    label: string;
    badgeColor: string;
    description: string;
    defaultPrompt: string;
    questions: Partial<InterviewQuestion>[];
  }
> = {
  Structured: {
    num: '1',
    label: 'Structured',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Standardized, quantifiable, closed-loop inquiry. Strict numeric SLA targets (< ms), inputs/outputs, and acceptance test criteria.',
    defaultPrompt: 'Generate standardized, quantifiable questions focusing on exact step-by-step inputs, numerical SLA thresholds (< ms), failure frequencies, and strict acceptance criteria.',
    questions: [
      {
        id: 'sq-1',
        category: 'workflow',
        questionText: 'What are the exact step-by-step inputs, validation checks, and data transformations executed in this operational sequence?',
        rationale: 'Map precise sequential data flow and operational business rules without ambiguity',
        suggestedFollowups: ['What is the exact maximum character length and format for each input parameter?'],
      },
      {
        id: 'sq-2',
        category: 'pain_point',
        questionText: 'What is the measured frequency of system failures per week, and what is the exact average downtime in minutes?',
        rationale: 'Quantify operational incident impact, MTTR, and failure severity with numeric metrics',
        suggestedFollowups: ['What percentage of failure incidents result in manual data recovery procedures?'],
      },
      {
        id: 'sq-3',
        category: 'expectation',
        questionText: 'What are the mandatory numerical SLA targets for API response latency (< ms) and peak concurrent user throughput?',
        rationale: 'Establish quantifiable non-functional criteria and SLA compliance thresholds',
        suggestedFollowups: ['What is the maximum allowable latency under 99th percentile peak load?'],
      },
      {
        id: 'sq-4',
        category: 'limitation',
        questionText: 'Which specific database locks, third-party API rate limits, or batch window durations restrict current transaction throughput?',
        rationale: 'Identify hard technical boundaries and architectural concurrency caps',
        suggestedFollowups: ['What is the exact query timeout threshold currently configured in the database?'],
      },
      {
        id: 'sq-5',
        category: 'desired_feature',
        questionText: 'What are the top 3 functional capabilities required for Phase 1 acceptance criteria, ranked in strict order of priority?',
        rationale: 'Establish formal ISO/IEC requirements acceptance baseline and scoring criteria',
        suggestedFollowups: ['What quantitative metric will verify successful deployment of each capability?'],
      },
    ],
  },
  'Semi-Structured': {
    num: '2',
    label: 'Semi-Structured',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    description: 'Guided core framework combining standardized functional questions with exploratory follow-up probes for deeper insights into manual friction.',
    defaultPrompt: 'Focus on daily routine workflows, acute operational bottlenecks, SLA response time requirements, system architecture limitations, and top prioritized features.',
    questions: [
      {
        id: 'ssq-1',
        category: 'workflow',
        questionText: 'Can you walk through your primary daily operational workflows in the current system?',
        rationale: 'Establish baseline operational cadence and user task allocations',
        suggestedFollowups: ['Which step in this workflow takes the most human attention?'],
      },
      {
        id: 'ssq-2',
        category: 'pain_point',
        questionText: 'What are the most frustrating bottlenecks, manual workarounds, or errors you encounter?',
        rationale: 'Identify acute friction points and process vulnerabilities',
        suggestedFollowups: ['How many hours each week are lost managing this workaround?'],
      },
      {
        id: 'ssq-3',
        category: 'expectation',
        questionText: 'What are your core expectations for system latency, response time, and user ergonomics?',
        rationale: 'Discover non-functional requirements and SLA benchmarks',
        suggestedFollowups: ['What sub-second latency is considered acceptable?'],
      },
      {
        id: 'ssq-4',
        category: 'limitation',
        questionText: 'Where does the current software architecture fail or prevent your team from achieving goals?',
        rationale: 'Expose architectural boundaries and integration bottlenecks',
        suggestedFollowups: ['Is the delay in data ingestion, indexing, or batch sync?'],
      },
      {
        id: 'ssq-5',
        category: 'desired_feature',
        questionText: 'If you could prioritize three essential capabilities for the new system, what would they be?',
        rationale: 'Collect prioritized stakeholder requirements',
        suggestedFollowups: ['Which of these is a non-negotiable prerequisite to adoption?'],
      },
    ],
  },
  Unstructured: {
    num: '3',
    label: 'Unstructured',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Open-ended, conversational, and exploratory inquiry designed to uncover stakeholder narratives, team morale, informal workarounds, and organizational vision.',
    defaultPrompt: 'Explore high-level organizational vision, emotional pain points, team morale, informal workarounds, and unstated assumptions through open-ended questions.',
    questions: [
      {
        id: 'uq-1',
        category: 'workflow',
        questionText: "From your perspective, how does your department's day-to-day work fit into the bigger mission of the organization?",
        rationale: 'Explore high-level stakeholder context, organizational environment, and collaborative dynamics',
        suggestedFollowups: ["How has the nature of your team's day-to-day work evolved over recent years?"],
      },
      {
        id: 'uq-2',
        category: 'pain_point',
        questionText: 'What aspects of the current technology cause the most friction or headaches for your team on a human level?',
        rationale: 'Uncover emotional pain points, team fatigue, and hidden informal workarounds',
        suggestedFollowups: ['If you could wave a magic wand and eliminate one daily annoyance, what would it be?'],
      },
      {
        id: 'uq-3',
        category: 'expectation',
        questionText: 'If this new system were an absolute dream to use every day, what would that feel like for your team?',
        rationale: 'Discover strategic user vision, qualitative delight factors, and emotional expectations',
        suggestedFollowups: ['How would you measure whether this project was a runaway success one year from now?'],
      },
      {
        id: 'uq-4',
        category: 'limitation',
        questionText: 'What organizational or technological hurdles seem to hold your department back the most right now?',
        rationale: 'Surface unspoken cultural, policy, and systemic barriers to organizational change',
        suggestedFollowups: ['Are there legacy policies or habits that might clash with modern workflows?'],
      },
      {
        id: 'uq-5',
        category: 'desired_feature',
        questionText: 'Looking forward, what kind of innovations or superpowers would make the biggest meaningful difference in your work life?',
        rationale: 'Gather open-ended aspirational capabilities, innovation ideas, and strategic roadmap value',
        suggestedFollowups: ['What new opportunities could your team pursue if routine manual work was automated?'],
      },
    ],
  },
};

export const CreateInterviewModal: React.FC<CreateInterviewModalProps> = ({
  systems,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [systemId, setSystemId] = useState(systems[0]?.id || '');
  const [customSystemName, setCustomSystemName] = useState('');
  const [intervieweeName, setIntervieweeName] = useState('');
  const [intervieweeRole, setIntervieweeRole] = useState('');
  const [intervieweeEmail, setIntervieweeEmail] = useState('');
  const [intervieweeDept, setIntervieweeDept] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>('Semi-Structured');

  // Questionnaire creation mode: 'ai' or 'manual'
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');

  // AI Prompt Builder State
  const [aiPrompt, setAiPrompt] = useState(INTERVIEW_TYPE_DETAILS['Semi-Structured'].defaultPrompt);
  const [questionCount, setQuestionCount] = useState(5);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Manual Question Builder State
  const [manualText, setManualText] = useState('');
  const [manualCategory, setManualCategory] = useState<InterviewQuestion['category']>('workflow');
  const [manualRationale, setManualRationale] = useState('');

  // Configured Questions list initialized with Semi-Structured template
  const [questions, setQuestions] = useState<Partial<InterviewQuestion>[]>(
    INTERVIEW_TYPE_DETAILS['Semi-Structured'].questions
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSystem = systems.find((s) => s.id === systemId) || systems[0];

  // Change interview type handler
  const handleSelectInterviewType = (type: InterviewType) => {
    setInterviewType(type);
    setAiPrompt(INTERVIEW_TYPE_DETAILS[type].defaultPrompt);
  };

  // Handler to load the preset questions for currently selected interview type
  const handleLoadTypePresetQuestions = (type: InterviewType) => {
    setQuestions(INTERVIEW_TYPE_DETAILS[type].questions);
  };

  // Direct 1-click AI Question Generation tailored to chosen interview type
  const handleGenerateForType = async (type: InterviewType) => {
    handleSelectInterviewType(type);
    setCreationMode('ai');
    setIsGeneratingAI(true);
    setValidationError(null);
    try {
      const res = await api.gemini.suggestQuestions({
        systemName: currentSystem?.name || customSystemName || 'Enterprise System',
        systemType: currentSystem?.type || 'Business Application',
        role: intervieweeRole || 'Stakeholder',
        prompt: INTERVIEW_TYPE_DETAILS[type].defaultPrompt,
        count: questionCount,
        interviewType: type,
      });

      if (res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
      }
    } catch (err: any) {
      setValidationError(`AI generation failed: ${err.message || 'Please check your connection'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Handler: Prompt AI to generate questions with current prompt
  const handlePromptAI = async () => {
    if (!aiPrompt.trim()) {
      setValidationError('Please provide prompt instructions for the AI.');
      return;
    }

    setValidationError(null);
    setIsGeneratingAI(true);
    try {
      const res = await api.gemini.suggestQuestions({
        systemName: currentSystem?.name || customSystemName || 'Enterprise System',
        systemType: currentSystem?.type || 'Business Application',
        role: intervieweeRole || 'Stakeholder',
        prompt: aiPrompt,
        count: questionCount,
        interviewType: interviewType,
      });

      if (res.questions && res.questions.length > 0) {
        setQuestions(res.questions);
      }
    } catch (err: any) {
      setValidationError(`AI generation failed: ${err.message || 'Please check your connection'}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Handler: Add question manually
  const handleAddManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) {
      setValidationError('Please enter question text.');
      return;
    }

    setValidationError(null);
    const newQ: Partial<InterviewQuestion> = {
      id: `q-manual-${Date.now().toString(36)}-${questions.length}`,
      category: manualCategory,
      questionText: manualText.trim(),
      rationale: manualRationale.trim() || 'Requirements gathering',
      suggestedFollowups: [],
    };

    setQuestions((prev) => [...prev, newQ]);
    setManualText('');
    setManualRationale('');
  };

  // Handler: Remove question
  const handleRemoveQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intervieweeName.trim()) {
      setValidationError('Please specify the interviewee name.');
      return;
    }
    if (questions.length === 0) {
      setValidationError('Please add at least one question to the questionnaire before creating the session.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    try {
      let targetSystemId = systemId;
      if (!targetSystemId && systems.length === 0) {
        if (!customSystemName.trim()) {
          setValidationError('Please enter the System Under Study name.');
          setIsSubmitting(false);
          return;
        }
        const created = await api.systems.create({
          name: customSystemName.trim(),
          type: 'Business Application',
          description: 'System registered for requirements elicitation and interview workflow',
          lifecycleState: 'modernization',
          targetRoles: [intervieweeRole.trim() || 'Stakeholder'],
        });
        targetSystemId = created.system.id;
      } else if (!targetSystemId && systems.length > 0) {
        targetSystemId = systems[0].id;
      }

      const res = await api.interviews.create({
        systemId: targetSystemId,
        intervieweeName: intervieweeName.trim(),
        intervieweeRole: intervieweeRole.trim() || 'Stakeholder',
        intervieweeEmail: intervieweeEmail.trim(),
        intervieweeDept: intervieweeDept.trim() || 'Operations',
        interviewType: interviewType,
        questions,
      });

      onSuccess(res.interview);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to create interview session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-2xl w-full my-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                Session Setup
              </span>
              <h3 className="text-lg font-bold text-white font-heading">
                New Interview Session
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Create the stakeholder questionnaire manually or prompt the AI to generate tailored questions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-950 border border-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {validationError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Section 1: System & Stakeholder Metadata */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>System Under Study</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {systems.length} Systems Available
              </span>
            </div>
            
            {systems.length > 0 ? (
              <select
                value={systemId}
                onChange={(e) => setSystemId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.lifecycleState})
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Enter system name (e.g. Core Banking Platform, E-Prescription Portal)"
                  value={customSystemName}
                  onChange={(e) => setCustomSystemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500">
                  No registered systems found. Enter a system name above and it will be created for this interview.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Interviewee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Alex Mercer"
                  value={intervieweeName}
                  onChange={(e) => setIntervieweeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Role / Position</label>
                <input
                  type="text"
                  placeholder="e.g. Inpatient Operations Lead"
                  value={intervieweeRole}
                  onChange={(e) => setIntervieweeRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Department</label>
                <input
                  type="text"
                  placeholder="e.g. Clinical Informatics"
                  value={intervieweeDept}
                  onChange={(e) => setIntervieweeDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="a.mercer@organization.org"
                  value={intervieweeEmail}
                  onChange={(e) => setIntervieweeEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Type of Interview Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white block">
                  Type of Interview
                </label>
                <p className="text-[11px] text-slate-400">
                  Select interview methodology. The AI generates targeted questions tailored to this protocol:
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${INTERVIEW_TYPE_DETAILS[interviewType].badgeColor}`}>
                Active: {interviewType}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(['Structured', 'Semi-Structured', 'Unstructured'] as InterviewType[]).map((typeKey) => {
                const info = INTERVIEW_TYPE_DETAILS[typeKey];
                const isSelected = interviewType === typeKey;
                return (
                  <div
                    key={typeKey}
                    onClick={() => handleSelectInterviewType(typeKey)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between space-y-2.5 ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {info.num}
                          </span>
                          <span>{info.label}</span>
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {info.description}
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateForType(typeKey);
                        }}
                        disabled={isGeneratingAI}
                        className="inline-flex items-center space-x-1 text-[10px] px-2 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        title={`Ask AI to generate ${info.label} questions`}
                      >
                        <Sparkles className="w-2.5 h-2.5 text-indigo-300" />
                        <span>AI Generate</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectInterviewType(typeKey);
                          handleLoadTypePresetQuestions(typeKey);
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 font-medium underline underline-offset-2 cursor-pointer"
                        title="Populate questions list with template"
                      >
                        Template ({info.questions.length})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Questionnaire Creation Mode Switcher */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-white block">
                  Questionnaire Construction
                </label>
                <p className="text-[11px] text-slate-400">
                  Create questions manually or prompt the AI to generate them
                </p>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCreationMode('ai')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    creationMode === 'ai'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Prompt the AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMode('manual')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    creationMode === 'manual'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Create Manually</span>
                </button>
              </div>
            </div>

            {/* TAB A: Prompt the AI */}
            {creationMode === 'ai' && (
              <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Question Protocol ({interviewType})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiPrompt(INTERVIEW_TYPE_DETAILS[interviewType].defaultPrompt)}
                    className="text-[10px] text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
                  >
                    Reset prompt to {interviewType} template
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-300 font-medium">
                    Prompt Instructions for AI:
                  </label>
                  <textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Focus on cloud migration downtime, data backup frequency, and third-party API rate limits..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">Questions Count:</span>
                    <select
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                    >
                      {[3, 4, 5, 6, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} Questions
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handlePromptAI}
                    disabled={isGeneratingAI}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingAI ? 'Generating Questions...' : `Generate ${interviewType} Questions`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB B: Create Manually */}
            {creationMode === 'manual' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center space-x-2 text-slate-300 text-xs font-semibold">
                  <PenTool className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add Question Manually</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300">Question Text *</label>
                  <input
                    type="text"
                    placeholder="e.g. How does your department handle bulk verification during peak hours?"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300">Category</label>
                    <select
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {CATEGORY_OPTIONS.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300">Rationale / Focus (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Discover batch concurrency bottlenecks"
                      value={manualRationale}
                      onChange={(e) => setManualRationale(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddManualQuestion}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Add Question</span>
                  </button>
                </div>
              </div>
            )}

            {/* Section 3: Active Questionnaire Preview */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Questionnaire Items ({questions.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  {questions.length === 0
                    ? 'No questions added yet'
                    : 'Included in the interviewee survey link'}
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  Click "Prompt AI to Generate" or "Create Manually" above to populate the questionnaire.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex items-start justify-between gap-3 text-xs group hover:border-slate-700 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                            {idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {q.category?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-200 leading-snug pl-7">
                          {q.questionText}
                        </p>
                        {q.rationale && (
                          <p className="text-[10px] text-slate-500 italic pl-7">
                            Focus: {q.rationale}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors cursor-pointer shrink-0"
                        title="Remove question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <p className="text-[11px] text-slate-400">
              Generates a dedicated, secure access link for the interviewee.
            </p>
            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Create Interview Session'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
