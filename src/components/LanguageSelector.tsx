import React, { useState } from 'react';
import { Globe2, Plus, Check } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { language, languages, setLanguage, addLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    addLanguage(value);
    setCustom('');
    setOpen(false);
  };

  return (
    <div className="relative" data-language-ui>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-all"
        title="Change language" aria-label="Change language">
        <Globe2 className="w-3.5 h-3.5 text-indigo-400" />
        <span>{language.nativeName}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-[100] text-left" data-language-ui>
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">Language</div>
          <div className="space-y-1">
            {languages.map(item => (
              <button key={item.code} type="button" onClick={() => { setLanguage(item); setOpen(false); }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 text-xs">
                <span>{item.nativeName}</span>
                {item.code === language.code && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            ))}
          </div>
          <div className="border-t border-slate-800 mt-2 pt-2">
            <div className="px-2 pb-1 text-[10px] text-slate-500">Any language</div>
            <div className="flex gap-1.5">
              <input value={custom} onChange={e => setCustom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCustom(); }}
                placeholder="e.g. Cebuano, Japanese, Spanish"
                className="min-w-0 flex-1 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-[10px]"
                data-no-translate />
              <button type="button" onClick={addCustom} className="px-2 rounded-lg bg-indigo-600 text-white" title="Add language">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
