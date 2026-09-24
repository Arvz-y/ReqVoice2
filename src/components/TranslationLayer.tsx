import { useEffect } from 'react';
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

const cache = new Map<string, string>();
const originalText = new WeakMap<Text, string>();

function shouldTranslate(node: Text) {
  const parent = node.parentElement;
  if (!parent || !node.nodeValue?.trim()) return false;
  if (parent.closest('[data-language-ui],[data-no-translate],input,textarea,select,script,style,code,pre,[contenteditable="true"]')) return false;
  const value = node.nodeValue.trim();
  return value.length >= 2 && !/^[\d\W_]+$/.test(value);
}

async function translateNodes(nodes: Text[], target: string) {
  const items = nodes.map(node => {
    const current = node.nodeValue?.trim() || '';
    const source = originalText.get(node) || current;
    if (!originalText.has(node)) originalText.set(node, source);
    return { node, source };
  }).filter(x => x.source.length >= 2);

  const unique = [...new Set(items.map(x => x.source))];
  const unresolved = unique.filter(source => !cache.has(target + '|' + source));

  for (const source of unresolved) {
    const known = target.toLowerCase().startsWith('tagalog') || target.toLowerCase().startsWith('tl') ? tagalog[source] : undefined;
    if (known) cache.set(target + '|' + source, known);
  }

  const pending = unresolved.filter(source => !cache.has(target + '|' + source));
  if (pending.length) {
    try {
      const result = await api.i18n.translate({ texts: pending, targetLanguage: target });
      result.translations.forEach((value, i) => cache.set(target + '|' + pending[i], value || pending[i]));
    } catch {
      pending.forEach(source => cache.set(target + '|' + source, source));
    }
  }

  items.forEach(({ node, source }) => {
    if (!node.isConnected) return;
    const translated = cache.get(target + '|' + source);
    if (translated) node.nodeValue = translated;
  });
}

export const TranslationLayer: React.FC = () => {
  const { language } = useLanguage();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;

    let timer: number | undefined;
    const restoreAndCollect = () => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const text = n as Text;
        const source = originalText.get(text);
        if (source) text.nodeValue = source;
        if (shouldTranslate(text)) nodes.push(text);
      }
      return nodes;
    };

    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const nodes = restoreAndCollect();
        if (language.code === 'en') return;
        for (let i = 0; i < nodes.length; i += 40) {
          await translateNodes(nodes.slice(i, i + 40), language.name);
        }
      }, 80);
    };

    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    const interval = window.setInterval(run, 1200);
    return () => { observer.disconnect(); window.clearTimeout(timer); window.clearInterval(interval); };
  }, [language.code, language.name]);

  return null;
};
