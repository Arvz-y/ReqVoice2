import React, { useEffect } from 'react';
import { api } from '../lib/api';
import { useLanguage } from './LanguageContext';

const tagalog: Record<string, string> = {
  'Overview':'Pangkalahatang-ideya','Systems & Guides':'Mga Sistema at Gabay','Interviewer Room':'Silid ng Tagapanayam',
  'Reports & Transcripts':'Mga Ulat at Transcript','Interview Analytics':'Analytics ng Panayam','MySQL Database':'MySQL Database',
  'AI Chatbot':'AI Chatbot','Mobile App / PWA':'Mobile App / PWA','Workspace Navigation':'Pag-navigate sa Workspace',
  'Support & System':'Suporta at Sistema','System Tutorial':'Tutorial ng Sistema','Light':'Maliwanag','Dark':'Madilim','Sign Out':'Mag-sign Out',
  'Language':'Wika','Any language':'Anumang wika','Active':'Aktibo','Ready':'Handa','Refresh':'I-refresh','Previous':'Nakaraan','Next':'Susunod',
  'Share Link':'Ibahagi ang Link','Copy Link':'Kopyahin ang Link','Link Copied':'Nakopya ang Link','Completed':'Nakumpleto',
  'In Progress':'Isinasagawa','No Questions in Session':'Walang Tanong sa Session','Question':'Tanong','Questions':'Mga Tanong',
  'Answer Received':'Natanggap ang Sagot','Awaiting Response':'Naghihintay ng Sagot','Complete Session':'Kumpletuhin ang Session',
  'Synthesize Report':'Bumuo ng Ulat','Interviewee Response':'Sagot ng Interviewee','AI Transcript':'AI Transcript',
  'Key Requirements':'Mahahalagang Requirement','Written Statement':'Nakasulat na Pahayag','System':'Sistema','Role':'Tungkulin',
  'Department':'Kagawaran','Email':'Email','Username':'Username','Password':'Password','Full Name':'Buong Pangalan',
  'Create Architect Account':'Gumawa ng Architect Account','Sign In to Your Workspace':'Mag-sign In sa Iyong Workspace',
  'Access your interviews & reports':'I-access ang iyong mga panayam at ulat','Setup your enterprise user profile':'I-set up ang iyong enterprise user profile',
  'Security Protected • Login Required':'Protektado ng Seguridad • Kinakailangang Mag-login',
  'AI Requirements Copilot':'AI Requirements Copilot','Analytics':'Analytics','Reports':'Mga Ulat','Database':'Database',
  'AI Chat':'AI Chat','Systems':'Mga Sistema','Monitor':'Monitor','Mobile App':'Mobile App',
  'No active interview session selected.':'Walang napiling aktibong interview session.',
  'Check Updates':'Suriin ang Updates','Close Chat':'Isara ang Chat','Minimize':'I-minimize','Expand':'Palawakin',
  'Clear Chat History':'I-clear ang Chat History','Choose AI Intelligence Engine':'Pumili ng AI Intelligence Engine',
  'Generate':'Bumuo','Cancel':'Kanselahin','Save':'I-save','Delete':'Tanggalin','Edit':'I-edit','Create':'Gumawa',
  'Search':'Maghanap','Loading...':'Naglo-load...','Error':'Error','Success':'Tagumpay','Submit':'Isumite',
};

const tagalogWords: Record<string,string> = {
  change:'baguhin',language:'wika',overview:'pangkalahatang-ideya',systems:'mga sistema',system:'sistema',
  guides:'mga gabay',guide:'gabay',interview:'panayam',interviews:'mga panayam',reports:'mga ulat',report:'ulat',
  active:'aktibo',ready:'handa',refresh:'i-refresh',previous:'nakaraan',next:'susunod',share:'ibahagi',copy:'kopyahin',
  copied:'nakopya',completed:'nakumpleto',question:'tanong',questions:'mga tanong',answer:'sagot',response:'sagot',
  received:'natanggap',awaiting:'naghihintay',complete:'kumpletuhin',session:'session',requirements:'mga requirement',
  requirement:'requirement',role:'tungkulin',department:'kagawaran',name:'pangalan',create:'gumawa',access:'i-access',
  your:'iyong',security:'seguridad',protected:'protektado',required:'kinakailangan',generate:'bumuo',cancel:'kanselahin',
  save:'i-save',delete:'tanggalin',edit:'i-edit',search:'maghanap',loading:'naglo-load',error:'error',success:'tagumpay',
  submit:'isumite',prompt:'tagubilin',instructions:'mga tagubilin',count:'bilang',manual:'mano-mano',template:'template',
  reset:'i-reset',add:'magdagdag',remove:'alisin',select:'piliin',choose:'pumili',current:'kasalukuyan',optional:'opsyonal',
  close:'isara',open:'buksan',clear:'linisin',history:'kasaysayan'
};
function localTagalog(source:string) {
  const exact=tagalog[source]||tagalog[source.trim()];
  if(exact) return exact;
  const phrases:Array<[string,string]>=[
    ['Change language','Baguhin ang wika'],['AI Generate','Bumuo gamit ang AI'],['Generate Questions','Bumuo ng mga Tanong'],
    ['Generating Questions...','Bumubuo ng mga Tanong...'],['Questionnaire Construction','Pagbuo ng Talatanungan'],
    ['Questions Count','Bilang ng mga Tanong'],['Prompt the AI','Bigyan ng Prompt ang AI'],['Create Manually','Gumawa nang Mano-mano'],
    ['Prompt Instructions for AI','Mga Tagubilin para sa AI'],['Reset prompt','I-reset ang prompt'],['Type of Interview','Uri ng Panayam'],
    ['Interview Type','Uri ng Panayam'],['Add Question Manually','Magdagdag ng Tanong nang Mano-mano'],
    ['Question Text','Teksto ng Tanong'],['Rationale / Focus','Dahilan / Pokus'],['System Under Study','Sistema na Sinusuri'],
    ['No active interview session selected.','Walang napiling aktibong interview session.'],['Sign Out','Mag-sign Out']
  ];
  let value=source;
  for(const [from,to] of phrases) {
    const escaped=from.replace(/[.*+?^$()|[\]\\]/g,'\\$&');
    value=value.replace(new RegExp(escaped,'gi'),to);
  }
  return value.split(/(\s+|[^A-Za-z0-9À-ÿ'-]+)/).map(p=>tagalogWords[p.toLowerCase()]||p).join('');
}

const cache = new Map<string, string>();
type TextTranslationMeta = { source: string; lastTranslated: string };
type AttributeTranslationMeta = { source: string; lastTranslated: string };
const originalText = new WeakMap<Text, TextTranslationMeta>();
const originalAttrs = new WeakMap<Element, Record<string, AttributeTranslationMeta>>();

function collectAttributeTargets(root: HTMLElement) {
  const targets: Array<{ el: Element; attr: string; source: string }> = [];
  const elements = [root, ...Array.from(root.querySelectorAll('[title],[placeholder],[aria-label]'))];
  for (const el of elements) {
    if (el.closest('[data-language-ui],[data-no-translate]')) continue;
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      const value = el.getAttribute(attr);
      if (!value || value.length < 2) continue;
      const saved = originalAttrs.get(el) || {};
      const meta = saved[attr];
      if (!meta) {
        saved[attr] = { source: value, lastTranslated: value };
      } else if (value !== meta.lastTranslated && value !== meta.source) {
        meta.source = value;
        meta.lastTranslated = value;
      }
      originalAttrs.set(el, saved);
      targets.push({ el, attr, source: saved[attr].source });
    }
  }
  return targets;
}

async function translateAttributes(targets: Array<{ el: Element; attr: string; source: string }>, target: string) {
  const unique = [...new Set(targets.map(x => x.source))];
  const unresolved = unique.filter(source => !cache.has(target + '|' + source));
  for (const source of unresolved) {
    const isTl = target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl');
    const known = isTl ? localTagalog(source) : undefined;
    if (known) cache.set(target + '|' + source, known);
  }
  const pending = unresolved.filter(source => !cache.has(target + '|' + source));
  if (pending.length) {
    try {
      const result = await api.i18n.translate({ texts: pending, targetLanguage: target });
      result.translations.forEach((value, i) => { const source = pending[i]; const translated = String(value || '').trim(); const isTl = target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl'); cache.set(target + '|' + source, isTl && (!translated || translated.toLowerCase() === source.toLowerCase()) ? localTagalog(source) : (translated || source)); });
    } catch {
      pending.forEach(source => cache.set(target + '|' + source, target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl') ? localTagalog(source) : source));
    }
  }
  targets.forEach(({ el, attr, source }) => {
    if (el.isConnected) {
      const translated = cache.get(target + '|' + source);
      if (translated) {
        el.setAttribute(attr, translated);
        const saved = originalAttrs.get(el);
        if (saved?.[attr]) saved[attr].lastTranslated = translated;
      }
    }
  });
}

function shouldTranslate(node: Text) {
  const parent = node.parentElement;
  if (!parent || !node.nodeValue?.trim()) return false;
  if (parent.closest('[data-language-ui],[data-no-translate],input,textarea,script,style,code,pre,[contenteditable="true"]')) return false;
  const value = node.nodeValue.trim();
  return value.length >= 2 && !/^[\d\W_]+$/.test(value);
}

async function translateNodes(nodes: Text[], target: string) {
  const items = nodes.map(node => {
    const current = node.nodeValue?.trim() || '';
    let meta = originalText.get(node);
    if (!meta) {
      meta = { source: current, lastTranslated: current };
      originalText.set(node, meta);
    } else if (current !== meta.lastTranslated && current !== meta.source) {
      meta.source = current;
      meta.lastTranslated = current;
    }
    return { node, source: meta.source, meta };
  }).filter(x => x.source.length >= 2);

  const unique = [...new Set(items.map(x => x.source))];
  const unresolved = unique.filter(source => !cache.has(target + '|' + source));

  for (const source of unresolved) {
    const isTl = target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl');
    const known = isTl ? localTagalog(source) : undefined;
    if (known) cache.set(target + '|' + source, known);
  }

  const pending = unresolved.filter(source => !cache.has(target + '|' + source));
  if (pending.length) {
    try {
      const result = await api.i18n.translate({ texts: pending, targetLanguage: target });
      result.translations.forEach((value, i) => { const source = pending[i]; const translated = String(value || '').trim(); const isTl = target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl'); cache.set(target + '|' + source, isTl && (!translated || translated.toLowerCase() === source.toLowerCase()) ? localTagalog(source) : (translated || source)); });
    } catch {
      pending.forEach(source => cache.set(target + '|' + source, target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl') ? localTagalog(source) : source));
    }
  }

  items.forEach(({ node, source, meta }) => {
    if (!node.isConnected) return;
    const translated = cache.get(target + '|' + source);
    if (translated) {
      node.nodeValue = translated;
      meta.lastTranslated = translated;
    }
  });
}

export const TranslationLayer: React.FC = () => {
  const { language } = useLanguage();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;

    let timer: number | undefined;
    let running = false;
    let rerun = false;
    let observer: MutationObserver | null = null;
    let generation = 0;

    const restoreOriginals = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const text = n as Text;
        const meta = originalText.get(text);
        if (meta) {
          if (text.nodeValue !== meta.source) text.nodeValue = meta.source;
          meta.lastTranslated = meta.source;
        }
      }

      const elements = [root, ...Array.from(root.querySelectorAll('[title],[placeholder],[aria-label]'))];
      for (const el of elements) {
        const saved = originalAttrs.get(el);
        if (!saved) continue;
        Object.entries(saved).forEach(([attr, meta]) => {
          if (el.getAttribute(attr) !== meta.source) el.setAttribute(attr, meta.source);
          meta.lastTranslated = meta.source;
        });
      }
    };

    const collectTextNodes = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const text = n as Text;
        if (shouldTranslate(text)) {
          const current = text.nodeValue?.trim() || '';
          if (!originalText.has(text)) originalText.set(text, current);
          nodes.push(text);
        }
      }
      return nodes;
    };

    const run = async () => {
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      rerun = false;
      const myGeneration = ++generation;

      if (observer) observer.disconnect();

      try {
        // React owns the DOM. Restore English only when the selected language
        // actually changes; never restore on every MutationObserver callback.
        // Otherwise our own translations trigger the observer and fight React.
        if (language.code === 'en') {
          restoreOriginals();
          return;
        }

        const nodes = collectTextNodes();
        const attrs = collectAttributeTargets(root);

        for (let i = 0; i < nodes.length; i += 40) {
          if (myGeneration !== generation) return;
          await translateNodes(nodes.slice(i, i + 40), language.name);
        }

        for (let i = 0; i < attrs.length; i += 40) {
          if (myGeneration !== generation) return;
          await translateAttributes(attrs.slice(i, i + 40), language.name);
        }
      } finally {
        running = false;
        if (myGeneration === generation) {
          observer?.observe(root, { childList: true, subtree: true, characterData: true });
        }
        if (rerun && myGeneration === generation) {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => { void run(); }, 120);
        }
      }
    };

    const schedule = () => {
      if (running) {
        rerun = true;
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void run(); }, 80);
    };

    observer = new MutationObserver(() => {
      // Only react to changes made by React/application code. The observer is
      // disconnected while this translation layer mutates text/attributes.
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    void run();

    return () => {
      generation++;
      observer?.disconnect();
      observer = null;
      window.clearTimeout(timer);
    };
  }, [language.code, language.name]);

  return null;
};
