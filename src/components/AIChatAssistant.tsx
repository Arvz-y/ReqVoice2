import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Cpu,
  Trash2,
  Minimize2,
  Maximize2,
  ChevronDown,
  Layers,
  Check,
  RotateCcw,
  Zap,
  Info,
  X,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { SystemUnderStudy } from '../types';

export interface ChatModel {
  id: string;
  name: string;
  provider: string;
  tagline: string;
  speed: string;
  contextWindow: string;
  recommended: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

interface AIChatAssistantProps {
  systems: SystemUnderStudy[];
  isFloating?: boolean;
  onClose?: () => void;
}

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  systems,
  isFloating = false,
  onClose,
}) => {
  const [models, setModels] = useState<ChatModel[]>([
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'Google Gemini',
      tagline: 'Ultra-fast & multimodal default for requirements gathering',
      speed: 'Fastest (~0.5s)',
      contextWindow: '1M tokens',
      recommended: true,
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      provider: 'Google Gemini',
      tagline: 'Complex enterprise architectural reasoning & deep spec analysis',
      speed: 'Deep Reasoning (~1.8s)',
      contextWindow: '2M tokens',
      recommended: false,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'Google Gemini',
      tagline: 'High-stability long-document architectural synthesis',
      speed: 'Standard (~1.5s)',
      contextWindow: '2M tokens',
      recommended: false,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'Google Gemini',
      tagline: 'Lightweight, low-latency requirements parsing',
      speed: 'Fast (~0.8s)',
      contextWindow: '1M tokens',
      recommended: false,
    },
  ]);

  const [selectedModelId, setSelectedModelId] = useState<string>('gemini-2.5-flash');
  const [selectedSystemContextId, setSelectedSystemContextId] = useState<string>('all');
  const [showModelDropdown, setShowModelDropdown] = useState<boolean>(false);
  const [showSystemDropdown, setShowSystemDropdown] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content:
          'Hello! I am your **reqvoiceV2 AI Architect**. I can analyze your systems requirements, extract IEEE 830 functional & non-functional specs from stakeholder video interviews, compare sentiments, and generate follow-up protocols.\n\nYou can select your preferred AI model above at any time.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-2.5-flash',
      },
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.aiChat
      .getModels()
      .then((res) => {
        if (res.models?.length) {
          setModels(res.models);
        }
      })
      .catch(() => {
        // Fallback models are already in state
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.aiChat.sendMessage({
        message: userMsg.content,
        model: selectedModelId,
        history: historyPayload,
        systemContextId: selectedSystemContextId === 'all' ? undefined : selectedSystemContextId,
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.reply || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: res.modelUsed || activeModel.name,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content:
          '⚠️ Encountered an issue querying the model. Please check connection or try selecting a different Gemini model.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: activeModel.name,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        role: 'assistant',
        content: 'Chat history cleared. How can I assist with your systems discovery and requirements today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: activeModel.name,
      },
    ]);
  };

  const promptShortcuts = [
    'Extract Functional vs Non-Functional requirements',
    'Summarize stakeholder pain points and friction',
    'Draft 3 follow-up questions for the next interview',
    'Evaluate storage compression savings vs audio fidelity',
  ];

  const currentSystemName =
    selectedSystemContextId === 'all'
      ? 'All Systems (Global Catalog)'
      : systems.find((s) => s.id === selectedSystemContextId)?.name || 'Focused System';

  return (
    <div
      className={`flex flex-col bg-slate-950/95 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-200 overflow-hidden ${
        isFloating
          ? isExpanded
            ? 'w-[95vw] sm:w-[680px] h-[85vh] max-h-[750px]'
            : 'w-[95vw] sm:w-[480px] h-[600px]'
          : 'w-full h-full min-h-[600px]'
      }`}
    >
      {/* Header bar */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                reqvoice AI Copilot
              </h2>
              <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              Requirements Engineer & Transcript Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isFloating && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Minimize' : 'Expand'}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors hidden sm:block"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close Chat"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Control Strip: AI Model Selector & System Context Filter */}
      <div className="px-3.5 py-2.5 bg-slate-900/60 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Model Picker */}
        <div className="relative">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-slate-400 font-mono">Model:</span>
            <button
              onClick={() => {
                setShowModelDropdown(!showModelDropdown);
                setShowSystemDropdown(false);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors font-mono text-[11px] font-medium"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeModel.name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>
          </div>

          {showModelDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50">
              <div className="px-2 py-1 text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                Choose AI Intelligence Engine
              </div>
              <div className="space-y-1 mt-1">
                {models.map((m) => {
                  const isSelected = m.id === selectedModelId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModelId(m.id);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg transition-colors flex items-start space-x-2.5 ${
                        isSelected
                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                          : 'hover:bg-slate-800/70 text-slate-300'
                      }`}
                    >
                      <div className="mt-0.5">
                        <Cpu className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-100 truncate">{m.name}</span>
                          {m.recommended && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{m.tagline}</p>
                        <div className="flex items-center space-x-2 text-[9px] font-mono text-slate-500 mt-1">
                          <span>{m.speed}</span>
                          <span>•</span>
                          <span>{m.contextWindow}</span>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* System Context Grounding */}
        <div className="relative">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] text-slate-400 font-mono">Scope:</span>
            <button
              onClick={() => {
                setShowSystemDropdown(!showSystemDropdown);
                setShowModelDropdown(false);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition-colors font-mono text-[11px] font-medium max-w-[170px] sm:max-w-[210px] truncate"
            >
              <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="truncate">{currentSystemName}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
            </button>
          </div>

          {showSystemDropdown && (
            <div className="absolute top-full right-0 mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50">
              <div className="px-2 py-1 text-[10px] uppercase font-mono text-slate-400 tracking-wider">
                Ground Responses By System
              </div>
              <div className="space-y-1 mt-1 max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedSystemContextId('all');
                    setShowSystemDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    selectedSystemContextId === 'all'
                      ? 'bg-indigo-600/20 text-white font-medium'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <span>All Systems (Global Catalog)</span>
                  {selectedSystemContextId === 'all' && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
                {systems.map((s) => {
                  const isSelected = s.id === selectedSystemContextId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSystemContextId(s.id);
                        setShowSystemDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600/20 text-white font-medium'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-xs'
                }`}
              >
                {!isUser && msg.modelUsed && (
                  <div className="flex items-center space-x-1 text-[10px] font-mono text-indigo-400 mb-1.5">
                    <Sparkles className="w-3 h-3" />
                    <span>{msg.modelUsed}</span>
                  </div>
                )}

                <div className="whitespace-pre-wrap leading-relaxed break-words text-[13px]">
                  {msg.content}
                </div>

                <div
                  className={`text-[10px] mt-1.5 text-right font-mono ${
                    isUser ? 'text-indigo-200/80' : 'text-slate-500'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold">
                  You
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 text-slate-400 flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span className="text-xs font-mono">
                {activeModel.name} is synthesizing requirements...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      {messages.length <= 3 && (
        <div className="px-4 py-2 bg-slate-900/40 border-t border-slate-800/60 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-mono text-slate-500 shrink-0 mr-1">
              Suggestions:
            </span>
            {promptShortcuts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/70 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700/60 hover:text-white transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Ask ${activeModel.name} about requirements, interviews, or specs...`}
            disabled={isLoading}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shrink-0 shadow-sm"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2 px-1">
          <span>Active Engine: {activeModel.name} ({activeModel.provider})</span>
          <span>Scope: {selectedSystemContextId === 'all' ? 'All Systems' : 'Scoped System'}</span>
        </div>
      </div>
    </div>
  );
};
