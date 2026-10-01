/* ==========================================================================
   VEGAS VIGILÂNCIA — PROSPECÇÃO DE CLIENTES
   script.js — lógica do frontend
   --------------------------------------------------------------------------
   Índice
     1. Configuração e constantes
     2. Utilitários
     3. Ícones
     4. Preferências (tema, sessão, servidor)
     5. Comunicação com o Google Apps Script
     6. Componentes de interface (toast, modal, confirmação, loading)
     7. Login e sessão
     8. Estrutura do app (menu, rotas, busca global, escopo do admin)
     9. Telas (dashboard, clientes, prospecções, contatos, produtos,
        importação CSV, propostas, relatórios, configurações, administração)
    10. Formulários e ficha do cliente
    11. Inicialização e PWA
   ========================================================================== */
'use strict';

/* ---------- 1. Configuração e constantes ---------- */

/** Cole aqui a URL do App da Web do Apps Script (termina em /exec).
 *  Também é possível informar pela tela de login em "Configurar servidor". */
const API_URL_PADRAO = 'https://script.google.com/macros/s/AKfycbwonu0cMaQlxrkUtDHlKq_HS-hWWBuMbk7cQHJkgYIcryDKD071Yq-2UBw32KrYI7JH/exec';

const APP_VERSION = '1.3.0';

const STATUS = [
  'Novo lead', 'Primeiro contato', 'Em negociação', 'Visita agendada', 'Orçamento enviado',
  'Aguardando retorno', 'Cliente interessado', 'Cliente ganho', 'Cliente perdido', 'Sem interesse', 'Retornar depois'
];
const STATUS_COR = {
  'Novo lead': '#9aa3ad', 'Primeiro contato': '#3b82f6', 'Em negociação': '#e5a020', 'Visita agendada': '#8b5cf6',
  'Orçamento enviado': '#06a3c4', 'Aguardando retorno': '#f97316', 'Cliente interessado': '#14b8a6',
  'Cliente ganho': '#22b35e', 'Cliente perdido': '#e0232c', 'Sem interesse': '#6b7280', 'Retornar depois': '#6366f1'
};
const ENCERRADOS = ['Cliente ganho', 'Cliente perdido', 'Sem interesse'];
const TIPOS_CONTATO = [
  { t: 'Ligação', i: 'phone' }, { t: 'WhatsApp', i: 'wa' }, { t: 'E-mail', i: 'mail' }, { t: 'Visita', i: 'pin' },
  { t: 'Reunião', i: 'users' }, { t: 'Orçamento', i: 'file' }, { t: 'Outro', i: 'dots' }
];
const RESULTADOS = ['Atendeu / conversou', 'Não atendeu', 'Pediu retorno', 'Interessado', 'Solicitou orçamento', 'Visita marcada', 'Fechou negócio', 'Sem interesse'];
const ORIGENS = ['Indicação', 'Instagram', 'Facebook', 'Google', 'Site', 'WhatsApp', 'Ligação ativa', 'Visita presencial', 'Panfleto / placa', 'Cliente antigo', 'Evento', 'Outro'];
const SEGMENTOS = ['Residencial', 'Condomínio', 'Comércio', 'Indústria', 'Escritório', 'Escola', 'Clínica / Saúde', 'Restaurante / Bar', 'Igreja', 'Órgão público', 'Rural', 'Outro'];
const INTERESSES = ['Câmeras / CFTV', 'Alarme monitorado', 'Monitoramento 24h', 'Controle de acesso', 'Cerca elétrica', 'Portaria remota', 'Vigilância patrimonial', 'Interfonia', 'Rastreamento', 'Outro'];
/** Tipos de orçamento: Venda ou Locação (comodato). Na locação os equipamentos saem
 *  como "Locado" no PDF e o cliente paga o aluguel mensal. */
const TIPOS_ORCAMENTO = [{ v: 'Venda', l: 'Venda' }, { v: 'Locado', l: 'Locação (comodato)' }];
const normTipo = t => /loca|comod|alug/i.test(String(t || '')) ? 'Locado' : 'Venda';
const STATUS_PROPOSTA = ['Rascunho', 'Enviada', 'Aprovada', 'Recusada', 'Expirada'];
const STATUS_PROSPECCAO = ['Em andamento', 'Proposta enviada', 'Ganha', 'Perdida'];
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const MSG_WHATSAPP = [
  { nome: 'Apresentação', texto: 'Olá, [NOME]. Aqui é [VENDEDOR], da Vegas Vigilância. Estou entrando em contato sobre soluções de segurança para [EMPRESA]. Podemos conversar?' },
  { nome: 'Retorno de contato', texto: 'Olá, [NOME]! Aqui é [VENDEDOR], da Vegas Vigilância. Estou retornando nosso contato sobre [INTERESSE]. Qual o melhor horário para falarmos?' },
  { nome: 'Envio de orçamento', texto: 'Olá, [NOME]. Aqui é [VENDEDOR], da Vegas Vigilância. Segue o orçamento que preparamos para [EMPRESA]. Fico à disposição para qualquer dúvida.' },
  { nome: 'Agendar visita', texto: 'Olá, [NOME]. Aqui é [VENDEDOR], da Vegas Vigilância. Gostaria de agendar uma visita técnica sem compromisso para avaliar a segurança de [EMPRESA]. Qual dia fica melhor para você?' },
  { nome: 'Pós-venda', texto: 'Olá, [NOME]! Aqui é [VENDEDOR], da Vegas Vigilância. Passando para saber se está tudo certo com o seu sistema de segurança.' }
];

/** Estado global da aplicação. */
const S = {
  token: null,
  user: null,
  data: { clientes: [], produtos: [], prospeccoes: [], atividades: [], propostas: [], usuarios: [], config: {} },
  scope: '',            // admin: '' = todos, ou usuário de um vendedor
  dash: null,
  charts: [],
  route: { view: 'dashboard', param: '' },
  installPrompt: null
};

/* ---------- 2. Utilitários ---------- */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const digits = v => String(v == null ? '' : v).replace(/\D/g, '');
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const money = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyInput = n => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => isoDate(new Date());
const addDays = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return isoDate(d); };
const nowStamp = () => { const d = new Date(); return isoDate(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
const localDT = () => { const d = new Date(); return isoDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function fmtDate(v, withTime = false) {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return esc(v);
  return m[3] + '/' + m[2] + '/' + m[1] + (withTime && m[4] ? ' ' + m[4] + ':' + m[5] : '');
}
function relDay(v) {
  if (!v) return '';
  const d = String(v).slice(0, 10), t = today();
  if (d === t) return 'Hoje';
  if (d === addDays(1)) return 'Amanhã';
  if (d === addDays(-1)) return 'Ontem';
  const diff = Math.round((new Date(d + 'T12:00') - new Date(t + 'T12:00')) / 864e5);
  if (diff < 0) return 'Há ' + Math.abs(diff) + ' dias';
  return fmtDate(d);
}
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const initials = n => String(n || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
const byId = (list, id) => list.find(x => x.id === id);
const clienteNome = c => c ? (c.empresa || c.contato || 'Sem nome') : '—';

function maskPhone(v) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}
function maskDoc(v) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
const maskCEP = v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
function validaDoc(v) {
  const d = digits(v);
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let s = 0;
      for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== +d[t]) return false;
    }
    return true;
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = len => {
      const p = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const r = p.reduce((a, w, i) => a + +d[i] * w, 0) % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }
  return false;
}
function waLink(numero, texto = '') {
  let d = digits(numero);
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
}
function downloadFile(name, content, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function toCSV(headers, rows) {
  const q = v => { v = String(v == null ? '' : v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return '\ufeff' + [headers.map(q).join(';')].concat(rows.map(r => r.map(q).join(';'))).join('\r\n');
}
function options(list, sel = '', blank = '') {
  return (blank !== null && blank !== undefined && blank !== false ? '<option value="">' + esc(blank) + '</option>' : '') +
    list.map(o => {
      const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o;
      return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
}
const chip = s => '<span class="chip" style="--c:' + (STATUS_COR[s] || propCor(s)) + '">' + esc(s || '—') + '</span>';
function propCor(s) { return { Rascunho: '#9aa3ad', Enviada: '#06a3c4', Aprovada: '#22b35e', Recusada: '#e0232c', Expirada: '#6b7280', 'Em andamento': '#e5a020', 'Proposta enviada': '#06a3c4', Ganha: '#22b35e', Perdida: '#e0232c' }[s] || '#9aa3ad'; }
function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
  $$('input[type=checkbox][name]', form).forEach(c => { o[c.name] = c.checked; });
  return o;
}

/* ---------- 3. Ícones (SVG em linha) ---------- */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7"/><path d="M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  phone: '<path d="M5 3h3.5l1.8 4.6-2.3 1.5a11 11 0 006 6l1.5-2.3L20 14.5V18a2 2 0 01-2.2 2A16.5 16.5 0 013 5.2 2 2 0 015 3z"/>',
  box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1.5 1.5 0 001.5 1.5h13A1.5 1.5 0 0020 19v-3"/>',
  file: '<path d="M14 3H6.5A1.5 1.5 0 005 4.5v15A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  logout: '<path d="M15 4h3.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H15"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5M14 11v5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6l8.5 7 8.5-7"/>',
  wa: '<path d="M4 20l1.2-3.8A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.2-1.1z"/><path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 .9a4.4 4.4 0 01-2.8-2.8l.9-1-1-2z"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 01-10 0z"/><path d="M7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4M12 14v3M8.5 20.5h7M10 17h4v3.5h-4z"/>',
  userx: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5 2 0 3.8.7 5 2"/><path d="M16 14l5 5M21 14l-5 5"/>',
  userplus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M19 8v6M16 11h6"/>',
  send: '<path d="M21 3L10 14"/><path d="M21 3l-6.5 18-4.5-7-7-4.5z"/>',
  sync: '<path d="M20 11a8 8 0 00-14.5-4.5L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 005.4-1.6"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M12 7v7M9 11l3 3 3-3M10.5 18.5h3"/>',
  filter: '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>',
  building: '<path d="M4 21V5.5L12 3v18M12 8.5l8 2.5v10M8 8h.01M8 12h.01M8 16h.01M16 14h.01M16 18h.01M2.5 21h19"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="10" rx="1"/><rect x="16" y="4" width="5" height="13" rx="1"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v.01M18 14.5v.01"/>',
  history: '<path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7.5V12l3.5 2"/>',
  contract: '<path d="M14 3H6.5A1.5 1.5 0 005 4.5v15A1.5 1.5 0 006.5 21h11a1.5 1.5 0 001.5-1.5V8z"/><path d="M14 3v5h5M8.5 12h7M8.5 15h4"/><path d="M8.5 18.5c1-1 1.8-1 2.4 0s1.4 1 2.4 0"/>'
};
const icon = (n, cls = '') => '<svg class="i ' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

/* ---------- 4. Preferências ---------- */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* armazenamento indisponível */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
};
const getApiUrl = () => store.get('vg_api') || API_URL_PADRAO;

function applyTheme(pref = store.get('vg_theme', 'auto')) {
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const meta = $('meta[name=theme-color]');
  if (meta) meta.content = dark ? '#0d0f12' : '#e9ebee';
  const b = $('#themeBtn');
  if (b) b.innerHTML = icon(dark ? 'sun' : 'moon');
  if (S.charts.length && S.route.view === 'dashboard') renderDashboardCharts();
}
function setTheme(pref) { store.set('vg_theme', pref); applyTheme(pref); }
function cycleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  setTheme(cur === 'dark' ? 'light' : 'dark');
  toast(cur === 'dark' ? 'Tema claro ativado.' : 'Tema escuro ativado.');
}

/* ---------- 5. Comunicação com o Google Apps Script ---------- */
let loadingCount = 0;
function loading(on) {
  loadingCount = Math.max(0, loadingCount + (on ? 1 : -1));
  $('#loading').hidden = loadingCount === 0;
}

/**
 * Chama uma ação do Code.gs. O corpo vai como text/plain para evitar
 * a verificação CORS (preflight), que o Apps Script não responde.
 */
async function api(action, payload = {}, opts = {}) {
  const url = getApiUrl();
  if (!url) { openServerConfig(); throw new Error('Configure o endereço do servidor para continuar.'); }
  if (!opts.silent) loading(true);
  try {
    let res;
    try {
      res = await fetch(url, { method: 'POST', body: JSON.stringify({ action, token: S.token, payload }), redirect: 'follow' });
    } catch (e) {
      throw new Error(navigator.onLine ? 'Não foi possível falar com o servidor. Verifique a URL e a publicação do Apps Script.' : 'Você está sem internet. Conecte-se e tente novamente.');
    }
    if (!res.ok) throw new Error('O servidor respondeu com erro (' + res.status + ').');
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Resposta inválida do servidor. Confira se a implantação está como "Qualquer pessoa".'); }
    if (!j.ok) {
      const err = new Error(j.error || 'Erro ao salvar os dados.');
      err.code = j.code;
      if (j.code === 'AUTH' && action !== 'login') forceLogout(err.message);
      throw err;
    }
    return j.data;
  } finally {
    if (!opts.silent) loading(false);
  }
}

/** Executa uma ação com tratamento de erro padrão (toast). */
async function run(fn, errMsg) {
  try { return await fn(); } catch (e) {
    if (e.code !== 'AUTH') toast(e.message || errMsg || 'Erro ao salvar os dados.', 'err');
    return undefined;
  }
}

/** Atualiza (ou insere) um registro na lista local. */
function upsert(list, obj) {
  const i = list.findIndex(x => x.id === obj.id);
  if (i >= 0) list[i] = Object.assign({}, list[i], obj); else list.unshift(obj);
  return obj;
}

/* ---------- 6. Componentes de interface ---------- */
function toast(msg, type = 'ok', ms = 3800) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.innerHTML = '<span class="t-ico">' + icon(type === 'err' ? 'alert' : type === 'warn' ? 'alert' : 'check') + '</span><div>' + esc(msg) + '</div>';
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

const modals = [];
/**
 * Abre um modal. opts: { title, body, foot, size: 'sm'|'lg'|'xl', flush, onOpen(el), onClose() }
 */
function openModal(opts) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML =
    '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title || '') + '">' +
    (opts.title !== false ? '<div class="modal-head"><h2>' + (opts.titleHtml || esc(opts.title || '')) + '</h2><button class="btn-icon" data-close aria-label="Fechar">' + icon('x') + '</button></div>' : '') +
    '<div class="modal-body ' + (opts.flush ? 'flush' : '') + '">' + (opts.body || '') + '</div>' +
    (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') + '</div>';
  back.addEventListener('mousedown', e => { if (e.target === back) back._down = true; });
  back.addEventListener('click', e => {
    if ((e.target === back && back._down) || e.target.closest('[data-close]')) closeModal(back);
    back._down = false;
  });
  back._opts = opts;
  $('#modalRoot').appendChild(back);
  modals.push(back);
  document.body.style.overflow = 'hidden';
  if (opts.onOpen) opts.onOpen(back);
  const f = $('input:not([type=hidden]):not([readonly]), select, textarea', $('.modal-body', back));
  if (f && matchMedia('(min-width: 721px)').matches) setTimeout(() => f.focus(), 60);
  return back;
}
function closeModal(el = modals[modals.length - 1]) {
  if (!el) return;
  const i = modals.indexOf(el);
  if (i >= 0) modals.splice(i, 1);
  if (el._opts && el._opts.onClose) el._opts.onClose();
  el.remove();
  if (!modals.length) document.body.style.overflow = '';
}
function confirmDialog(msg, { title = 'Confirmar', ok = 'Confirmar', danger = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const m = openModal({
      title, size: 'sm', body: '<p style="margin:0">' + esc(msg) + '</p>',
      foot: '<button class="btn" data-close>Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(ok) + '</button>',
      onClose: () => { if (!done) resolve(false); }
    });
    $('[data-ok]', m).onclick = () => { done = true; closeModal(m); resolve(true); };
  });
}

/* ---------- 7. Login e sessão ---------- */
function showLogin(msg) {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginUser').value = store.get('vg_last_user', '');
  $('[data-act=toggle-pass]').innerHTML = icon('eye');
  const e = $('#loginError');
  e.hidden = !msg;
  e.textContent = msg || '';
  setTimeout(() => ($('#loginUser').value ? $('#loginPass') : $('#loginUser')).focus(), 50);
}

async function doLogin(ev) {
  ev.preventDefault();
  const usuario = $('#loginUser').value.trim().toLowerCase();
  const senha = $('#loginPass').value;
  const err = $('#loginError');
  err.hidden = true;
  if (!usuario || !senha) { err.textContent = 'Informe usuário e senha.'; err.hidden = false; return; }
  const btn = $('#loginForm button[type=submit]');
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const r = await api('login', { usuario, senha });
    S.token = r.token;
    S.user = r.user;
    store.set('vg_token', r.token);
    store.set('vg_last_user', usuario);
    store.set('vg_user', JSON.stringify(r.user));
    $('#loginPass').value = '';
    await startApp();
    toast('Bem-vindo, ' + r.user.nome + '!');
  } catch (e) {
    err.textContent = e.message === 'Login inválido.' ? 'Login inválido. Confira usuário e senha.' : e.message;
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

async function logout() {
  if (!(await confirmDialog('Deseja sair do sistema neste aparelho?', { title: 'Sair', ok: 'Sair' }))) return;
  api('logout', {}, { silent: true }).catch(() => {});
  clearSession();
  showLogin();
}
function clearSession() {
  S.token = null; S.user = null; S.dash = null;
  store.del('vg_token'); store.del('vg_user'); store.del('vg_cache');
}
function forceLogout(msg) { clearSession(); modals.slice().forEach(m => closeModal(m)); showLogin(msg); }

function openServerConfig() {
  const m = openModal({
    title: 'Endereço do servidor', size: 'sm',
    body: '<form id="srvForm" class="grid"><label class="field"><span>URL do App da Web (Apps Script)</span>' +
      '<input name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(getApiUrl()) + '" required>' +
      '<small>Copie em Implantar → Gerenciar implantações → URL do app da Web.</small></label></form>',
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn" data-test>Testar</button><button class="btn btn-primary" data-save>Salvar</button>'
  });
  const get = () => $('input[name=url]', m).value.trim();
  $('[data-test]', m).onclick = async () => {
    const u = get();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return toast('Informe uma URL do Google Apps Script.', 'err');
    store.set('vg_api', u);
    const ok = await run(() => api('ping'));
    if (ok) toast('Servidor online.');
  };
  $('[data-save]', m).onclick = () => {
    const u = get();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) return toast('Informe uma URL do Google Apps Script.', 'err');
    store.set('vg_api', u);
    closeModal(m);
    toast('Servidor configurado.');
  };
}

/* ---------- 8. Estrutura do app ---------- */
const isAdmin = () => S.user && S.user.perfil === 'admin';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'prospeccoes', label: 'Prospecções', icon: 'target' },
  { id: 'contatos', label: 'Contatos', icon: 'phone', badge: () => agenda().atrasados.length + agenda().hoje.length },
  { id: 'produtos', label: 'Produtos', icon: 'box' },
  { id: 'importar', label: 'Importar CSV', icon: 'upload' },
  { id: 'propostas', label: 'Propostas', icon: 'file' },
  { id: 'relatorios', label: 'Relatórios', icon: 'chart' },
  { id: 'admin', label: 'Administração', icon: 'shield', admin: true },
  { id: 'configuracoes', label: 'Configurações', icon: 'gear' }
];
const BOTTOM = [
  { id: 'dashboard', label: 'Início', icon: 'home' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'contatos', label: 'Hoje', icon: 'phone' },
  { id: 'propostas', label: 'Propostas', icon: 'file' },
  { id: 'menu', label: 'Menu', icon: 'menu' }
];

function renderNav() {
  const cur = S.route.view;
  $('#nav').innerHTML = MENU.filter(m => !m.admin || isAdmin()).map(m => {
    const b = m.badge ? m.badge() : 0;
    return '<button class="nav-item ' + (cur === m.id ? 'active' : '') + '" data-act="go" data-view="' + m.id + '">' + icon(m.icon) +
      '<span>' + m.label + '</span>' + (b ? '<span class="nav-badge">' + b + '</span>' : '') + '</button>';
  }).join('') + '<div class="nav-sep"></div><button class="nav-item" data-act="logout">' + icon('logout') + '<span>Sair</span></button>';
  const pend = agenda().atrasados.length + agenda().hoje.length;
  $('#bottomNav').innerHTML = BOTTOM.map(m =>
    '<button class="' + (cur === m.id ? 'active' : '') + '" data-act="' + (m.id === 'menu' ? 'open-menu' : 'go') + '" data-view="' + m.id + '">' +
    icon(m.icon) + '<span>' + m.label + '</span>' + (m.id === 'contatos' && pend ? '<i class="dot"></i>' : '') + '</button>').join('');
}

function renderShell() {
  $('#meName').textContent = S.user.nome;
  $('#meRole').textContent = isAdmin() ? 'Administrador' : 'Vendedor';
  $('#meAvatar').textContent = initials(S.user.nome);
  $('[data-act=open-menu].menu-btn').innerHTML = icon('menu');
  $('#syncBtn').innerHTML = icon('sync');
  $('.search-ico').innerHTML = icon('search');
  applyTheme();
  const wrap = $('#scopeWrap');
  wrap.hidden = !isAdmin();
  if (isAdmin()) {
    const vend = S.data.usuarios.filter(u => u.perfil !== 'admin');
    $('#scopeSelect').innerHTML = '<option value="">Todos os vendedores</option>' + vend.map(u => '<option value="' + esc(u.usuario) + '"' + (S.scope === u.usuario ? ' selected' : '') + '>' + esc(u.nome) + '</option>').join('');
  }
  updateInstallButton();
  renderNav();
}

/** Aplica o filtro de vendedor do administrador. Vendedores já recebem só os próprios dados. */
const scoped = list => (isAdmin() && S.scope) ? list.filter(x => x.usuarioVendedor === S.scope) : list;
const nomeVendedor = u => { const x = S.data.usuarios.find(v => v.usuario === u); return x ? x.nome : u; };

/* Rotas por hash: #/clientes, #/propostas/nova, #/propostas/editar/ID */
const VIEWS = {};
function go(view, param = '') { location.hash = '#/' + view + (param ? '/' + param : ''); }
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { view: VIEWS[parts[0]] ? parts[0] : 'dashboard', param: parts.slice(1).join('/') };
}
function render() {
  if (!S.user) return;
  S.route = parseRoute();
  if (S.route.view === 'admin' && !isAdmin()) S.route.view = 'dashboard';
  S.charts.forEach(c => c.destroy());
  S.charts = [];
  $('#app').classList.remove('menu-open');
  const v = $('#view');
  v.style.animation = 'none'; void v.offsetWidth; v.style.animation = '';
  v.innerHTML = VIEWS[S.route.view](S.route.param) || '';
  if (VIEWS[S.route.view].after) VIEWS[S.route.view].after(S.route.param);
  renderNav();
  window.scrollTo(0, 0);
}

/** Recarrega todos os dados do servidor. */
async function loadData(silent = false) {
  const d = await api('bootstrap', {}, { silent });
  Object.assign(S.data, {
    clientes: d.clientes, produtos: d.produtos, prospeccoes: d.prospeccoes, atividades: d.atividades,
    propostas: d.propostas, usuarios: d.usuarios, config: d.config
  });
  S.user = d.user;
  store.set('vg_user', JSON.stringify(d.user));
  try { store.set('vg_cache', JSON.stringify(S.data)); } catch (e) { /* cache cheio: segue sem cache */ }
}

async function startApp() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  // Mostra dados em cache imediatamente (abre rápido no celular) e atualiza em seguida
  const cache = store.get('vg_cache');
  if (cache) { try { Object.assign(S.data, JSON.parse(cache)); } catch (e) { /* ignora cache inválido */ } }
  renderShell();
  render();
  await run(async () => { await loadData(!!cache); renderShell(); render(); });
}

/* Busca global */
function globalSearch(q) {
  const qn = norm(q), qd = digits(q);
  if (qn.length < 2) return [];
  return scoped(S.data.clientes).filter(c => {
    const t = norm([c.empresa, c.razaoSocial, c.contato, c.email, c.cidade, c.vendedor, c.status, c.codigo, c.bairro].join(' '));
    if (t.includes(qn)) return true;
    return qd.length >= 3 && [c.documento, c.telefone, c.whatsapp].some(v => digits(v).includes(qd));
  });
}
function bindGlobalSearch() {
  const input = $('#globalSearch'), box = $('#searchResults');
  let hl = -1;
  const draw = debounce(() => {
    const q = input.value.trim();
    const res = globalSearch(q);
    hl = -1;
    if (q.length < 2) { box.hidden = true; return; }
    box.innerHTML = (res.length ? res.slice(0, 8).map(c =>
      '<button data-act="open-cliente" data-id="' + esc(c.id) + '"><span class="chip" title="' + esc(c.status) + '" style="--c:' + (STATUS_COR[c.status] || '#999') + ';padding:3px"></span>' +
      '<span class="sr-main"><strong>' + esc(clienteNome(c)) + '</strong><small>' + esc([c.contato, c.cidade, maskPhone(c.whatsapp || c.telefone), isAdmin() ? c.vendedor : ''].filter(Boolean).join(' • ')) + '</small></span></button>').join('')
      : '<div class="empty" style="padding:18px">Nenhum cliente encontrado para "' + esc(q) + '".</div>') +
      (res.length > 8 ? '<button data-act="search-all">Ver todos os ' + res.length + ' resultados</button>' : '');
    box.hidden = false;
  }, 160);
  input.addEventListener('input', draw);
  input.addEventListener('focus', draw);
  input.addEventListener('keydown', e => {
    const items = $$('button', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      hl = (hl + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((b, i) => b.classList.toggle('hl', i === hl));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hl >= 0 && items[hl]) items[hl].click(); else searchAll();
    } else if (e.key === 'Escape') { box.hidden = true; input.blur(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) box.hidden = true; });
}
function searchAll() {
  S.clienteFiltro = Object.assign({}, S.clienteFiltro || {}, { q: $('#globalSearch').value.trim() });
  $('#searchResults').hidden = true;
  if (S.route.view === 'clientes') render(); else go('clientes');
}

/* ---------- 9. Telas ---------- */

/** Agenda de contatos: atrasados, hoje e amanhã (clientes não encerrados). */
function agenda() {
  const t = today(), am = addDays(1);
  const ord = (a, b) => a.dataProximoContato.localeCompare(b.dataProximoContato);
  const l = scoped(S.data.clientes).filter(c => c.dataProximoContato && !ENCERRADOS.includes(c.status));
  return {
    atrasados: l.filter(c => c.dataProximoContato.slice(0, 10) < t).sort(ord),
    hoje: l.filter(c => c.dataProximoContato.slice(0, 10) === t).sort(ord),
    amanha: l.filter(c => c.dataProximoContato.slice(0, 10) === am).sort(ord)
  };
}
function pageHead(title, sub, actions = '') {
  return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
    (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
}
function emptyState(title, text, btn = '') {
  return '<div class="empty"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' + btn + '</div>';
}
function scopeLabel() {
  if (!isAdmin()) return 'Sua carteira de clientes';
  return S.scope ? 'Dados de ' + esc(nomeVendedor(S.scope)) : 'Visão de toda a equipe';
}

/* ===== 9.1 Dashboard ===== */
const KPIS = [
  { k: 'totalClientes', label: 'Total de clientes', icon: 'users', go: 'clientes' },
  { k: 'novosClientes', label: 'Novos clientes', icon: 'userplus', foot: () => 'Cadastrados nos últimos 30 dias', go: 'clientes' },
  { k: 'emAndamento', label: 'Prospecções em andamento', icon: 'target', go: 'prospeccoes' },
  { k: 'contatoHoje', label: 'Contatos para hoje', icon: 'calendar', foot: d => d.atrasados ? d.atrasados + ' atrasado(s)' : 'Nenhum atrasado', alert: d => d.atrasados > 0, go: 'contatos' },
  { k: 'semContato', label: 'Clientes sem contato', icon: 'userx', foot: () => 'Nenhum contato registrado', go: 'clientes', filtro: { agenda: 'semcontato' } },
  { k: 'propostasEnviadas', label: 'Propostas enviadas', icon: 'send', foot: d => money(d.valorPropostas) + ' em propostas', go: 'propostas' },
  { k: 'ganhos', label: 'Clientes ganhos', icon: 'trophy', win: true, go: 'clientes', filtro: { status: 'Cliente ganho' } },
  { k: 'perdidos', label: 'Clientes perdidos', icon: 'x', foot: () => 'Inclui "Sem interesse"', go: 'clientes', filtro: { status: 'Cliente perdido' } }
];
function kpiHtml(d) {
  return KPIS.map((k, i) => {
    const has = d && d.cards;
    const c = has ? d.cards : {};
    return '<button class="kpi ' + (has && k.alert && k.alert(c) ? 'alert' : '') + (k.win ? ' win' : '') + '" data-act="kpi" data-i="' + i + '">' +
      '<div class="kpi-top"><span>' + k.label + '</span><span class="kpi-ico">' + icon(k.icon) + '</span></div>' +
      '<div class="kpi-value ' + (has ? '' : 'skeleton') + '">' + (has ? c[k.k] : '00') + '</div>' +
      '<div class="kpi-foot">' + (has && k.foot ? esc(k.foot(c)) : '&nbsp;') + '</div></button>';
  }).join('');
}
VIEWS.dashboard = () => {
  const h = new Date().getHours();
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const d = S.dash && S.dash.vendedor === (isAdmin() ? S.scope : S.user.usuario) ? S.dash : null;
  const ag = agenda();
  const proximos = ag.atrasados.concat(ag.hoje, ag.amanha).slice(0, 6);
  const ultimas = scoped(S.data.propostas).slice().sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao)).slice(0, 5);
  return '<div class="page-head greet"><div><h1>' + saud + ', ' + esc(S.user.nome) + '</h1><p>' + scopeLabel() + ' • ' + esc(data) + '</p></div>' +
    '<div class="page-actions"><button class="btn" data-act="proposta-cliente" data-id="">' + icon('file') + 'Nova proposta</button>' +
    '<button class="btn btn-primary" data-act="new-cliente">' + icon('plus') + 'Novo cliente</button></div></div>' +
    '<div class="kpis" id="kpis">' + kpiHtml(d) + '</div>' +
    '<div class="dash-grid">' +
    chartPanel('Prospecções por vendedor', 'chVend') + chartPanel('Prospecções por status', 'chStatus') +
    chartPanel('Clientes por segmento', 'chSeg') + chartPanel('Prospecções por período (6 meses)', 'chPer') +
    '<section class="panel"><div class="panel-head"><h2>Próximos contatos</h2><button class="btn btn-sm" data-act="go" data-view="contatos">Ver agenda</button></div>' +
    (proximos.length ? '<div class="table-wrap"><table class="tbl responsive"><tbody>' + proximos.map(c =>
      '<tr class="clickable" data-act="open-cliente" data-id="' + esc(c.id) + '"><td class="cell-main"><strong>' + esc(clienteNome(c)) + '</strong><small>' + esc(c.proximoContato || c.contato || '') + '</small></td>' +
      '<td data-label="Quando" class="' + (c.dataProximoContato.slice(0, 10) < today() ? 'late' : '') + ' nowrap">' + relDay(c.dataProximoContato) + '</td>' +
      '<td class="row-actions-cell no-label"><div class="row-actions"><button class="btn btn-sm" data-act="new-atividade" data-id="' + esc(c.id) + '">Registrar contato</button></div></td></tr>').join('') + '</tbody></table></div>'
      : emptyState('Agenda livre', 'Nenhum contato programado para hoje ou amanhã.')) + '</section>' +
    '<section class="panel"><div class="panel-head"><h2>Últimas propostas</h2><button class="btn btn-sm" data-act="go" data-view="propostas">Ver todas</button></div>' +
    (ultimas.length ? '<div class="table-wrap"><table class="tbl responsive"><tbody>' + ultimas.map(p =>
      '<tr class="clickable" data-act="pdf-proposta" data-id="' + esc(p.id) + '"><td class="cell-main"><strong>Nº ' + esc(p.numero) + ' — ' + esc(p.cliente) + '</strong><small>' + fmtDate(p.dataEmissao) + ' • ' + esc(p.tipoOrcamento) + '</small></td>' +
      '<td data-label="Status">' + chip(p.status) + '</td><td data-label="Valor" class="right num nowrap"><strong>' + money(p.valorFinal) + '</strong></td></tr>').join('') + '</tbody></table></div>'
      : emptyState('Nenhuma proposta ainda', 'Monte a primeira proposta para um cliente.', '<button class="btn" data-act="proposta-cliente" data-id="">Nova proposta</button>')) + '</section>' +
    '</div>';
};
VIEWS.dashboard.after = () => { renderDashboardCharts(); refreshDashboard(); };
function chartPanel(title, id) {
  return '<section class="panel"><div class="panel-head"><h2>' + title + '</h2></div><div class="panel-body"><div class="chart-box"><canvas id="' + id + '" aria-label="' + esc(title) + '"></canvas></div></div></section>';
}
async function refreshDashboard() {
  const alvo = isAdmin() ? S.scope : S.user.usuario;
  const d = await run(() => api('dashboard', { vendedor: alvo }, { silent: true }));
  if (!d) return;
  S.dash = d;
  if (S.route.view !== 'dashboard') return;
  $('#kpis').innerHTML = kpiHtml(d);
  renderDashboardCharts();
}
function renderDashboardCharts() {
  S.charts.forEach(c => c.destroy());
  S.charts = [];
  const d = S.dash;
  if (!d || !window.Chart || !$('#chVend')) return;
  const cs = getComputedStyle(document.documentElement);
  const txt = cs.getPropertyValue('--muted').trim(), grid = cs.getPropertyValue('--line').trim(), strong = cs.getPropertyValue('--text-2').trim();
  Chart.defaults.color = txt;
  Chart.defaults.font.family = 'Barlow, sans-serif';
  Chart.defaults.borderColor = grid;
  const noLegend = { legend: { display: false } };
  const vend = Object.entries(d.porVendedor).sort((a, b) => b[1] - a[1]);
  S.charts.push(new Chart($('#chVend'), {
    type: 'bar',
    data: { labels: vend.map(x => x[0]), datasets: [{ data: vend.map(x => x[1]), backgroundColor: strong, borderRadius: 4, maxBarThickness: 42 }] },
    options: { maintainAspectRatio: false, plugins: noLegend, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
  }));
  const st = Object.entries(d.porStatus).filter(x => x[1] > 0);
  S.charts.push(new Chart($('#chStatus'), {
    type: 'doughnut',
    data: { labels: st.length ? st.map(x => x[0]) : ['Sem dados'], datasets: [{ data: st.length ? st.map(x => x[1]) : [1], backgroundColor: st.length ? st.map(x => STATUS_COR[x[0]]) : [grid], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 10 } } } }
  }));
  const seg = Object.entries(d.porSegmento).sort((a, b) => b[1] - a[1]).slice(0, 10);
  S.charts.push(new Chart($('#chSeg'), {
    type: 'bar',
    data: { labels: seg.map(x => x[0]), datasets: [{ data: seg.map(x => x[1]), backgroundColor: '#8d939c', borderRadius: 4, maxBarThickness: 26 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: noLegend, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } }
  }));
  const meses = d.periodo.map(p => { const [y, m] = p.mes.split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + y.slice(2); });
  S.charts.push(new Chart($('#chPer'), {
    type: 'line',
    data: {
      labels: meses, datasets: [
        { label: 'Clientes cadastrados', data: d.periodo.map(p => p.clientes), borderColor: strong, backgroundColor: strong, tension: .3 },
        { label: 'Propostas', data: d.periodo.map(p => p.propostas), borderColor: '#06a3c4', backgroundColor: '#06a3c4', tension: .3 },
        { label: 'Ganhos', data: d.periodo.map(p => p.ganhos), borderColor: '#22b35e', backgroundColor: '#22b35e', tension: .3 }
      ]
    },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
  }));
}

/* ===== 9.2 Clientes ===== */
function filtrarClientes(f) {
  const q = norm(f.q), qd = digits(f.q), t = today();
  const comContato = new Set(S.data.atividades.map(a => a.clienteId));
  let l = scoped(S.data.clientes).filter(c => {
    if (f.status && c.status !== f.status && !(f.status === 'Cliente perdido' && c.status === 'Sem interesse' && f.incluirSemInteresse)) return false;
    if (f.segmento && c.segmento !== f.segmento) return false;
    if (f.cidade && norm(c.cidade) !== norm(f.cidade)) return false;
    if (f.vendedor && c.usuarioVendedor !== f.vendedor) return false;
    if (f.agenda === 'atrasados' && !(c.dataProximoContato && c.dataProximoContato.slice(0, 10) < t)) return false;
    if (f.agenda === 'hoje' && c.dataProximoContato.slice(0, 10) !== t) return false;
    if (f.agenda === 'semana' && !(c.dataProximoContato && c.dataProximoContato.slice(0, 10) >= t && c.dataProximoContato.slice(0, 10) <= addDays(7))) return false;
    if (f.agenda === 'semcontato' && comContato.has(c.id)) return false;
    if (f.agenda === 'semdata' && c.dataProximoContato) return false;
    if (!q) return true;
    const txt = norm([c.empresa, c.razaoSocial, c.contato, c.email, c.cidade, c.bairro, c.vendedor, c.status, c.codigo, c.segmento].join(' '));
    return txt.includes(q) || (qd.length >= 3 && [c.documento, c.telefone, c.whatsapp].some(v => digits(v).includes(qd)));
  });
  const ord = f.ordem || 'recentes';
  l.sort((a, b) =>
    ord === 'nome' ? clienteNome(a).localeCompare(clienteNome(b), 'pt-BR') :
      ord === 'proximo' ? (a.dataProximoContato || '9999').localeCompare(b.dataProximoContato || '9999') :
        ord === 'atualizados' ? b.dataAtualizacao.localeCompare(a.dataAtualizacao) :
          b.dataCadastro.localeCompare(a.dataCadastro));
  return l;
}
VIEWS.clientes = () => {
  const f = S.clienteFiltro = Object.assign({ q: '', status: '', segmento: '', cidade: '', vendedor: '', agenda: '', ordem: 'recentes' }, S.clienteFiltro || {});
  const cidades = [...new Set(scoped(S.data.clientes).map(c => c.cidade).filter(Boolean))].sort();
  const vend = S.data.usuarios.filter(u => u.perfil !== 'admin').map(u => ({ v: u.usuario, l: u.nome }));
  return pageHead('Clientes', scopeLabel(),
    '<button class="btn" data-act="export-clientes">' + icon('download') + 'Exportar CSV</button><button class="btn btn-primary" data-act="new-cliente">' + icon('plus') + 'Novo cliente</button>') +
    '<section class="panel"><div class="toolbar" id="cliFiltros">' +
    '<input type="search" name="q" placeholder="Empresa, contato, CPF/CNPJ, telefone, e-mail, cidade…" value="' + esc(f.q) + '" aria-label="Pesquisar clientes">' +
    '<select name="status" aria-label="Status">' + options(STATUS, f.status, 'Todos os status') + '</select>' +
    '<select name="agenda" aria-label="Próximo contato">' + options([{ v: 'atrasados', l: 'Contatos atrasados' }, { v: 'hoje', l: 'Contato hoje' }, { v: 'semana', l: 'Próximos 7 dias' }, { v: 'semdata', l: 'Sem data de contato' }, { v: 'semcontato', l: 'Nunca contatados' }], f.agenda, 'Qualquer agenda') + '</select>' +
    '<select name="segmento" aria-label="Segmento">' + options(SEGMENTOS, f.segmento, 'Todos os segmentos') + '</select>' +
    '<select name="cidade" aria-label="Cidade">' + options(cidades, f.cidade, 'Todas as cidades') + '</select>' +
    (isAdmin() && !S.scope ? '<select name="vendedor" aria-label="Vendedor">' + options(vend, f.vendedor, 'Todos os vendedores') + '</select>' : '') +
    '<select name="ordem" aria-label="Ordenar">' + options([{ v: 'recentes', l: 'Mais recentes' }, { v: 'atualizados', l: 'Atualizados' }, { v: 'nome', l: 'Nome (A–Z)' }, { v: 'proximo', l: 'Próximo contato' }], f.ordem, null) + '</select>' +
    '</div><div id="cliLista"></div></section><button class="fab" data-act="new-cliente" aria-label="Novo cliente">' + icon('plus') + '</button>';
};
VIEWS.clientes.after = () => {
  S.cliLimite = 60;
  drawClientes();
  const box = $('#cliFiltros');
  const upd = () => { Object.assign(S.clienteFiltro, formDataFrom(box)); S.cliLimite = 60; drawClientes(); };
  box.addEventListener('input', debounce(upd, 180));
  box.addEventListener('change', upd);
};
function formDataFrom(box) { const o = {}; $$('[name]', box).forEach(el => { o[el.name] = el.value; }); return o; }
function drawClientes() {
  const l = filtrarClientes(S.clienteFiltro);
  const showV = isAdmin();
  const rows = l.slice(0, S.cliLimite).map(c => {
    const late = c.dataProximoContato && c.dataProximoContato.slice(0, 10) < today() && !ENCERRADOS.includes(c.status);
    const fone = c.whatsapp || c.telefone;
    return '<tr class="clickable" data-act="open-cliente" data-id="' + esc(c.id) + '">' +
      '<td class="cell-main"><strong>' + esc(clienteNome(c)) + '</strong><small>' + esc([c.contato && c.empresa ? c.contato : '', '#' + c.codigo, c.segmento].filter(Boolean).join(' • ')) + '</small></td>' +
      '<td data-label="Cidade">' + esc([c.cidade, c.estado].filter(Boolean).join('/')) + '</td>' +
      '<td data-label="Status">' + chip(c.status) + '</td>' +
      '<td data-label="Próximo contato" class="nowrap ' + (late ? 'late' : '') + '">' + (c.dataProximoContato ? relDay(c.dataProximoContato) : '<span class="muted">—</span>') + '</td>' +
      (showV ? '<td data-label="Vendedor">' + esc(c.vendedor) + '</td>' : '') +
      '<td class="row-actions-cell no-label"><div class="row-actions">' +
      (fone ? '<button class="btn-icon" data-act="whatsapp" data-id="' + esc(c.id) + '" title="WhatsApp" aria-label="WhatsApp">' + icon('wa') + '</button>' +
        '<a class="btn-icon" data-act="noop" href="tel:' + esc(digits(c.telefone || c.whatsapp)) + '" title="Ligar" aria-label="Ligar">' + icon('phone') + '</a>' : '') +
      '<button class="btn-icon" data-act="new-atividade" data-id="' + esc(c.id) + '" title="Registrar contato" aria-label="Registrar contato">' + icon('history') + '</button>' +
      '<button class="btn-icon" data-act="proposta-cliente" data-id="' + esc(c.id) + '" title="Fazer orçamento" aria-label="Fazer orçamento">' + icon('file') + '</button>' +
      '</div></td></tr>';
  }).join('');
  $('#cliLista').innerHTML = l.length
    ? '<div class="table-wrap"><table class="tbl responsive"><thead><tr><th>Cliente</th><th>Cidade</th><th>Status</th><th>Próximo contato</th>' + (showV ? '<th>Vendedor</th>' : '') + '<th class="right">Ações</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="more"><span class="muted">' + Math.min(l.length, S.cliLimite) + ' de ' + l.length + ' cliente(s)</span>' + (l.length > S.cliLimite ? '&nbsp;&nbsp;<button class="btn btn-sm" data-act="cli-more">Mostrar mais</button>' : '') + '</div>'
    : (S.data.clientes.length ? emptyState('Nenhum cliente encontrado', 'Ajuste a pesquisa ou os filtros.') : emptyState('Sua carteira está vazia', 'Cadastre o primeiro cliente para começar a prospecção.', '<button class="btn btn-primary" data-act="new-cliente">Cadastrar cliente</button>'));
}
function exportClientes() {
  const l = filtrarClientes(S.clienteFiltro || {});
  const cols = [['codigo', 'Código'], ['dataCadastro', 'Data de cadastro'], ['vendedor', 'Vendedor'], ['empresa', 'Cliente'], ['razaoSocial', 'Razão social'], ['documento', 'CPF/CNPJ'], ['contato', 'Contato'], ['cargo', 'Cargo'], ['telefone', 'Telefone'], ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['endereco', 'Endereço'], ['numero', 'Número'], ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'UF'], ['cep', 'CEP'], ['segmento', 'Segmento'], ['origem', 'Origem'], ['status', 'Status'], ['interesse', 'Interesse'], ['dataProximoContato', 'Próximo contato'], ['obsCliente', 'Observações para o cliente']];
  downloadFile('clientes_vegas_' + today() + '.csv', toCSV(cols.map(c => c[1]), l.map(c => cols.map(k => c[k[0]]))));
  toast(l.length + ' cliente(s) exportado(s).');
}

/* ===== 9.3 Ficha completa do cliente ===== */
function openFicha(id, tab = 'resumo') {
  const c = byId(S.data.clientes, id);
  if (!c) return toast('Cliente não encontrado.', 'err');
  S.ficha = { id, tab, hist: null };
  const m = openModal({ title: false, size: 'xl', flush: true, body: '<div id="fichaBox"></div>', onClose: () => { S.ficha = null; } });
  m.classList.add('ficha-modal');
  drawFicha();
}
function drawFicha() {
  if (!S.ficha) return;
  const box = $('#fichaBox');
  if (!box) return;
  const c = byId(S.data.clientes, S.ficha.id);
  if (!c) { closeModal(); return; }
  const tab = S.ficha.tab;
  const prosp = S.data.prospeccoes.filter(p => p.clienteId === c.id);
  const ativ = S.data.atividades.filter(a => a.clienteId === c.id).sort((a, b) => b.data.localeCompare(a.data));
  const props = S.data.propostas.filter(p => p.clienteId === c.id).sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));
  const fone = c.whatsapp || c.telefone;
  const late = c.dataProximoContato && c.dataProximoContato.slice(0, 10) < today() && !ENCERRADOS.includes(c.status);
  const tabs = [['resumo', 'Resumo'], ['produtos', 'Produtos de interesse', prosp.length], ['contatos', 'Histórico de contatos', ativ.length], ['propostas', 'Propostas', props.length], ['alteracoes', 'Alterações']];
  box.innerHTML =
    '<div class="ficha-head"><div style="min-width:0"><h2>' + esc(clienteNome(c)) + '</h2>' +
    '<div class="sub">' + esc(['Cliente #' + c.codigo, c.razaoSocial && c.razaoSocial !== c.empresa ? c.razaoSocial : '', c.documento ? maskDoc(c.documento) : ''].filter(Boolean).join(' • ')) + '</div>' +
    '<div class="stat-line" style="margin-top:10px"><span class="tag">Vendedor: ' + esc(c.vendedor) + '</span>' + (c.segmento ? '<span class="tag">' + esc(c.segmento) + '</span>' : '') +
    (c.dataProximoContato ? '<span class="tag ' + (late ? 'late' : '') + '">Próximo contato: ' + relDay(c.dataProximoContato) + '</span>' : '') + '</div></div>' +
    '<div style="display:flex;gap:8px;align-items:center"><label class="sr-only" for="fichaStatus">Status</label><select id="fichaStatus" class="status-select" data-id="' + esc(c.id) + '">' + options(STATUS, c.status, null) + '</select>' +
    '<button class="btn-icon" data-close aria-label="Fechar">' + icon('x') + '</button></div></div>' +
    '<div class="ficha-actions">' +
    '<button class="btn" data-act="edit-cliente" data-id="' + esc(c.id) + '">' + icon('edit') + 'Editar</button>' +
    '<button class="btn" data-act="new-atividade" data-id="' + esc(c.id) + '">' + icon('history') + 'Registrar contato</button>' +
    '<button class="btn" data-act="new-prospeccao" data-id="' + esc(c.id) + '">' + icon('box') + 'Adicionar produto</button>' +
    '<button class="btn btn-primary" data-act="proposta-cliente" data-id="' + esc(c.id) + '">' + icon('file') + 'Fazer orçamento</button>' +
    (fone ? '<button class="btn btn-wa" data-act="whatsapp" data-id="' + esc(c.id) + '">' + icon('wa') + 'WhatsApp</button>' : '') +
    (c.telefone || c.whatsapp ? '<a class="btn" href="tel:' + esc(digits(c.telefone || c.whatsapp)) + '">' + icon('phone') + 'Telefone</a>' : '') +
    ((c.latitude || c.endereco) ? '<a class="btn" target="_blank" rel="noopener" href="' + mapaLink(c) + '">' + icon('pin') + 'Mapa</a>' : '') +
    (c.email ? '<a class="btn" href="mailto:' + esc(c.email) + '?subject=' + encodeURIComponent('Vegas Vigilância — ' + clienteNome(c)) + '">' + icon('mail') + 'E-mail</a>' : '') +
    '<button class="btn btn-danger" data-act="delete-cliente" data-id="' + esc(c.id) + '" style="margin-left:auto">' + icon('trash') + 'Excluir</button></div>' +
    '<div class="tabs" role="tablist">' + tabs.map(t => '<button role="tab" class="' + (t[0] === tab ? 'active' : '') + '" data-act="ficha-tab" data-tab="' + t[0] + '">' + t[1] + (t[2] !== undefined ? '<span class="count">' + t[2] + '</span>' : '') + '</button>').join('') + '</div>' +
    '<div class="ficha-body">' + fichaTab(c, tab, prosp, ativ, props) + '</div>';
  $('#fichaStatus').onchange = e => changeStatus(c.id, e.target.value);
  if (tab === 'alteracoes' && S.ficha.hist === null) loadHistorico(c.id);
}
function mapaLink(c) {
  const q = c.latitude && c.longitude ? c.latitude + ',' + c.longitude : [c.endereco, c.numero, c.bairro, c.cidade, c.estado].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}
const dd = (label, v) => '<div><dt>' + label + '</dt><dd>' + (v ? esc(v) : '<span class="muted">—</span>') + '</dd></div>';
function fichaTab(c, tab, prosp, ativ, props) {
  if (tab === 'resumo') {
    const end = [c.endereco, c.numero, c.complemento].filter(Boolean).join(', ');
    return '<fieldset class="section"><legend>' + icon('users') + 'Dados do cliente</legend><dl class="dl">' +
      dd('Nome do cliente', c.empresa) + dd('Razão social', c.razaoSocial) + dd('CPF/CNPJ', c.documento ? maskDoc(c.documento) : '') + dd('RG / Inscrição estadual', c.inscricao) + dd('Inscrição municipal', c.inscricaoMunicipal) + dd('Segmento', c.segmento) +
      dd('Endereço', end) + dd('Bairro', c.bairro) + dd('Cidade / UF', [c.cidade, c.estado].filter(Boolean).join(' / ')) + dd('CEP', c.cep) + dd('Localização (GPS)', c.latitude ? c.latitude + ', ' + c.longitude : '') + '</dl></fieldset>' +
      '<fieldset class="section"><legend>' + icon('users') + 'Contato</legend><dl class="dl">' +
      dd('Pessoa de contato', c.contato) + dd('Representante legal', [c.representante, c.representanteCargo].filter(Boolean).join(' — ')) + dd('CPF do representante', c.representanteCpf) + dd('Qualificação do representante', [c.representanteNacionalidade, c.representanteEstadoCivil, c.representanteProfissao, c.representanteRg ? 'RG ' + c.representanteRg : ''].filter(Boolean).join(', ')) + dd('Cargo', c.cargo) + dd('Telefone', maskPhone(c.telefone)) + dd('WhatsApp', maskPhone(c.whatsapp)) + dd('E-mail', c.email) + '</dl></fieldset>' +
      '<fieldset class="section"><legend>' + icon('target') + 'Prospecção</legend><dl class="dl">' +
      dd('Vendedor responsável', c.vendedor) + dd('Origem do lead', c.origem) + dd('Status', c.status) + dd('Interesse', c.interesse) + dd('Produto de interesse', c.produtoInteresse) +
      dd('Próximo contato', c.dataProximoContato ? fmtDate(c.dataProximoContato) + (c.proximoContato ? ' — ' + c.proximoContato : '') : '') +
      dd('Cadastrado em', fmtDate(c.dataCadastro, true)) + dd('Última atualização', fmtDate(c.dataAtualizacao, true) + (c.atualizadoPor ? ' por ' + c.atualizadoPor : '')) + '</dl></fieldset>' +
      '<div class="note-title">Observações para o cliente <span class="tag">Pode sair no orçamento</span></div><div class="note obs-cliente">' + (c.obsCliente ? esc(c.obsCliente) : '<span class="muted">Nenhuma observação.</span>') + '</div>' +
      '<div class="note-title">Observações internas <span class="tag">Não aparece no PDF</span></div><div class="note obs-interna">' + (c.obsInterna ? esc(c.obsInterna) : '<span class="muted">Nenhuma observação interna.</span>') + '</div>';
  }
  if (tab === 'produtos') {
    const total = prosp.reduce((s, p) => s + num(p.valor), 0);
    return (prosp.length ? '<div class="table-wrap"><table class="tbl responsive"><thead><tr><th>Produto</th><th>Qtd.</th><th class="right">Valor</th><th>Status</th><th>Data</th><th></th></tr></thead><tbody>' +
      prosp.map(p => '<tr><td class="cell-main"><strong>' + esc(p.produto) + '</strong><small>' + esc(p.observacao) + '</small></td><td data-label="Qtd.">' + esc(p.quantidade) + '</td><td data-label="Valor" class="right num">' + money(p.valor) + '</td><td data-label="Status">' + chip(p.status) + '</td><td data-label="Data">' + fmtDate(p.data) + '</td>' +
        '<td class="row-actions-cell no-label"><div class="row-actions"><button class="btn-icon" data-act="edit-prospeccao" data-id="' + esc(p.id) + '" aria-label="Editar">' + icon('edit') + '</button><button class="btn-icon" data-act="delete-prospeccao" data-id="' + esc(p.id) + '" aria-label="Remover">' + icon('trash') + '</button></div></td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="2">Total estimado</td><td class="right num">' + money(total) + '</td><td colspan="3"></td></tr></tfoot></table></div>'
      : emptyState('Nenhum produto de interesse', 'Registre os produtos que o cliente pediu ou demonstrou interesse.')) +
      '<div style="margin-top:14px"><button class="btn" data-act="new-prospeccao" data-id="' + esc(c.id) + '">' + icon('plus') + 'Adicionar produto</button></div>';
  }
  if (tab === 'contatos') return timelineHtml(ativ, false) + '<div style="margin-top:6px"><button class="btn" data-act="new-atividade" data-id="' + esc(c.id) + '">' + icon('plus') + 'Registrar contato</button></div>';
  if (tab === 'propostas') {
    return (props.length ? propostasTable(props, true) : emptyState('Nenhuma proposta', 'Gere um orçamento em PDF para este cliente.')) +
      '<div style="margin-top:14px"><button class="btn btn-primary" data-act="proposta-cliente" data-id="' + esc(c.id) + '">' + icon('file') + 'Gerar orçamento/PDF</button></div>';
  }
  if (tab === 'alteracoes') {
    const h = S.ficha.hist;
    if (h === null) return '<p class="muted">Carregando histórico…</p>';
    if (!h.length) return emptyState('Sem alterações registradas', 'As alterações feitas neste cliente aparecem aqui.');
    return '<ul class="timeline">' + h.map(x => '<li class="tl-item"><span class="tl-dot">' + icon('history') + '</span><header><strong>' + esc(x.acao) + '</strong><small>' + fmtDate(x.data, true) + ' • ' + esc(x.usuario) + '</small></header><p>' + esc(x.detalhes) + '</p></li>').join('') + '</ul>';
  }
  return '';
}
async function loadHistorico(id) {
  const h = await run(() => api('historico', { entidadeId: id }, { silent: true }));
  if (!S.ficha || S.ficha.id !== id) return;
  S.ficha.hist = h || [];
  drawFicha();
}
function timelineHtml(ativ, showCliente) {
  if (!ativ.length) return emptyState('Nenhum contato registrado', 'Registre ligações, visitas, mensagens e reuniões para montar a linha do tempo.');
  let lastDay = '';
  return '<ul class="timeline">' + ativ.map(a => {
    const tipo = TIPOS_CONTATO.find(t => t.t === a.tipo) || TIPOS_CONTATO[6];
    const day = String(a.data).slice(0, 10);
    const head = day !== lastDay ? '<li class="tl-day">' + (relDay(day) === fmtDate(day) ? fmtDate(day) : relDay(day) + ' — ' + fmtDate(day)) + '</li>' : '';
    lastDay = day;
    return head + '<li class="tl-item"><span class="tl-dot">' + icon(tipo.i) + '</span><header><strong>' + esc(a.tipo) + (showCliente ? ' — <a href="#" data-act="open-cliente" data-id="' + esc(a.clienteId) + '">' + esc(a.cliente) + '</a>' : '') + '</strong>' +
      '<small>' + (String(a.data).slice(11, 16) || '') + ' • ' + esc(a.vendedor) + '</small></header><p>' + esc(a.descricao) + '</p>' +
      '<div class="tl-meta">' + (a.resultado ? '<span class="tag">Resultado: ' + esc(a.resultado) + '</span>' : '') +
      (a.dataProximoContato ? '<span class="tag">Próximo: ' + fmtDate(a.dataProximoContato) + (a.proximoContato ? ' — ' + esc(a.proximoContato) : '') + '</span>' : '') +
      (a.observacoes ? '<span class="tag">Obs.: ' + esc(a.observacoes) + '</span>' : '') +
      (!showCliente ? '<button class="link" data-act="delete-atividade" data-id="' + esc(a.id) + '">Excluir</button>' : '') + '</div></li>';
  }).join('') + '</ul>';
}
/** Atualiza tela e ficha após uma alteração, sem perder o editor de proposta aberto. */
function refreshAll() {
  if (S.ficha) drawFicha();
  if (S.route.view === 'propostas' && S.route.param) { renderNav(); return; }
  const y = window.scrollY;
  S.charts.forEach(c => c.destroy()); S.charts = [];
  $('#view').innerHTML = VIEWS[S.route.view](S.route.param);
  if (VIEWS[S.route.view].after) VIEWS[S.route.view].after(S.route.param);
  renderNav();
  window.scrollTo(0, y);
  try { store.set('vg_cache', JSON.stringify(S.data)); } catch (e) { /* noop */ }
}
async function changeStatus(id, status) {
  const r = await run(() => api('updateStatusCliente', { id, status }));
  if (r) { upsert(S.data.clientes, r); if (S.ficha) S.ficha.hist = null; toast('Status alterado para "' + status + '".'); refreshAll(); }
  else refreshAll();
}
async function deleteCliente(id) {
  const c = byId(S.data.clientes, id);
  if (!(await confirmDialog('Excluir o cliente "' + clienteNome(c) + '"? Os contatos e produtos de interesse vinculados também serão removidos. As propostas ficam guardadas.', { title: 'Excluir cliente', ok: 'Excluir', danger: true }))) return;
  const ok = await run(() => api('deleteCliente', { id }));
  if (!ok) return;
  S.data.clientes = S.data.clientes.filter(x => x.id !== id);
  S.data.prospeccoes = S.data.prospeccoes.filter(x => x.clienteId !== id);
  S.data.atividades = S.data.atividades.filter(x => x.clienteId !== id);
  closeModal();
  toast('Cliente excluído.');
  refreshAll();
}

/* ===== 10. Formulários ===== */
function openClienteForm(id, opts = {}) {
  const c = id ? byId(S.data.clientes, id) : { status: 'Novo lead', estado: 'RJ', origem: '', usuarioVendedor: S.user.usuario };
  const vendOpts = S.data.usuarios.filter(u => u.status === 'Ativo').map(u => ({ v: u.usuario, l: u.nome }));
  const f = (name, label, attrs = '', cls = '') => '<label class="field ' + cls + '"><span' + (attrs.includes('required') ? ' class="req"' : '') + '>' + label + '</span><input name="' + name + '" value="' + esc(c[name] || '') + '" ' + attrs + '></label>';
  const sel = (name, label, list, cls = '', blank = 'Selecione') => '<label class="field ' + cls + '"><span>' + label + '</span><select name="' + name + '">' + options(list, c[name] || '', blank) + '</select></label>';
  const body = '<form id="cliForm" novalidate>' +
    '<div class="geo-bar"><button type="button" class="btn" data-geo>' + icon('pin') + 'Usar localização atual</button>' +
    '<span class="geo-status" id="geoStatus">' + (c.latitude ? 'Localização salva: ' + esc(c.latitude) + ', ' + esc(c.longitude) : 'Preenche o endereço pelo GPS do aparelho.') + '</span>' +
    '<input type="hidden" name="latitude" value="' + esc(c.latitude || '') + '"><input type="hidden" name="longitude" value="' + esc(c.longitude || '') + '"></div>' +
    '<fieldset class="section"><legend>' + icon('users') + 'Dados do cliente</legend><div class="grid g4">' +
    f('empresa', 'Nome do cliente', 'type="text" required placeholder="Nome da pessoa ou da empresa"', 'span2') + f('razaoSocial', 'Razão social (se for empresa)', 'type="text"', 'span2') +
    f('documento', 'CPF/CNPJ', 'type="text" inputmode="numeric" data-mask="doc"') + f('inscricao', 'RG (pessoa física) / Inscrição estadual (empresa)', 'type="text"') + sel('segmento', 'Segmento', SEGMENTOS, 'span2') +
    f('cep', 'CEP', 'type="text" inputmode="numeric" data-mask="cep" placeholder="00000-000"') + f('endereco', 'Endereço', 'type="text" autocomplete="address-line1"', 'span2') + f('numero', 'Número', 'type="text"') +
    f('complemento', 'Complemento', 'type="text"') + f('bairro', 'Bairro', 'type="text"') + f('cidade', 'Cidade', 'type="text"') + sel('estado', 'Estado', UFS, '', 'UF') +
    '</div></fieldset>' +
    '<fieldset class="section"><legend>' + icon('users') + 'Contato</legend><div class="grid g4">' +
    f('contato', 'Pessoa de contato (se diferente do cliente)', 'type="text" autocomplete="name"', 'span2') + f('cargo', 'Cargo', 'type="text"', 'span2') +
    f('telefone', 'Telefone', 'type="tel" inputmode="tel" data-mask="phone"') + f('whatsapp', 'WhatsApp', 'type="tel" inputmode="tel" data-mask="phone"') + f('email', 'E-mail', 'type="email" autocomplete="email"', 'span2') +
    '</div></fieldset>' +
    '<fieldset class="section"><legend>' + icon('contract') + 'Dados para contrato <span class="muted" style="font-weight:500;font-size:13px">(empresa)</span></legend><div class="grid g4">' +
    f('inscricaoMunicipal', 'Inscrição municipal', 'type="text" placeholder="Número ou ISENTO"') + f('representante', 'Representante legal', 'type="text"', 'span2') + f('representanteCargo', 'Cargo do representante', 'type="text" placeholder="Ex.: Sócio-administrador"') +
    f('representanteCpf', 'CPF do representante', 'type="text" inputmode="numeric" data-mask="doc"') + f('representanteRg', 'RG do representante', 'type="text"') +
    '<label class="field"><span>Nacionalidade do representante</span><input name="representanteNacionalidade" list="dlNac" value="' + esc(c.representanteNacionalidade || '') + '" placeholder="Ex.: brasileiro"><datalist id="dlNac"><option value="brasileiro"><option value="brasileira"></datalist></label>' +
    sel('representanteEstadoCivil', 'Estado civil do representante', ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a)', 'em união estável']) +
    f('representanteProfissao', 'Profissão do representante', 'type="text" placeholder="Ex.: empresário"', 'span2') +
    '<small class="muted span2" style="align-self:end">Exigidos nos contratos de pessoa jurídica.</small></div></fieldset>' +
    '<fieldset class="section"><legend>' + icon('target') + 'Prospecção</legend><div class="grid g4">' +
    (isAdmin() ? '<label class="field"><span>Vendedor responsável</span><select name="usuarioVendedor">' + options(vendOpts, c.usuarioVendedor || S.user.usuario, null) + '</select></label>'
      : '<label class="field"><span>Vendedor responsável</span><input type="text" value="' + esc(c.vendedor || S.user.nome) + '" readonly></label>') +
    sel('origem', 'Origem do lead', ORIGENS) + sel('status', 'Status', STATUS, '', null) +
    '<label class="field"><span>Data do próximo contato</span><input type="date" name="dataProximoContato" value="' + esc((c.dataProximoContato || '').slice(0, 10)) + '"></label>' +
    '<label class="field span2"><span>Interesse</span><input name="interesse" list="dlInteresse" value="' + esc(c.interesse || '') + '" placeholder="Ex.: Câmeras / CFTV"><datalist id="dlInteresse">' + INTERESSES.map(i => '<option value="' + esc(i) + '">').join('') + '</datalist></label>' +
    '<label class="field span2"><span>Produto de interesse</span><input name="produtoInteresse" list="dlProdutos" value="' + esc(c.produtoInteresse || '') + '" placeholder="Pesquise no catálogo ou digite"><datalist id="dlProdutos">' + S.data.produtos.filter(p => p.status !== 'Inativo').slice(0, 800).map(p => '<option value="' + esc(p.produto) + '">').join('') + '</datalist></label>' +
    f('proximoContato', 'Próximo contato (o que fazer)', 'type="text" placeholder="Ex.: Ligar para apresentar proposta"', 'span-all') +
    '</div></fieldset>' +
    '<fieldset class="section"><legend>' + icon('edit') + 'Observações</legend><div class="grid">' +
    '<label class="field obs-cliente"><span>OBSERVAÇÕES PARA O CLIENTE</span><textarea name="obsCliente" class="big" placeholder="Ex.: Cliente solicitou instalação de 16 câmeras, controle de acesso e monitoramento 24 horas.">' + esc(c.obsCliente || '') + '</textarea><small>Pode ser incluída no orçamento em PDF.</small></label>' +
    '<label class="field obs-interna"><span>OBSERVAÇÕES INTERNAS</span><textarea name="obsInterna" placeholder="Anotações da equipe. Nunca aparecem no PDF.">' + esc(c.obsInterna || '') + '</textarea><small>Visível somente para a equipe Vegas.</small></label>' +
    '</div></fieldset></form>';
  const m = openModal({
    title: id ? 'Editar cliente' : 'Novo cliente', size: 'lg', body,
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-save>' + icon('check') + (id ? 'Salvar alterações' : 'Cadastrar cliente') + '</button>'
  });
  const form = $('#cliForm', m);
  $$('[data-mask]', form).forEach(el => { el.value = applyMask(el.dataset.mask, el.value); });
  $('[name=cep]', form).addEventListener('blur', () => buscaCEP(form));
  // Veio da tela de contrato: destaca o que falta preencher
  if (opts.destacar && opts.destacar.length) {
    opts.destacar.forEach(n => { const el = $('[name=' + n + ']', form); if (el) el.classList.add('invalid'); });
    const el0 = $('[name=' + opts.destacar[0] + ']', form);
    if (el0) setTimeout(() => { el0.scrollIntoView({ block: 'center' }); el0.focus(); }, 80);
    form.addEventListener('input', e => { if (e.target.value.trim()) e.target.classList.remove('invalid'); });
  }
  $('[data-geo]', m).onclick = () => geoFill(form, true);
  // Novo cadastro: busca a localização automaticamente (o vendedor normalmente está no local)
  if (!id) geoFill(form, false);
  const save = async (confirmarDuplicado = false) => {
    const d = formData(form);
    const errs = [];
    $$('.invalid', form).forEach(x => x.classList.remove('invalid'));
    const bad = (n, msg) => { errs.push(msg); const el = $('[name=' + n + ']', form); if (el) el.classList.add('invalid'); };
    if (!d.empresa && d.contato) d.empresa = d.contato;
    if (!d.empresa) bad('empresa', 'Informe o nome do cliente.');
    if (d.documento && !validaDoc(d.documento)) bad('documento', 'CPF/CNPJ inválido.');
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) bad('email', 'E-mail inválido.');
    if (d.telefone && digits(d.telefone).length < 10) bad('telefone', 'Telefone incompleto (inclua o DDD).');
    if (d.whatsapp && digits(d.whatsapp).length < 10) bad('whatsapp', 'WhatsApp incompleto (inclua o DDD).');
    if (d.representanteCpf && !(digits(d.representanteCpf).length === 11 && validaDoc(d.representanteCpf))) bad('representanteCpf', 'CPF do representante inválido.');
    if (errs.length) { toast(errs[0], 'err'); const el = $('.invalid', form); if (el) el.focus(); return; }
    d.documento = digits(d.documento) ? maskDoc(d.documento) : '';
    d.id = id || '';
    d.confirmarDuplicado = confirmarDuplicado;
    try {
      const r = await api('saveCliente', d);
      upsert(S.data.clientes, r);
      closeModal(m);
      toast(id ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
      if (S.ficha) S.ficha.hist = null;
      refreshAll();
      if (opts.onSaved) { opts.onSaved(r); return; }
      if (!id && S.route.view === 'propostas' && S.route.param && S.prop) {
        // Cadastro feito a partir do editor de proposta: já seleciona o cliente
        S.prop.clienteId = r.id;
        $('#pCliente').value = clienteLabel(r);
        $('#dlCli').insertAdjacentHTML('beforeend', '<option value="' + esc(clienteLabel(r)) + '">');
        $('#pCliInfo').textContent = [r.contato, maskPhone(r.whatsapp || r.telefone), r.email].filter(Boolean).join(' • ');
        if (r.obsCliente && !S.prop.obsCliente) { S.prop.obsCliente = r.obsCliente; $('#pObs').value = r.obsCliente; }
      } else if (!id) openFicha(r.id);
    } catch (e) {
      if (e.code === 'DUP') {
        if (await confirmDialog(e.message + ' Deseja cadastrar mesmo assim?', { title: 'Possível duplicidade', ok: 'Cadastrar mesmo assim' })) save(true);
      } else if (e.code !== 'AUTH') toast(e.message || 'Erro ao salvar os dados.', 'err');
    }
  };
  $('[data-save]', m).onclick = () => save(false);
  form.addEventListener('submit', e => { e.preventDefault(); save(false); });
}
/* Localização automática: GPS do aparelho → endereço (OpenStreetMap/Nominatim) → CEP (ViaCEP).
   Só preenche campos vazios; nada que o vendedor digitou é sobrescrito. */
const UF_NOME = { 'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB', 'parana': 'PR', 'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO' };
function geoFill(form, manual) {
  const st = $('#geoStatus');
  const say = (t, cls = '') => { if (st) { st.textContent = t; st.className = 'geo-status ' + cls; } };
  if (!('geolocation' in navigator)) { if (manual) toast('Este aparelho não oferece localização.', 'err'); return say('Localização indisponível neste aparelho.'); }
  if (!window.isSecureContext) return say('A localização exige o sistema publicado em HTTPS.', 'warn');
  say('Buscando sua localização…', 'busy');
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
    if (!form.isConnected) return;
    $('[name=latitude]', form).value = lat;
    $('[name=longitude]', form).value = lng;
    say('Localização capturada (precisão ~' + Math.round(pos.coords.accuracy) + ' m). Buscando endereço…', 'busy');
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=' + lat + '&lon=' + lng).then(x => x.json());
      const a = r.address || {};
      const set = (n, v) => { const el = $('[name=' + n + ']', form); if (el && !el.value.trim() && v) { el.value = v; el.classList.add('geo-filled'); } };
      const iso = String(a['ISO3166-2-lvl4'] || '').replace('BR-', '');
      set('endereco', a.road || a.pedestrian || a.residential);
      set('numero', a.house_number);
      set('bairro', a.suburb || a.neighbourhood || a.quarter || a.city_district);
      set('cidade', a.city || a.town || a.village || a.municipality);
      const uf = iso.length === 2 ? iso : UF_NOME[norm(a.state)];
      if (uf) $('[name=estado]', form).value = uf;
      if (a.postcode) { set('cep', maskCEP(a.postcode)); buscaCEP(form, true); }
      say('Endereço preenchido pela localização. Confira o número e o complemento.', 'ok');
      if (manual) toast('Endereço preenchido pela localização.');
    } catch (e) {
      say('Coordenadas salvas, mas não foi possível buscar o endereço (sem internet?).', 'warn');
    }
  }, err => {
    const msg = err.code === 1 ? 'Permissão de localização negada. Libere nas configurações do navegador.' : err.code === 3 ? 'A localização demorou demais. Tente novamente.' : 'Não foi possível obter a localização.';
    say(msg, 'warn');
    if (manual) toast(msg, 'err');
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}
function applyMask(type, v) { return type === 'phone' ? maskPhone(v) : type === 'doc' ? maskDoc(v) : type === 'cep' ? maskCEP(v) : v; }
async function buscaCEP(form, completar = false) {
  const cep = digits($('[name=cep]', form).value);
  if (cep.length !== 8 || (!completar && $('[name=endereco]', form).value)) return;
  try {
    const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/').then(x => x.json());
    if (r.erro) return toast('CEP não encontrado.', 'warn');
    const set = (n, v) => { const el = $('[name=' + n + ']', form); if (el && !el.value && v) el.value = v; };
    set('endereco', r.logradouro); set('bairro', r.bairro); set('cidade', r.localidade);
    if (r.uf) $('[name=estado]', form).value = r.uf;
    if (!completar) $('[name=numero]', form).focus();
  } catch (e) { /* sem internet: preenchimento manual */ }
}

function openAtividadeForm(clienteId, tipoPadrao = 'Ligação') {
  const c = byId(S.data.clientes, clienteId);
  if (!c) return;
  const body = '<form id="atvForm" class="grid" novalidate>' +
    '<div class="field"><span class="field-label">Tipo de contato</span><div class="segmented">' + TIPOS_CONTATO.map(t => '<label><input type="radio" name="tipo" value="' + t.t + '"' + (t.t === tipoPadrao ? ' checked' : '') + '><span>' + icon(t.i) + t.t + '</span></label>').join('') + '</div></div>' +
    '<div class="grid g2"><label class="field"><span>Data e hora</span><input type="datetime-local" name="data" value="' + localDT() + '"></label>' +
    '<label class="field"><span>Resultado</span><input name="resultado" list="dlRes" placeholder="Ex.: Solicitou orçamento"><datalist id="dlRes">' + RESULTADOS.map(r => '<option value="' + esc(r) + '">').join('') + '</datalist></label></div>' +
    '<label class="field"><span class="req">Descrição</span><textarea name="descricao" required placeholder="O que foi conversado?"></textarea></label>' +
    '<fieldset class="section" style="margin:0"><legend>' + icon('calendar') + 'Próximo contato</legend><div class="grid g2">' +
    '<label class="field"><span>Data</span><input type="date" name="dataProximoContato" value="' + esc((c.dataProximoContato || '').slice(0, 10) >= today() ? c.dataProximoContato.slice(0, 10) : '') + '"></label>' +
    '<label class="field"><span>O que fazer</span><input name="proximoContato" value="' + esc(c.proximoContato || '') + '" placeholder="Ex.: Enviar orçamento"></label></div>' +
    '<div class="segmented" style="margin-top:10px">' + [[1, 'Amanhã'], [3, 'Em 3 dias'], [7, 'Em 1 semana'], [15, 'Em 15 dias'], [30, 'Em 30 dias']].map(x => '<button type="button" class="btn btn-sm" data-dias="' + x[0] + '">' + x[1] + '</button>').join('') + '</div></fieldset>' +
    '<div class="grid g2"><label class="field"><span>Status do cliente</span><select name="novoStatus">' + options(STATUS, c.status, null) + '</select></label>' +
    '<label class="field"><span>Observação</span><input name="observacoes"></label></div></form>';
  const m = openModal({
    title: 'Registrar contato — ' + clienteNome(c), size: 'lg', body,
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-save>' + icon('check') + 'Registrar contato</button>'
  });
  const form = $('#atvForm', m);
  $$('[data-dias]', form).forEach(b => { b.onclick = () => { $('[name=dataProximoContato]', form).value = addDays(+b.dataset.dias); }; });
  $('[data-save]', m).onclick = async () => {
    const d = formData(form);
    if (!d.descricao) { $('[name=descricao]', form).classList.add('invalid'); return toast('Descreva o contato realizado.', 'err'); }
    d.data = d.data ? d.data.replace('T', ' ') + ':00' : nowStamp();
    d.clienteId = clienteId;
    const r = await run(() => api('saveAtividade', d));
    if (!r) return;
    S.data.atividades.unshift(r.atividade);
    upsert(S.data.clientes, r.cliente);
    if (S.ficha) S.ficha.hist = null;
    closeModal(m);
    toast('Contato registrado com sucesso.');
    refreshAll();
  };
}
async function deleteAtividade(id) {
  if (!(await confirmDialog('Excluir este registro de contato?', { title: 'Excluir contato', ok: 'Excluir', danger: true }))) return;
  if (!(await run(() => api('deleteAtividade', { id })))) return;
  S.data.atividades = S.data.atividades.filter(a => a.id !== id);
  toast('Contato excluído.');
  refreshAll();
}

function produtoLabel(p) { return (p.codigo ? p.codigo + ' — ' : '') + p.produto; }
function findProdutoByLabel(v) { const n = norm(v); return S.data.produtos.find(p => norm(produtoLabel(p)) === n) || S.data.produtos.find(p => norm(p.produto) === n || p.codigo === v.trim()); }
function openProspeccaoForm(clienteId, id) {
  const p = id ? byId(S.data.prospeccoes, id) : { quantidade: 1, status: 'Em andamento' };
  const c = byId(S.data.clientes, clienteId || p.clienteId);
  const body = '<form id="prsForm" class="grid" novalidate>' +
    '<label class="field"><span class="req">Produto</span><input name="produto" list="dlPrs" value="' + esc(p.produto || '') + '" placeholder="Digite código ou nome" required>' +
    '<datalist id="dlPrs">' + S.data.produtos.filter(x => x.status !== 'Inativo').map(x => '<option value="' + esc(produtoLabel(x)) + '">' + esc(money(x.preco)) + '</option>').join('') + '</datalist><small>Escolha do catálogo ou digite um item livre.</small></label>' +
    '<div class="grid g3"><label class="field"><span>Quantidade</span><input type="number" name="quantidade" min="1" step="1" value="' + esc(p.quantidade || 1) + '"></label>' +
    '<label class="field"><span>Valor estimado (R$)</span><input name="valor" inputmode="decimal" value="' + esc(moneyInput(p.valor || 0)) + '"></label>' +
    '<label class="field"><span>Status</span><select name="status">' + options(STATUS_PROSPECCAO, p.status, null) + '</select></label></div>' +
    '<label class="field"><span>Observação</span><textarea name="observacao">' + esc(p.observacao || '') + '</textarea></label></form>';
  const m = openModal({ title: (id ? 'Editar' : 'Adicionar') + ' produto de interesse — ' + clienteNome(c), body, foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-save>' + icon('check') + 'Salvar produto</button>' });
  const form = $('#prsForm', m);
  let prodId = p.produtoId || '';
  const recalc = () => {
    const pr = findProdutoByLabel($('[name=produto]', form).value);
    prodId = pr ? pr.id : '';
    if (pr) $('[name=valor]', form).value = moneyInput(num(pr.preco) * (num($('[name=quantidade]', form).value) || 1));
  };
  $('[name=produto]', form).addEventListener('change', recalc);
  $('[name=quantidade]', form).addEventListener('input', recalc);
  $('[data-save]', m).onclick = async () => {
    const d = formData(form);
    if (!d.produto) return toast('Selecione o produto.', 'err');
    const pr = findProdutoByLabel(d.produto);
    d.produto = pr ? pr.produto : d.produto;
    d.produtoId = pr ? pr.id : prodId;
    d.valor = num(d.valor);
    d.clienteId = c.id;
    d.id = id || '';
    const r = await run(() => api('saveProspeccao', d));
    if (!r) return;
    upsert(S.data.prospeccoes, r);
    if (S.ficha) { S.ficha.hist = null; S.ficha.tab = 'produtos'; }
    closeModal(m);
    toast('Produto de interesse salvo.');
    refreshAll();
  };
}
async function deleteProspeccao(id) {
  if (!(await confirmDialog('Remover este produto de interesse?', { title: 'Remover produto', ok: 'Remover', danger: true }))) return;
  if (!(await run(() => api('deleteProspeccao', { id })))) return;
  S.data.prospeccoes = S.data.prospeccoes.filter(x => x.id !== id);
  toast('Produto removido.');
  refreshAll();
}

function fillMsg(t, c) {
  const nome = (c.contato || c.empresa || '').split(' ')[0];
  return t.replace(/\[NOME\]/g, nome).replace(/\[VENDEDOR\]/g, S.user.nome).replace(/\[EMPRESA\]/g, c.empresa || 'sua empresa')
    .replace(/\[INTERESSE\]/g, c.interesse || 'nossas soluções de segurança');
}
function openWhatsApp(clienteId, textoInicial) {
  const c = byId(S.data.clientes, clienteId);
  if (!c) return;
  const custom = JSON.parse(store.get('vg_msgs', '[]'));
  const modelos = MSG_WHATSAPP.concat(custom);
  const body = '<form id="waForm" class="grid">' +
    '<div class="grid g2"><label class="field"><span>Número</span><input name="numero" type="tel" data-mask="phone" value="' + esc(maskPhone(c.whatsapp || c.telefone)) + '"></label>' +
    '<label class="field"><span>Modelo de mensagem</span><select name="modelo">' + modelos.map((x, i) => '<option value="' + i + '">' + esc(x.nome) + '</option>').join('') + '</select></label></div>' +
    '<label class="field"><span>Mensagem</span><textarea name="texto" class="big">' + esc(textoInicial || fillMsg(modelos[0].texto, c)) + '</textarea><small>Use [NOME], [VENDEDOR], [EMPRESA] e [INTERESSE] em modelos salvos. Nada é enviado sem você tocar em “Enviar” no WhatsApp.</small></label>' +
    '<label class="check"><input type="checkbox" name="registrar" checked> Registrar esta mensagem no histórico de contatos</label>' +
    '<button type="button" class="link" data-savetpl style="justify-self:start">Salvar texto como novo modelo</button></form>';
  const m = openModal({ title: 'WhatsApp — ' + clienteNome(c), body, foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-wa" data-send>' + icon('wa') + 'Abrir WhatsApp</button>' });
  const form = $('#waForm', m);
  $('[name=modelo]', form).onchange = e => { $('[name=texto]', form).value = fillMsg(modelos[+e.target.value].texto, c); };
  $('[data-savetpl]', form).onclick = () => {
    const nome = prompt('Nome do modelo:');
    if (!nome) return;
    const nomeC = (c.contato || c.empresa || '').split(' ')[0];
    let t = $('[name=texto]', form).value;
    if (nomeC) t = t.split(nomeC).join('[NOME]');
    t = t.split(S.user.nome).join('[VENDEDOR]');
    custom.push({ nome, texto: t });
    store.set('vg_msgs', JSON.stringify(custom));
    toast('Modelo salvo neste aparelho.');
  };
  $('[data-send]', m).onclick = () => {
    const d = formData(form);
    const link = waLink(d.numero, d.texto);
    if (!link) return toast('Informe o número do WhatsApp.', 'err');
    window.open(link, '_blank', 'noopener');
    closeModal(m);
    if (d.registrar) {
      run(() => api('saveAtividade', {
        clienteId: c.id, tipo: 'WhatsApp', data: nowStamp(), descricao: 'Mensagem via WhatsApp: ' + d.texto.slice(0, 900),
        dataProximoContato: c.dataProximoContato, proximoContato: c.proximoContato, novoStatus: c.status === 'Novo lead' ? 'Primeiro contato' : ''
      }, { silent: true })).then(r => { if (r) { S.data.atividades.unshift(r.atividade); upsert(S.data.clientes, r.cliente); refreshAll(); } });
    }
  };
}

/* ===== 9.4 Prospecções (funil + produtos em prospecção) ===== */
VIEWS.prospeccoes = () => {
  const tab = S.prsTab || 'funil';
  const clientes = scoped(S.data.clientes);
  const itens = scoped(S.data.prospeccoes);
  let body;
  if (tab === 'funil') {
    body = '<div class="board">' + STATUS.map(st => {
      const l = clientes.filter(c => c.status === st).sort((a, b) => b.dataAtualizacao.localeCompare(a.dataAtualizacao));
      return '<div class="col" data-status="' + esc(st) + '"><div class="col-head">' + chip(st) + '<span class="muted">' + l.length + '</span></div><div class="col-body">' +
        l.slice(0, 80).map(c => '<div class="card-mini" draggable="true" data-id="' + esc(c.id) + '" data-act="open-cliente">' +
          '<strong>' + esc(clienteNome(c)) + '</strong><small>' + esc([c.contato && c.empresa ? c.contato : '', c.cidade].filter(Boolean).join(' • ')) + '</small>' +
          (isAdmin() ? '<small>' + esc(c.vendedor) + '</small>' : '') +
          '<div class="card-foot"><small class="' + (c.dataProximoContato && c.dataProximoContato.slice(0, 10) < today() ? 'late' : '') + '">' + (c.dataProximoContato ? relDay(c.dataProximoContato) : 'Sem data') + '</small>' +
          '<select class="status-select" data-status-cliente data-id="' + esc(c.id) + '" aria-label="Mover para">' + options(STATUS, st, null) + '</select></div></div>').join('') +
        (l.length > 80 ? '<small class="muted">+' + (l.length - 80) + ' clientes — use a tela Clientes</small>' : '') + '</div></div>';
    }).join('') + '</div>';
  } else {
    const f = S.prsFiltro || '';
    const l = itens.filter(p => !f || p.status === f).sort((a, b) => b.data.localeCompare(a.data));
    const total = l.reduce((s, p) => s + num(p.valor), 0);
    body = '<div class="toolbar"><select id="prsFiltro" aria-label="Status">' + options(STATUS_PROSPECCAO, f, 'Todos os status') + '</select><span class="muted">' + l.length + ' item(ns) • ' + money(total) + '</span></div>' +
      (l.length ? '<div class="table-wrap"><table class="tbl responsive"><thead><tr><th>Cliente</th><th>Produto</th><th>Qtd.</th><th class="right">Valor</th><th>Status</th>' + (isAdmin() ? '<th>Vendedor</th>' : '') + '<th>Data</th></tr></thead><tbody>' +
        l.map(p => '<tr class="clickable" data-act="open-cliente" data-id="' + esc(p.clienteId) + '"><td class="cell-main"><strong>' + esc(p.cliente) + '</strong><small>' + esc(p.observacao) + '</small></td><td data-label="Produto">' + esc(p.produto) + '</td><td data-label="Qtd.">' + esc(p.quantidade) + '</td><td data-label="Valor" class="right num">' + money(p.valor) + '</td><td data-label="Status">' + chip(p.status) + '</td>' + (isAdmin() ? '<td data-label="Vendedor">' + esc(p.vendedor) + '</td>' : '') + '<td data-label="Data">' + fmtDate(p.data) + '</td></tr>').join('') +
        '</tbody></table></div>' : emptyState('Nenhum produto em prospecção', 'Abra a ficha de um cliente e use “Adicionar produto”.'));
  }
  return pageHead('Prospecções', scopeLabel() + ' • arraste os cartões entre as colunas para mudar o status', '<button class="btn btn-primary" data-act="new-cliente">' + icon('plus') + 'Novo cliente</button>') +
    '<section class="panel"><div class="tabs"><button class="' + (tab === 'funil' ? 'active' : '') + '" data-act="prs-tab" data-tab="funil">' + icon('kanban') + ' Funil de vendas</button>' +
    '<button class="' + (tab === 'itens' ? 'active' : '') + '" data-act="prs-tab" data-tab="itens">' + icon('box') + ' Produtos em prospecção<span class="count">' + itens.length + '</span></button></div>' + body + '</section>';
};
VIEWS.prospeccoes.after = () => {
  const f = $('#prsFiltro');
  if (f) f.onchange = () => { S.prsFiltro = f.value; render(); };
  $$('.card-mini[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  });
  $$('.col[data-status]').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave', () => col.classList.remove('drop'));
    col.addEventListener('drop', e => {
      e.preventDefault(); col.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const c = byId(S.data.clientes, id);
      if (c && c.status !== col.dataset.status) changeStatus(id, col.dataset.status);
    });
  });
};

/* ===== 9.5 Contatos — Meus contatos de hoje + linha do tempo ===== */
function agendaItem(c, late) {
  const fone = c.whatsapp || c.telefone;
  return '<article class="agenda-item ' + (late ? 'is-late' : '') + '"><header><strong data-act="open-cliente" data-id="' + esc(c.id) + '">' + esc(clienteNome(c)) + '</strong>' +
    '<span class="when">' + (late ? icon('alert') + ' ' : '') + relDay(c.dataProximoContato) + '</span></header>' +
    '<p>' + esc(c.proximoContato || 'Sem descrição do próximo passo.') + '</p>' +
    '<div class="stat-line" style="margin-bottom:10px">' + chip(c.status) + (c.contato ? '<span class="tag">' + esc(c.contato) + '</span>' : '') + (isAdmin() ? '<span class="tag">' + esc(c.vendedor) + '</span>' : '') + '</div>' +
    '<div class="actions"><button class="btn btn-primary btn-sm" data-act="new-atividade" data-id="' + esc(c.id) + '">' + icon('history') + 'Registrar contato</button>' +
    (fone ? '<button class="btn btn-sm btn-wa" data-act="whatsapp" data-id="' + esc(c.id) + '">' + icon('wa') + 'WhatsApp</button><a class="btn btn-sm" href="tel:' + esc(digits(c.telefone || c.whatsapp)) + '">' + icon('phone') + 'Ligar</a>' : '') +
    '</div></article>';
}
VIEWS.contatos = () => {
  const ag = agenda();
  const col = (t, l, late, ic) => '<div class="agenda-col"><h3>' + icon(ic) + t + '<span class="count">' + l.length + '</span></h3><div class="agenda-list">' +
    (l.length ? l.map(c => agendaItem(c, late)).join('') : '<div class="panel empty" style="padding:24px">Nada por aqui.</div>') + '</div></div>';
  const f = S.atvFiltro = Object.assign({ q: '', tipo: '', dias: '30' }, S.atvFiltro || {});
  return pageHead('Meus contatos de hoje', scopeLabel()) +
    '<div class="agenda">' + col('Atrasados', ag.atrasados, true, 'alert') + col('Hoje', ag.hoje, false, 'calendar') + col('Amanhã', ag.amanha, false, 'clock') + '</div>' +
    '<section class="panel" style="margin-top:24px"><div class="panel-head"><h2>Histórico de contatos</h2></div><div class="toolbar" id="atvFiltros">' +
    '<input type="search" name="q" placeholder="Buscar cliente ou descrição" value="' + esc(f.q) + '">' +
    '<select name="tipo">' + options(TIPOS_CONTATO.map(t => t.t), f.tipo, 'Todos os tipos') + '</select>' +
    '<select name="dias">' + options([{ v: '7', l: 'Últimos 7 dias' }, { v: '30', l: 'Últimos 30 dias' }, { v: '90', l: 'Últimos 90 dias' }, { v: '0', l: 'Todo o período' }], f.dias, null) + '</select>' +
    '</div><div class="panel-body" id="atvLista"></div></section>';
};
VIEWS.contatos.after = () => {
  const draw = () => {
    const f = S.atvFiltro, q = norm(f.q), lim = +f.dias ? addDays(-f.dias) : '';
    const l = scoped(S.data.atividades).filter(a => (!f.tipo || a.tipo === f.tipo) && (!lim || a.data.slice(0, 10) >= lim) && (!q || norm(a.cliente + ' ' + a.descricao).includes(q)))
      .sort((a, b) => b.data.localeCompare(a.data)).slice(0, 200);
    $('#atvLista').innerHTML = timelineHtml(l, true);
  };
  const box = $('#atvFiltros');
  const upd = () => { Object.assign(S.atvFiltro, formDataFrom(box)); draw(); };
  box.addEventListener('input', debounce(upd, 180));
  box.addEventListener('change', upd);
  draw();
};

/* ===== 9.6 Catálogo de produtos ===== */
VIEWS.produtos = () => {
  const f = S.prodFiltro = Object.assign({ q: '', categoria: '', tipo: '', status: '' }, S.prodFiltro || {});
  const cats = [...new Set(S.data.produtos.map(p => p.categoria).filter(Boolean))].sort();
  return pageHead('Catálogo de produtos', S.data.produtos.length + ' item(ns) cadastrados',
    '<button class="btn" data-act="go" data-view="importar">' + icon('upload') + 'Importar CSV</button>' +
    '<button class="btn" data-act="export-produtos">' + icon('download') + 'Exportar produtos CSV</button>' +
    '<button class="btn btn-primary" data-act="new-produto">' + icon('plus') + 'Novo produto</button>') +
    '<section class="panel"><div class="toolbar" id="prodFiltros"><input type="search" name="q" placeholder="Pesquisar por nome, código ou categoria" value="' + esc(f.q) + '">' +
    '<select name="categoria">' + options(cats, f.categoria, 'Todas as categorias') + '</select>' +
    '<select name="tipo">' + options(['Produto', 'Serviço'], f.tipo, 'Produtos e serviços') + '</select>' +
    '<select name="status">' + options(['Ativo', 'Inativo'], f.status, 'Qualquer status') + '</select></div><div id="prodLista"></div></section>' +
    '<button class="fab" data-act="new-produto" aria-label="Novo produto">' + icon('plus') + '</button>';
};
VIEWS.produtos.after = () => {
  S.prodLimite = 100;
  const box = $('#prodFiltros');
  const upd = () => { Object.assign(S.prodFiltro, formDataFrom(box)); S.prodLimite = 100; drawProdutos(); };
  box.addEventListener('input', debounce(upd, 180));
  box.addEventListener('change', upd);
  drawProdutos();
};
function drawProdutos() {
  const f = S.prodFiltro, q = norm(f.q);
  const l = S.data.produtos.filter(p => (!f.categoria || p.categoria === f.categoria) && (!f.tipo || p.tipo === f.tipo) && (!f.status || p.status === f.status) &&
    (!q || norm(p.codigo + ' ' + p.produto + ' ' + p.categoria + ' ' + p.descricao).includes(q)))
    .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
  $('#prodLista').innerHTML = l.length
    ? '<div class="table-wrap"><table class="tbl responsive"><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Tipo</th><th>Unid.</th><th class="right">Preço</th><th>Status</th><th></th></tr></thead><tbody>' +
    l.slice(0, S.prodLimite).map(p => '<tr><td data-label="Código" class="num">' + esc(p.codigo) + '</td><td class="cell-main"><strong>' + esc(p.produto) + '</strong><small>' + esc(p.descricao) + '</small></td>' +
      '<td data-label="Categoria">' + esc(p.categoria) + '</td><td data-label="Tipo">' + esc(p.tipo) + '</td><td data-label="Unidade">' + esc(p.unidade) + '</td><td data-label="Preço" class="right num nowrap">' + money(p.preco) + '</td>' +
      '<td data-label="Status"><span class="chip" style="--c:' + (p.status === 'Inativo' ? '#6b7280' : '#22b35e') + '">' + esc(p.status) + '</span></td>' +
      '<td class="row-actions-cell no-label"><div class="row-actions"><button class="btn-icon" data-act="edit-produto" data-id="' + esc(p.id) + '" aria-label="Editar">' + icon('edit') + '</button><button class="btn-icon" data-act="delete-produto" data-id="' + esc(p.id) + '" aria-label="Excluir">' + icon('trash') + '</button></div></td></tr>').join('') +
    '</tbody></table></div><div class="more"><span class="muted">' + Math.min(l.length, S.prodLimite) + ' de ' + l.length + '</span>' + (l.length > S.prodLimite ? '&nbsp;&nbsp;<button class="btn btn-sm" data-act="prod-more">Mostrar mais</button>' : '') + '</div>'
    : emptyState(S.data.produtos.length ? 'Nenhum produto encontrado' : 'Catálogo vazio', S.data.produtos.length ? 'Ajuste a pesquisa ou os filtros.' : 'Cadastre produtos um a um ou importe uma planilha CSV.',
      '<button class="btn" data-act="go" data-view="importar">Importar CSV</button> <button class="btn btn-primary" data-act="new-produto">Novo produto</button>');
}
function openProdutoForm(id) {
  const p = id ? byId(S.data.produtos, id) : { tipo: 'Produto', unidade: 'UN', status: 'Ativo', preco: 0 };
  const cats = [...new Set(S.data.produtos.map(x => x.categoria).filter(Boolean))].sort();
  const body = '<form id="prodForm" class="grid g2" novalidate>' +
    '<label class="field"><span>Código</span><input name="codigo" value="' + esc(p.codigo || '') + '" placeholder="Automático se vazio"></label>' +
    '<label class="field"><span>Tipo</span><select name="tipo">' + options(['Produto', 'Serviço'], p.tipo, null) + '</select></label>' +
    '<label class="field span2"><span class="req">Nome do produto</span><input name="produto" value="' + esc(p.produto || '') + '" required></label>' +
    '<label class="field"><span>Categoria</span><input name="categoria" list="dlCat" value="' + esc(p.categoria || '') + '"><datalist id="dlCat">' + cats.map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label>' +
    '<label class="field"><span>Unidade</span><input name="unidade" list="dlUn" value="' + esc(p.unidade || '') + '"><datalist id="dlUn">' + ['UN', 'M', 'CX', 'PC', 'KIT', 'RL', 'SV', 'MÊS', 'H'].map(u => '<option value="' + u + '">').join('') + '</datalist></label>' +
    '<label class="field"><span>Preço (R$)</span><input name="preco" inputmode="decimal" value="' + esc(moneyInput(p.preco)) + '"></label>' +
    '<label class="field"><span>Status</span><select name="status">' + options(['Ativo', 'Inativo'], p.status, null) + '</select></label>' +
    '<label class="field span2"><span>Descrição</span><textarea name="descricao">' + esc(p.descricao || '') + '</textarea></label></form>';
  const m = openModal({ title: id ? 'Editar produto' : 'Novo produto', body, foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-save>' + icon('check') + 'Salvar produto</button>' });
  $('[data-save]', m).onclick = async () => {
    const d = formData($('#prodForm', m));
    if (!d.produto) return toast('Informe o nome do produto.', 'err');
    d.preco = num(d.preco);
    d.id = id || '';
    const r = await run(() => api('saveProduto', d));
    if (!r) return;
    upsert(S.data.produtos, r);
    closeModal(m);
    toast(id ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
    refreshAll();
  };
}
async function deleteProduto(id) {
  const p = byId(S.data.produtos, id);
  if (!(await confirmDialog('Excluir o produto "' + p.produto + '" do catálogo? Propostas já emitidas não são alteradas.', { title: 'Excluir produto', ok: 'Excluir', danger: true }))) return;
  if (!(await run(() => api('deleteProduto', { id })))) return;
  S.data.produtos = S.data.produtos.filter(x => x.id !== id);
  toast('Produto excluído.');
  refreshAll();
}
async function exportProdutos() {
  const r = await run(() => api('exportProdutos'));
  if (!r) return;
  downloadFile(r.nome, '\ufeff' + r.csv);
  toast('Arquivo de produtos exportado.');
}

/* ===== 9.7 Importação de produtos por CSV ===== */
const CAMPOS_IMPORT = [
  { k: 'codigo', l: 'Código', alias: ['codigo', 'cod', 'cod.', 'sku', 'ref', 'referencia', 'codigo do produto'] },
  { k: 'produto', l: 'Nome do produto', req: true, alias: ['produto', 'nome', 'nome do produto', 'item', 'descricao do produto', 'mercadoria'] },
  { k: 'categoria', l: 'Categoria', alias: ['categoria', 'grupo', 'familia', 'linha', 'departamento'] },
  { k: 'tipo', l: 'Tipo', alias: ['tipo', 'tipo de item'] },
  { k: 'descricao', l: 'Descrição', alias: ['descricao', 'detalhes', 'observacao', 'obs', 'descricao detalhada'] },
  { k: 'unidade', l: 'Unidade', alias: ['unidade', 'un', 'und', 'unid', 'medida', 'unidade de medida'] },
  { k: 'preco', l: 'Preço', alias: ['preco', 'valor', 'preco venda', 'preco de venda', 'valor unitario', 'preco unitario', 'vlr', 'valor venda'] },
  { k: 'status', l: 'Status', alias: ['status', 'situacao', 'ativo'] }
];
/** Lê CSV respeitando aspas, quebras de linha em campos e o separador informado. */
function parseCSV(text, delim) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}
function detectDelim(text) {
  const first = text.split(/\r?\n/).slice(0, 5).join('\n');
  const count = d => (first.match(new RegExp('\\' + d, 'g')) || []).length;
  return [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];
}
function decodeFile(buf) {
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\ufeff/, ''), enc: 'UTF-8' }; }
  catch (e) { return { text: new TextDecoder('windows-1252').decode(buf), enc: 'ANSI (Windows-1252)' }; }
}
VIEWS.importar = () => {
  const I = S.imp;
  let body = '<section class="panel"><div class="panel-body"><label class="dropzone" id="dropzone"><input type="file" id="csvFile" accept=".csv,text/csv" hidden>' +
    '<span class="big-ico">' + icon('upload') + '</span><strong>Selecione ou arraste o arquivo .CSV</strong><span class="muted">Separado por vírgula ou ponto e vírgula • UTF-8 ou ANSI (acentos preservados)</span></label>' +
    '<div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-sm" data-act="csv-modelo">' + icon('download') + 'Baixar modelo de CSV</button><button class="btn btn-sm" data-act="export-produtos">' + icon('download') + 'Exportar produtos CSV</button></div></div></section>';
  if (I && I.rows) {
    const itens = importItens();
    const ok = itens.filter(x => !x._erro), bad = itens.filter(x => x._erro);
    const existentes = new Set(S.data.produtos.map(p => p.codigo));
    const dup = ok.filter(x => x.codigo && existentes.has(x.codigo)).length;
    body += '<section class="panel"><div class="panel-head"><h2>' + esc(I.nome) + '</h2><div class="stat-line"><span class="tag">' + I.enc + '</span><span class="tag">Separador "' + (I.delim === '\t' ? 'TAB' : I.delim) + '"</span><span class="tag">' + I.rows.length + ' linha(s)</span></div></div>' +
      '<div class="panel-body"><h3 style="font-size:15px;margin-bottom:12px">Colunas identificadas</h3><div class="map-grid" id="csvMap">' +
      CAMPOS_IMPORT.map(c => '<label class="field"><span' + (c.req ? ' class="req"' : '') + '>' + c.l + '</span><select data-map="' + c.k + '">' + options(I.headers.map((h, i) => ({ v: i, l: h || 'Coluna ' + (i + 1) })), I.map[c.k] ?? '', '— não importar —') + '</select></label>').join('') +
      '</div><div class="grid g2" style="margin-top:16px"><label class="check"><input type="checkbox" id="csvUpdate"' + (I.atualizar ? ' checked' : '') + '> Atualizar produtos já cadastrados com o mesmo código (' + dup + ' encontrados)</label>' +
      '<label class="field"><span>Tipo padrão (quando a coluna estiver vazia)</span><select id="csvTipo">' + options(['Produto', 'Serviço'], I.tipoPadrao, null) + '</select></label></div></div>' +
      '<div class="toolbar"><div class="stat-line"><span class="chip" style="--c:#22b35e">' + ok.length + ' prontos</span>' + (bad.length ? '<span class="chip" style="--c:#e0232c">' + bad.length + ' com erro</span>' : '') + '</div>' +
      '<div style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="csv-cancel">Cancelar</button><button class="btn btn-primary" data-act="csv-import"' + (ok.length ? '' : ' disabled') + '>' + icon('check') + 'Confirmar importação</button></div></div>' +
      '<div class="table-wrap" style="max-height:460px"><table class="tbl responsive"><thead><tr><th>Linha</th><th>Código</th><th>Produto</th><th>Categoria</th><th>Tipo</th><th>Unid.</th><th class="right">Preço</th><th>Situação</th></tr></thead><tbody>' +
      itens.slice(0, 200).map(x => '<tr class="' + (x._erro ? 'row-err' : '') + '"><td data-label="Linha">' + x._linha + '</td><td data-label="Código">' + esc(x.codigo) + '</td><td class="cell-main"><strong>' + esc(x.produto || '—') + '</strong><small>' + esc(x.descricao) + '</small></td><td data-label="Categoria">' + esc(x.categoria) + '</td><td data-label="Tipo">' + esc(x.tipo) + '</td><td data-label="Unid.">' + esc(x.unidade) + '</td><td data-label="Preço" class="right num">' + money(x.preco) + '</td><td data-label="Situação">' + (x._erro ? '<span class="late">' + esc(x._erro) + '</span>' : existentes.has(x.codigo) ? 'Já existe' : 'Novo') + '</td></tr>').join('') +
      '</tbody></table></div>' + (itens.length > 200 ? '<div class="more muted">Prévia das primeiras 200 linhas de ' + itens.length + '.</div>' : '') + '</section>';
  }
  if (S.impResult) {
    const r = S.impResult;
    body += '<section class="panel"><div class="panel-head"><h2>Resultado da importação</h2></div><div class="panel-body"><div class="stat-line">' +
      '<span class="chip" style="--c:#22b35e">' + r.importados + ' importado(s)</span><span class="chip" style="--c:#06a3c4">' + r.atualizados + ' atualizado(s)</span><span class="chip" style="--c:#9aa3ad">' + r.ignorados + ' ignorado(s)</span><span class="chip" style="--c:#e0232c">' + r.erros.length + ' erro(s)</span></div>' +
      (r.erros.length ? '<ul class="errlist">' + r.erros.slice(0, 200).map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>' : '') +
      '<div style="margin-top:14px"><button class="btn" data-act="go" data-view="produtos">Ver catálogo</button></div></div></section>';
  }
  return pageHead('Importar produtos', 'Traga o catálogo de uma planilha em CSV. Você confere a prévia antes de salvar.') + body;
};
VIEWS.importar.after = () => {
  const input = $('#csvFile'), dz = $('#dropzone');
  input.onchange = () => input.files[0] && readCSVFile(input.files[0]);
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readCSVFile(f); });
  const map = $('#csvMap');
  if (map) map.addEventListener('change', e => { const s = e.target.closest('[data-map]'); if (s) { S.imp.map[s.dataset.map] = s.value === '' ? undefined : +s.value; render(); } });
  const up = $('#csvUpdate'); if (up) up.onchange = () => { S.imp.atualizar = up.checked; };
  const tp = $('#csvTipo'); if (tp) tp.onchange = () => { S.imp.tipoPadrao = tp.value; render(); };
};
async function readCSVFile(file) {
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return toast('Selecione um arquivo .CSV.', 'err');
  if (file.size > 8 * 1024 * 1024) return toast('Arquivo muito grande (máximo 8 MB).', 'err');
  const { text, enc } = decodeFile(await file.arrayBuffer());
  const delim = detectDelim(text);
  const rows = parseCSV(text, delim);
  if (rows.length < 2) return toast('O arquivo não tem linhas de produtos.', 'err');
  const headers = rows[0].map(h => h.trim());
  const map = {};
  CAMPOS_IMPORT.forEach(c => {
    const i = headers.findIndex(h => c.alias.includes(norm(h).replace(/[_]+/g, ' ')));
    if (i >= 0 && !Object.values(map).includes(i)) map[c.k] = i;
  });
  if (map.produto === undefined && map.descricao !== undefined) { map.produto = map.descricao; delete map.descricao; }
  S.imp = { nome: file.name, enc, delim, headers, rows: rows.slice(1), map, atualizar: true, tipoPadrao: 'Produto' };
  S.impResult = null;
  render();
  toast(rows.length - 1 + ' linha(s) lidas. Confira a prévia.');
}
function importItens() {
  const I = S.imp;
  return I.rows.map((r, idx) => {
    const g = k => I.map[k] === undefined ? '' : String(r[I.map[k]] == null ? '' : r[I.map[k]]).trim();
    const st = norm(g('status'));
    const tp = norm(g('tipo'));
    const x = {
      _linha: idx + 2, codigo: g('codigo'), produto: g('produto'), categoria: g('categoria'),
      tipo: tp ? (tp.startsWith('serv') ? 'Serviço' : 'Produto') : I.tipoPadrao,
      descricao: g('descricao'), unidade: g('unidade') || 'UN', preco: round2(num(g('preco'))),
      status: ['inativo', 'nao', 'n', '0', 'false', 'desativado'].includes(st) ? 'Inativo' : 'Ativo'
    };
    if (!x.produto) x._erro = 'Sem nome do produto';
    else if (g('preco') && !/\d/.test(g('preco'))) x._erro = 'Preço inválido';
    return x;
  });
}
async function confirmImport() {
  const itens = importItens().filter(x => !x._erro);
  if (!itens.length) return;
  if (!(await confirmDialog('Importar ' + itens.length + ' produto(s) para o catálogo?', { title: 'Confirmar importação', ok: 'Importar' }))) return;
  const total = { importados: 0, atualizados: 0, ignorados: 0, erros: importItens().filter(x => x._erro).map(x => 'Linha ' + x._linha + ': ' + x._erro) };
  const lote = 400;
  for (let i = 0; i < itens.length; i += lote) {
    toast('Enviando ' + Math.min(i + lote, itens.length) + ' de ' + itens.length + '…', 'warn', 2000);
    const r = await run(() => api('importProdutos', { produtos: itens.slice(i, i + lote), atualizarExistentes: S.imp.atualizar }));
    if (!r) { total.erros.push('Falha ao enviar o lote a partir da linha ' + itens[i]._linha + '.'); break; }
    total.importados += r.importados; total.atualizados += r.atualizados; total.ignorados += r.ignorados;
    total.erros = total.erros.concat(r.erros);
    S.data.produtos = r.produtos;
  }
  S.imp = null;
  S.impResult = total;
  render();
  toast(total.importados + total.atualizados ? 'Produto importado com sucesso. ' + total.importados + ' novo(s), ' + total.atualizados + ' atualizado(s).' : 'Nenhum produto foi importado.', total.erros.length ? 'warn' : 'ok', 6000);
}
function csvModelo() {
  downloadFile('modelo_produtos_vegas.csv', toCSV(['Código', 'Produto', 'Categoria', 'Tipo', 'Descrição', 'Unidade', 'Preço', 'Status'], [
    ['001064', 'CAMERA WI FI TP C500 EXTERNA', 'Câmeras', 'Produto', 'Câmera Wi-Fi externa com visão noturna', 'UN', '289,90', 'Ativo'],
    ['000476', 'CARTÃO DE MEMORIA 32GB', 'Acessórios', 'Produto', '', 'UN', '49,90', 'Ativo'],
    ['000006', 'INSTALAÇÃO DE CAMERAS', 'Serviços', 'Serviço', 'Instalação por ponto', 'SV', '120,00', 'Ativo']
  ]));
}

/* ===== 9.8 Propostas / orçamentos ===== */
const parseJSON = (v, d) => { try { return JSON.parse(v); } catch (e) { return d; } };
function propostasTable(l, compact = false) {
  return '<div class="table-wrap"><table class="tbl responsive"><thead><tr><th>Nº</th>' + (compact ? '' : '<th>Cliente</th>') + '<th>Emissão</th><th>Válido até</th><th>Tipo</th><th class="right">Valor final</th><th>Status</th>' + (isAdmin() && !compact ? '<th>Vendedor</th>' : '') + '<th class="right">Ações</th></tr></thead><tbody>' +
    l.map(p => '<tr><td class="cell-main"><strong>Nº ' + esc(p.numero) + '</strong>' + (compact ? '' : '<small>' + esc(p.cliente) + '</small>') + '</td>' +
      (compact ? '' : '<td data-label="Cliente">' + esc(p.cliente) + '</td>') +
      '<td data-label="Emissão">' + fmtDate(p.dataEmissao) + '</td><td data-label="Válido até" class="' + (p.validade && p.validade.slice(0, 10) < today() && p.status === 'Enviada' ? 'late' : '') + '">' + fmtDate(p.validade) + '</td>' +
      '<td data-label="Tipo">' + (normTipo(p.tipoOrcamento) === 'Locado' ? '<span class="tag">Locação</span>' : '<span class="tag">Venda</span>') + '</td><td data-label="Valor final" class="right num nowrap"><strong>' + money(p.valorFinal) + '</strong>' + (p.incluirMensal === 'Sim' ? '<br><small class="muted">+ ' + money(p.totalMensal) + '/mês</small>' : '') + '</td>' +
      '<td data-label="Status"><select class="status-select" data-status-proposta data-id="' + esc(p.id) + '" style="--c:' + propCor(p.status) + '">' + options(STATUS_PROPOSTA, p.status, null) + '</select></td>' +
      (isAdmin() && !compact ? '<td data-label="Vendedor">' + esc(p.vendedor) + '</td>' : '') +
      '<td class="row-actions-cell no-label"><div class="row-actions">' +
      '<button class="btn-icon" data-act="pdf-proposta" data-id="' + esc(p.id) + '" title="Gerar PDF" aria-label="Gerar PDF">' + icon('file') + '</button>' +
      '<button class="btn-icon" data-act="edit-proposta" data-id="' + esc(p.id) + '" title="Editar" aria-label="Editar">' + icon('edit') + '</button>' +
      (isAdmin() ? '<button class="btn-icon" data-act="contrato-proposta" data-id="' + esc(p.id) + '" title="Gerar contrato" aria-label="Gerar contrato">' + icon('contract') + '</button>' : '') +
      '<button class="btn-icon" data-act="dup-proposta" data-id="' + esc(p.id) + '" title="Duplicar" aria-label="Duplicar">' + icon('copy') + '</button>' +
      '<button class="btn-icon" data-act="delete-proposta" data-id="' + esc(p.id) + '" title="Excluir" aria-label="Excluir">' + icon('trash') + '</button></div></td></tr>').join('') +
    '</tbody></table></div>';
}
VIEWS.propostas = param => {
  if (param) return propostaEditorHtml(param);
  const f = S.propFiltro = Object.assign({ q: '', status: '' }, S.propFiltro || {});
  const q = norm(f.q);
  const l = scoped(S.data.propostas).filter(p => (!f.status || p.status === f.status) && (!q || norm(p.numero + ' ' + p.cliente + ' ' + p.vendedor).includes(q)))
    .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));
  const total = l.reduce((s, p) => s + num(p.valorFinal), 0);
  return pageHead('Propostas', scopeLabel() + ' • ' + l.length + ' proposta(s) • ' + money(total), '<button class="btn btn-primary" data-act="proposta-cliente" data-id="">' + icon('plus') + 'Nova proposta</button>') +
    '<section class="panel"><div class="toolbar" id="propFiltros"><input type="search" name="q" placeholder="Número, cliente ou vendedor" value="' + esc(f.q) + '"><select name="status">' + options(STATUS_PROPOSTA, f.status, 'Todos os status') + '</select></div>' +
    (l.length ? propostasTable(l.slice(0, 300)) : emptyState('Nenhuma proposta', 'Crie uma proposta, adicione os produtos e gere o PDF no padrão Vegas.', '<button class="btn btn-primary" data-act="proposta-cliente" data-id="">Nova proposta</button>')) + '</section>' +
    '<button class="fab" data-act="proposta-cliente" data-id="" aria-label="Nova proposta">' + icon('plus') + '</button>';
};
VIEWS.propostas.after = param => {
  if (param) return propostaEditorBind();
  const box = $('#propFiltros');
  box.addEventListener('change', () => { Object.assign(S.propFiltro, formDataFrom(box)); render(); });
  box.addEventListener('input', debounce(() => { Object.assign(S.propFiltro, formDataFrom(box)); render(); setTimeout(() => { const i = $('#propFiltros input'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 500));
};

/** Monta o estado do editor a partir da rota: nova[/clienteId], editar/ID, duplicar/ID */
function initPropostaState(param) {
  const [modo, idRaw, tipoRota] = param.split('/');
  const id = idRaw === '-' ? '' : idRaw;
  const cfg = S.data.config || {};
  const base = {
    id: '', clienteId: '', tipoOrcamento: 'Venda', validade: addDays(+cfg.validade_dias || 7), status: 'Enviada', itens: [],
    desconto: 0, descontoTipo: 'R$', incluirMensal: false, valorMensal: 0, outrosMensal: 0, condicoes: [], obsCliente: '', atualizarStatusCliente: true
  };
  if ((modo === 'editar' || modo === 'duplicar') && id) {
    const p = byId(S.data.propostas, id);
    if (p) {
      Object.assign(base, {
        id: modo === 'editar' ? p.id : '', numero: modo === 'editar' ? p.numero : '', clienteId: p.clienteId, tipoOrcamento: normTipo(p.tipoOrcamento),
        validade: modo === 'editar' ? String(p.validade).slice(0, 10) : base.validade, status: modo === 'editar' ? p.status : 'Enviada',
        itens: parseJSON(p.itens, []), desconto: num(p.desconto), descontoTipo: 'R$', incluirMensal: p.incluirMensal === 'Sim',
        valorMensal: num(p.valorMensal), outrosMensal: num(p.outrosMensal), condicoes: parseJSON(p.condicoes, []), obsCliente: p.obsCliente,
        atualizarStatusCliente: modo !== 'editar'
      });
    }
  } else if (modo === 'nova') {
    base.tipoOrcamento = normTipo(tipoRota);
    if (base.tipoOrcamento === 'Locado') base.incluirMensal = true;
    const c = id ? byId(S.data.clientes, id) : null;
    if (c) {
      base.clienteId = c.id;
      base.obsCliente = c.obsCliente || '';
      // Traz os produtos de interesse do cliente para a proposta
      S.data.prospeccoes.filter(p => p.clienteId === c.id && p.status !== 'Perdida').forEach(p => {
        const pr = byId(S.data.produtos, p.produtoId);
        const qtd = num(p.quantidade) || 1;
        base.itens.push({ produtoId: p.produtoId, codigo: pr ? pr.codigo : '', descricao: p.produto, tipo: pr ? pr.tipo : 'Produto', unidade: pr ? pr.unidade : 'UN', quantidade: qtd, valorUnitario: pr ? num(pr.preco) : round2(num(p.valor) / qtd), desconto: 0, locado: base.tipoOrcamento === 'Locado' });
      });
    }
  }
  S.prop = base;
}
const clienteLabel = c => '#' + c.codigo + ' — ' + clienteNome(c) + (c.cidade ? ' (' + c.cidade + ')' : '');
/** Pergunta se o orçamento do cliente é de venda ou de locação (comodato). */
function escolherTipoOrcamento(clienteId) {
  const c = byId(S.data.clientes, clienteId);
  const opt = (tipo, ic, titulo, texto) => '<button class="tipo-orc" data-act="tipo-orc" data-tipo="' + tipo + '" data-id="' + esc(clienteId || '') + '">' +
    '<span class="tipo-orc-ico">' + icon(ic) + '</span><span><strong>' + titulo + '</strong><small>' + texto + '</small></span></button>';
  openModal({
    title: 'Novo orçamento' + (c ? ' — ' + clienteNome(c) : ''), size: 'sm',
    body: '<p style="margin-top:0" class="muted">Que tipo de orçamento você vai fazer?</p><div class="tipo-orc-grid">' +
      opt('Venda', 'money', 'Venda', 'O cliente compra os equipamentos. Os valores dos produtos e serviços aparecem no orçamento.') +
      opt('Locado', 'sync', 'Locação (comodato)', 'Os equipamentos saem como “Locado”, sem valor. Você informa o aluguel mensal que o cliente vai pagar.') +
      '</div>'
  });
}
function propostaEditorHtml(param) {
  initPropostaState(param);
  const P = S.prop;
  const c = byId(S.data.clientes, P.clienteId);
  return pageHead(P.id ? 'Editar proposta Nº ' + P.numero : 'Nova proposta', 'Monte o orçamento, confira os valores e gere o PDF no padrão Vegas.',
    '<button class="btn" data-act="go" data-view="propostas">Voltar</button>') +
    '<div class="prop-layout"><div>' +
    '<section class="panel"><div class="panel-head"><h2>Cliente e proposta</h2></div><div class="panel-body grid g4">' +
    '<label class="field span2"><span class="req">Cliente</span><input id="pCliente" list="dlCli" value="' + esc(c ? clienteLabel(c) : '') + '" placeholder="Digite o nome ou código do cliente"><datalist id="dlCli">' +
    scoped(S.data.clientes).map(x => '<option value="' + esc(clienteLabel(x)) + '">').join('') + '</datalist><small id="pCliInfo">' + (c ? esc([c.contato, maskPhone(c.whatsapp || c.telefone), c.email].filter(Boolean).join(' • ')) : 'Cliente ainda não cadastrado? Use o botão ao lado.') + '</small></label>' +
    '<label class="field span2"><span>Válido até</span><input type="date" id="pValidade" value="' + esc(P.validade) + '"></label>' +
    '<div class="field span-all"><span class="field-label">Tipo do orçamento</span><div class="segmented seg-lg" id="pTipo">' +
    TIPOS_ORCAMENTO.map(t => '<label><input type="radio" name="pTipo" value="' + t.v + '"' + (P.tipoOrcamento === t.v ? ' checked' : '') + '><span>' + icon(t.v === 'Venda' ? 'money' : 'sync') + t.l + '</span></label>').join('') +
    '</div><small id="pTipoInfo"></small></div>' +
    '<div class="span-all"><button class="btn btn-sm" data-act="new-cliente">' + icon('userplus') + 'Cadastrar novo cliente</button></div></div></section>' +
    '<div id="pMensalSec"></div>' +
    '<section class="panel"><div class="panel-head"><h2>Produtos e serviços</h2><span class="muted" id="pQtdItens"></span></div><div id="pItens"></div>' +
    '<div class="add-item"><input id="pAddProd" list="dlProdProp" placeholder="Adicionar do catálogo: digite código ou nome"><datalist id="dlProdProp">' +
    S.data.produtos.filter(p => p.status !== 'Inativo').map(p => '<option value="' + esc(produtoLabel(p)) + '">' + esc(p.tipo + ' • ' + money(p.preco)) + '</option>').join('') + '</datalist>' +
    '<button class="btn" data-act="prop-item-livre">' + icon('plus') + 'Item avulso</button></div></section>' +
    '<section class="panel"><div class="panel-head"><h2>Condições de pagamento</h2><div class="stat-line"><button class="btn btn-sm" data-act="cond-add" data-tipo="vista">À vista</button><button class="btn btn-sm" data-act="cond-add" data-tipo="3">3x</button><button class="btn btn-sm" data-act="cond-add" data-tipo="10">10x</button><button class="btn btn-sm" data-act="cond-add" data-tipo="mensal">Mensalidade</button><button class="btn btn-sm" data-act="cond-add" data-tipo="">' + icon('plus') + 'Linha</button></div></div>' +
    '<div class="panel-body"><div class="cond-row muted" style="font-size:12.5px;font-weight:600"><span>Entrada</span><span>Condição</span><span>Parcelas</span><span>Valor final</span><span></span></div><div id="pConds"></div>' +
    '<datalist id="dlEntrada">' + ['A VISTA', 'S', 'E', 'PIX', 'BOLETO', 'CARTÃO'].map(x => '<option value="' + x + '">').join('') + '</datalist><small class="muted">*S: sem entrada • *E: com entrada — como no modelo impresso.</small></div></section>' +
    '<section class="panel"><div class="panel-head"><h2>Observações para o cliente</h2>' + (c && c.obsCliente ? '<button class="btn btn-sm" data-act="prop-obs-cliente">Usar observações do cadastro</button>' : '') + '</div>' +
    '<div class="panel-body"><label class="field obs-cliente"><span class="sr-only">Observações para o cliente</span><textarea id="pObs" class="big" placeholder="Este texto aparece no PDF, no campo OBS.">' + esc(P.obsCliente) + '</textarea><small>Aparece no orçamento em PDF. As observações internas do cliente nunca são impressas.</small></label></div></section>' +
    '</div><aside class="prop-side"><section class="panel"><div class="panel-head"><h2>Resumo</h2></div><div class="panel-body"><div class="totals">' +
    '<div><span>Subtotal</span><strong id="tSub" class="num"></strong></div>' +
    '<div style="align-items:center"><span>Desconto</span><span class="input-group" style="width:170px"><input id="pDesc" inputmode="decimal" value="' + moneyInput(P.desconto) + '" style="min-height:36px;text-align:right"><select id="pDescTipo" style="width:66px;min-height:36px;padding:4px 22px 4px 8px">' + options(['R$', '%'], P.descontoTipo, null) + '</select></span></div>' +
    '<div class="muted"><span>Desconto aplicado</span><span id="tDesc" class="num"></span></div>' +
    '<div class="final"><span id="tFinalLbl">Valor final</span><span id="tFinal" class="num"></span></div>' +
    '<div class="final aluguel" id="tAluguelRow" hidden><span>Aluguel mensal</span><span id="tAluguel" class="num"></span></div></div>' +
    '<div class="grid" style="margin-top:16px"><label class="field"><span>Status da proposta</span><select id="pStatus">' + options(STATUS_PROPOSTA, P.status, null) + '</select></label>' +
    (!P.id ? '<label class="check"><input type="checkbox" id="pAtuStatus"' + (P.atualizarStatusCliente ? ' checked' : '') + '> Registrar no histórico e mover o cliente para “Orçamento enviado”</label>' : '') +
    '<button class="btn" data-act="prop-preview">' + icon('eye') + 'Visualizar PDF</button>' +
    '<button class="btn" data-act="prop-save" data-pdf="0">' + icon('check') + 'Salvar proposta</button>' +
    '<button class="btn btn-primary btn-lg" data-act="prop-save" data-pdf="1">' + icon('file') + 'Salvar e gerar PDF</button></div></div></section></aside></div>';
}
function calcProposta() {
  const P = S.prop;
  P.itens.forEach(i => { i.total = i.locado ? 0 : round2(num(i.quantidade) * num(i.valorUnitario) - num(i.desconto)); });
  const subtotal = round2(P.itens.reduce((s, i) => s + i.total, 0));
  let desc = P.descontoTipo === '%' ? round2(subtotal * Math.min(num(P.desconto), 100) / 100) : round2(num(P.desconto));
  desc = Math.min(Math.max(desc, 0), subtotal);
  return { subtotal, desconto: desc, valorFinal: round2(subtotal - desc), totalMensal: round2(num(P.valorMensal) + num(P.outrosMensal)) };
}
function drawPropTotais() {
  const t = calcProposta();
  $('#tSub').textContent = money(t.subtotal);
  $('#tDesc').textContent = '− ' + money(t.desconto);
  $('#tFinal').textContent = money(t.valorFinal);
  const loc = S.prop.tipoOrcamento === 'Locado';
  $('#tFinalLbl').textContent = loc ? 'Itens cobrados à parte' : 'Valor final';
  $('#tAluguelRow').hidden = !(loc || S.prop.incluirMensal);
  $('#tAluguel').textContent = money(t.totalMensal) + '/mês';
  const tm = $('#pTotMensal'); if (tm) tm.textContent = money(t.totalMensal);
  $('#pQtdItens').textContent = S.prop.itens.length + ' item(ns)';
  S.prop.itens.forEach((i, idx) => { const el = $('#itTot' + idx); if (el) el.textContent = i.locado ? 'Locado' : money(i.total); });
}
function drawPropItens() {
  const P = S.prop;
  $('#pItens').innerHTML = P.itens.length
    ? '<div class="table-wrap"><table class="tbl items-tbl responsive"><thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Qtd.</th><th>Unit. (R$)</th><th>Desc. (R$)</th>' + (P.tipoOrcamento === 'Locado' ? '<th title="Marcado = equipamento em comodato (sai como Locado, sem valor)">Comodato</th>' : '') + '<th class="right">Total</th><th></th></tr></thead><tbody>' +
    P.itens.map((i, idx) => '<tr data-idx="' + idx + '">' +
      '<td data-label="Código"><input data-f="codigo" value="' + esc(i.codigo) + '" style="width:86px"></td>' +
      '<td data-label="Descrição"><input data-f="descricao" value="' + esc(i.descricao) + '" style="min-width:180px"></td>' +
      '<td data-label="Tipo"><select data-f="tipo" class="w-tipo">' + options(['Produto', 'Serviço'], i.tipo, null) + '</select></td>' +
      '<td data-label="Qtd."><input data-f="quantidade" type="number" min="0" step="any" class="w-qtd" value="' + esc(i.quantidade) + '"></td>' +
      '<td data-label="Unit. (R$)"><input data-f="valorUnitario" inputmode="decimal" class="w-money" value="' + moneyInput(i.valorUnitario) + '"' + (i.locado ? ' disabled' : '') + '></td>' +
      '<td data-label="Desc. (R$)"><input data-f="desconto" inputmode="decimal" class="w-money" value="' + moneyInput(i.desconto) + '"' + (i.locado ? ' disabled' : '') + '></td>' +
      (P.tipoOrcamento === 'Locado' ? '<td data-label="Comodato"><input data-f="locado" type="checkbox" style="width:20px;height:20px"' + (i.locado ? ' checked' : '') + ' aria-label="Equipamento em comodato"></td>' : '') +
      '<td data-label="Total" class="right num nowrap"><strong id="itTot' + idx + '"></strong></td>' +
      '<td class="no-label"><button class="btn-icon" data-act="prop-item-del" data-idx="' + idx + '" aria-label="Remover item">' + icon('trash') + '</button></td></tr>').join('') + '</tbody></table></div>'
    : emptyState('Nenhum item', 'Pesquise no catálogo abaixo ou adicione um item avulso.');
  drawPropTotais();
}
function drawPropConds() {
  $('#pConds').innerHTML = S.prop.condicoes.map((c, i) => '<div class="cond-row" data-ci="' + i + '">' +
    '<input data-c="entrada" list="dlEntrada" value="' + esc(c.entrada) + '" placeholder="A VISTA">' +
    '<input data-c="condicao" value="' + esc(c.condicao) + '" placeholder="Ex.: PIX / Cartão">' +
    '<input data-c="parcelas" value="' + esc(c.parcelas) + '" placeholder="Ex.: 3x de R$ 100,00">' +
    '<input data-c="valor" inputmode="decimal" value="' + moneyInput(c.valor) + '">' +
    '<button class="btn-icon" data-act="cond-del" data-ci="' + i + '" aria-label="Remover condição">' + icon('trash') + '</button></div>').join('') ||
    '<p class="muted" style="margin:6px 0 10px">Nenhuma condição. Use os atalhos acima.</p>';
}
/** Troca entre Venda e Locação ajustando itens e mensalidade. */
function setTipoOrcamento(tipo) {
  const P = S.prop;
  P.tipoOrcamento = normTipo(tipo);
  const loc = P.tipoOrcamento === 'Locado';
  P.itens.forEach(i => { i.locado = loc; });
  if (loc) P.incluirMensal = true; else if (!num(P.valorMensal) && !num(P.outrosMensal)) P.incluirMensal = false;
  drawPropMensal();
  drawPropItens();
  if (loc && !num(P.valorMensal)) setTimeout(() => { const el = $('#pVMensal'); if (el) el.focus(); }, 50);
}
/** Bloco do aluguel (locação) ou da cobrança mensal opcional (venda). */
function drawPropMensal() {
  const P = S.prop, loc = P.tipoOrcamento === 'Locado';
  $('#pTipoInfo').textContent = loc
    ? 'Equipamentos em comodato: saem no PDF como “Locado”, sem valor. Desmarque “Comodato” no item que for cobrado à parte (ex.: cabos, instalação).'
    : 'O cliente compra os equipamentos: todos os valores aparecem no orçamento.';
  const campos = '<label class="field"><span' + (loc ? ' class="req"' : '') + '>' + (loc ? 'Valor do aluguel mensal (R$)' : 'Valor mensal (R$)') + '</span><input id="pVMensal" inputmode="decimal" value="' + moneyInput(P.valorMensal) + '"></label>' +
    '<label class="field"><span>Outros serviços mensais (R$)</span><input id="pVOutros" inputmode="decimal" value="' + moneyInput(P.outrosMensal) + '" placeholder="Ex.: monitoramento"></label>' +
    '<div class="field"><span>Total da mensalidade</span><strong id="pTotMensal" style="font-size:20px;font-family:var(--font-display)"></strong></div>';
  $('#pMensalSec').innerHTML = loc
    ? '<section class="panel panel-aluguel"><div class="panel-head"><h2>' + icon('sync') + ' Aluguel mensal (comodato)</h2><span class="tag">Obrigatório</span></div>' +
      '<div class="panel-body grid g3">' + campos + '<small class="muted span-all">Este é o valor que o cliente paga por mês. Sai no PDF em “Cobrança mensal”.</small></div></section>'
    : '<section class="panel"><div class="panel-head"><h2>Cobrança mensal <span class="muted" style="font-weight:500;font-size:13px">(opcional)</span></h2><label class="check"><input type="checkbox" id="pMensal"' + (P.incluirMensal ? ' checked' : '') + '> Incluir no orçamento</label></div>' +
      '<div class="panel-body grid g3" id="pMensalBox"' + (P.incluirMensal ? '' : ' hidden') + '>' + campos + '<small class="muted span-all">Use para monitoramento ou manutenção mensal após a venda.</small></div></section>';
  const chk = $('#pMensal');
  if (chk) chk.onchange = () => { P.incluirMensal = chk.checked; $('#pMensalBox').hidden = !P.incluirMensal; drawPropTotais(); };
  $('#pVMensal').oninput = e => { P.valorMensal = num(e.target.value); e.target.classList.remove('invalid'); drawPropTotais(); };
  $('#pVOutros').oninput = e => { P.outrosMensal = num(e.target.value); drawPropTotais(); };
  drawPropTotais();
}
function propostaEditorBind() {
  const P = S.prop;
  drawPropItens();
  drawPropConds();
  const cliInput = $('#pCliente');
  cliInput.addEventListener('change', () => {
    const v = cliInput.value.trim();
    const c = scoped(S.data.clientes).find(x => clienteLabel(x) === v) || scoped(S.data.clientes).find(x => norm(clienteNome(x)) === norm(v) || '#' + x.codigo === v);
    P.clienteId = c ? c.id : '';
    $('#pCliInfo').textContent = c ? [c.contato, maskPhone(c.whatsapp || c.telefone), c.email].filter(Boolean).join(' • ') : 'Cliente não encontrado. Selecione da lista.';
    if (c && !P.obsCliente && c.obsCliente) { P.obsCliente = c.obsCliente; $('#pObs').value = c.obsCliente; }
  });
  $('#pTipo').addEventListener('change', e => setTipoOrcamento(e.target.value));
  drawPropMensal();
  $('#pValidade').onchange = e => { P.validade = e.target.value; };
  $('#pStatus').onchange = e => { P.status = e.target.value; };
  $('#pObs').oninput = e => { P.obsCliente = e.target.value; };
  const at = $('#pAtuStatus'); if (at) at.onchange = () => { P.atualizarStatusCliente = at.checked; };
  $('#pDesc').oninput = e => { P.desconto = num(e.target.value); drawPropTotais(); };
  $('#pDescTipo').onchange = e => { P.descontoTipo = e.target.value; drawPropTotais(); };
  const add = $('#pAddProd');
  add.addEventListener('change', () => {
    const pr = findProdutoByLabel(add.value);
    if (!pr) return;
    const ex = P.itens.find(i => i.produtoId === pr.id);
    if (ex) ex.quantidade = num(ex.quantidade) + 1;
    else P.itens.push({ produtoId: pr.id, codigo: pr.codigo, descricao: pr.produto, tipo: pr.tipo || 'Produto', unidade: pr.unidade, quantidade: 1, valorUnitario: num(pr.preco), desconto: 0, locado: P.tipoOrcamento === 'Locado' });
    add.value = '';
    drawPropItens();
  });
  $('#pItens').addEventListener('input', e => {
    const el = e.target.closest('[data-f]'); if (!el) return;
    const i = P.itens[+el.closest('tr').dataset.idx], f = el.dataset.f;
    if (f === 'locado') { i.locado = el.checked; drawPropItens(); return; }
    i[f] = ['quantidade', 'valorUnitario', 'desconto'].includes(f) ? num(el.value) : el.value;
    drawPropTotais();
  });
  $('#pItens').addEventListener('change', e => { const el = e.target.closest('[data-f]'); if (el && el.dataset.f === 'tipo') P.itens[+el.closest('tr').dataset.idx].tipo = el.value; });
  $('#pConds').addEventListener('input', e => {
    const el = e.target.closest('[data-c]'); if (!el) return;
    const c = P.condicoes[+el.closest('[data-ci]').dataset.ci];
    c[el.dataset.c] = el.dataset.c === 'valor' ? num(el.value) : el.value;
  });
}
function addCondicao(tipo) {
  const t = calcProposta();
  const P = S.prop;
  if (tipo === 'mensal') P.condicoes.push({ entrada: 'S', condicao: P.tipoOrcamento === 'Locado' ? 'ALUGUEL MENSAL (COMODATO)' : 'MENSALIDADE', parcelas: 'MENSAL', valor: t.totalMensal });
  else if (tipo === 'vista') P.condicoes.push({ entrada: 'A VISTA', condicao: money(t.valorFinal), parcelas: '', valor: t.valorFinal });
  else if (tipo) { const n = +tipo; P.condicoes.push({ entrada: 'S', condicao: 'CARTÃO DE CRÉDITO', parcelas: n + 'x de ' + money(round2(t.valorFinal / n)), valor: t.valorFinal }); }
  else P.condicoes.push({ entrada: '', condicao: '', parcelas: '', valor: t.valorFinal });
  drawPropConds();
}
/** Converte o estado do editor no objeto usado pelo PDF. */
function propostaParaPDF(P, numero) {
  const t = calcProposta();
  return Object.assign({}, P, t, { numero: numero || P.numero || 'PRÉVIA', dataEmissao: P.dataEmissao || nowStamp(), validade: P.validade.length === 10 ? P.validade + ' ' + nowStamp().slice(11) : P.validade });
}
async function salvarProposta(gerarPdf) {
  const P = S.prop;
  if (!P.clienteId) { $('#pCliente').classList.add('invalid'); $('#pCliente').focus(); return toast('Selecione o cliente da proposta.', 'err'); }
  if (!P.itens.filter(i => String(i.descricao).trim()).length) return toast('Adicione pelo menos um produto ou serviço.', 'err');
  if (P.tipoOrcamento === 'Locado' && !(num(P.valorMensal) > 0)) {
    const el = $('#pVMensal'); if (el) { el.classList.add('invalid'); el.focus(); }
    return toast('Informe o valor do aluguel mensal que o cliente vai pagar.', 'err');
  }
  if (P.tipoOrcamento === 'Venda') P.itens.forEach(i => { i.locado = false; });
  const payload = Object.assign({}, P, { validade: P.validade ? P.validade + ' ' + nowStamp().slice(11) : '' });
  const r = await run(() => api('saveProposta', payload));
  if (!r) return;
  upsert(S.data.propostas, r.proposta);
  upsert(S.data.clientes, r.cliente);
  S.data.atividades = S.data.atividades.filter(a => a.clienteId !== r.cliente.id).concat(r.atividades);
  toast(P.id ? 'Proposta atualizada com sucesso.' : 'Proposta gerada com sucesso. Nº ' + r.proposta.numero);
  go('propostas');
  if (gerarPdf) { await new Promise(res => setTimeout(res, 120)); gerarPdfProposta(r.proposta.id); }
}
async function gerarPdfProposta(id, preview) {
  let prop, cliente, vendedor;
  if (preview) {
    prop = propostaParaPDF(S.prop);
    cliente = byId(S.data.clientes, prop.clienteId) || {};
    vendedor = S.user;
  } else {
    const p = byId(S.data.propostas, id);
    if (!p) return toast('Proposta não encontrada.', 'err');
    prop = Object.assign({}, p, { itens: parseJSON(p.itens, []), condicoes: parseJSON(p.condicoes, []), incluirMensal: p.incluirMensal === 'Sim' });
    cliente = byId(S.data.clientes, p.clienteId) || { empresa: p.cliente };
    vendedor = S.data.usuarios.find(u => u.usuario === p.usuarioVendedor && u.nomeCompleto) || (p.usuarioVendedor === S.user.usuario ? S.user : S.data.usuarios.find(u => u.usuario === p.usuarioVendedor)) || { nome: p.vendedor, nomeCompleto: p.vendedor };
  }
  if (!window.VegasPDF || !window.jspdf) return toast('O gerador de PDF ainda está carregando. Tente em instantes.', 'warn');
  loading(true);
  try {
    const doc = await VegasPDF.proposta({ proposta: prop, cliente, vendedor, config: S.data.config });
    const nome = 'Orcamento_' + prop.numero + '_' + clienteNome(cliente).replace(/[^\w]+/g, '_').slice(0, 40) + '.pdf';
    showPdfActions(doc, nome, cliente, prop);
  } catch (e) {
    console.error(e);
    toast('Não foi possível gerar o PDF: ' + e.message, 'err');
  } finally { loading(false); }
}
function showPdfActions(doc, nome, cliente, prop) {
  const blob = doc.output('blob');
  const file = typeof File === 'function' ? new File([blob], nome, { type: 'application/pdf' }) : null;
  const canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
  const fone = cliente && (cliente.whatsapp || cliente.telefone);
  const m = openModal({
    title: 'Orçamento Nº ' + prop.numero, size: 'sm',
    body: '<p style="margin-top:0">PDF pronto no padrão Vegas. ' + (canShare ? 'Use “Compartilhar” para enviar o arquivo direto pelo WhatsApp.' : 'Baixe o arquivo e anexe no WhatsApp ou e-mail.') + '</p>' +
      '<div class="grid"><button class="btn btn-primary btn-lg" data-dl>' + icon('download') + 'Baixar PDF</button>' +
      '<button class="btn btn-lg" data-open>' + icon('eye') + 'Abrir PDF</button>' +
      (canShare ? '<button class="btn btn-lg" data-share>' + icon('share') + 'Compartilhar arquivo</button>' : '') +
      (fone && cliente.id ? '<button class="btn btn-lg btn-wa" data-wa>' + icon('wa') + 'Mensagem no WhatsApp</button>' : '') + '</div>' +
      (prop.id && isAdmin() ? '<div class="ct-cta"><div><strong>Contrato</strong><small>Gere o contrato preenchido com os dados deste cliente e desta proposta.</small></div>' +
        '<button class="btn btn-lg" data-contrato>' + icon('contract') + 'Gerar contrato</button></div>' : '')
  });
  const bc = $('[data-contrato]', m);
  if (bc) bc.onclick = () => { closeModal(m); openContratoModal(prop.id); };
  $('[data-dl]', m).onclick = () => { downloadFile(nome, blob); toast('PDF baixado.'); };
  $('[data-open]', m).onclick = () => { const u = URL.createObjectURL(blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  if (canShare) $('[data-share]', m).onclick = () => navigator.share({ files: [file], title: nome, text: 'Orçamento Vegas Vigilância Nº ' + prop.numero }).catch(() => {});
  const wa = $('[data-wa]', m);
  if (wa) wa.onclick = () => { closeModal(m); openWhatsApp(cliente.id, fillMsg(MSG_WHATSAPP[2].texto, cliente) + ' (Orçamento Nº ' + prop.numero + ', valor ' + money(prop.valorFinal) + ')'); };
}
/* ===== 9.8.1 Contratos ===== */
/** Unidade que assina: Niterói para a região metropolitana, Volta Redonda para o restante. */
function localPadrao(c) {
  return /niteroi|sao goncalo|marica|rio de janeiro|itaborai|duque de caxias|nova iguacu/.test(norm(c && c.cidade)) ? 'Niterói' : 'Volta Redonda';
}
function openContratoModal(propId) {
  if (!isAdmin()) return toast('Somente o administrador pode gerar contratos.', 'warn');
  const reg = byId(S.data.propostas, propId);
  if (!reg) return toast('Proposta não encontrada.', 'err');
  if (!window.VegasContratos) return toast('O módulo de contratos ainda está carregando. Tente em instantes.', 'warn');
  const VC = window.VegasContratos;
  const prop = Object.assign({}, reg, { itens: parseJSON(reg.itens, []), condicoes: parseJSON(reg.condicoes, []) });
  const cli = () => byId(S.data.clientes, reg.clienteId) || { empresa: reg.cliente };
  const docLen = digits(cli().documento).length;
  const pessoaCli = docLen === 14 ? 'PJ' : docLen === 11 ? 'PF' : '';
  const sugerido = VC.CONTRATOS.find(ct => ct.pessoa === pessoaCli) || VC.CONTRATOS[0];
  const st = { def: null, res: null, params: { numAditivo: '', prazo: '', local: localPadrao(cli()), data: today(), dias: '', instalacao: '', veiculos: [{ placa: '', modelo: '', ano: '', cor: '', chassi: '', renavam: '' }] } };
  const grupos = [...new Set(VC.CONTRATOS.map(ct => ct.grupo))];
  const body =
    '<p class="muted" style="margin-top:0">Orçamento Nº ' + esc(reg.numero) + ' • ' + esc(clienteNome(cli())) + (pessoaCli ? ' • ' + (pessoaCli === 'PJ' ? 'Pessoa jurídica (CNPJ)' : 'Pessoa física (CPF)') : ' • CPF/CNPJ não informado') + '</p>' +
    '<div class="field-label" style="margin-bottom:8px">1. Escolha o contrato</div><div class="ct-lista">' +
    grupos.map(g => '<div class="ct-grupo"><strong>' + esc(g) + '</strong><div class="segmented">' +
      VC.CONTRATOS.filter(ct => ct.grupo === g).map(ct => {
        const incompat = pessoaCli && ct.pessoa !== 'AMBOS' && ct.pessoa !== pessoaCli;
        return '<label' + (incompat ? ' class="ct-dim" title="O cliente é ' + (pessoaCli === 'PJ' ? 'pessoa jurídica' : 'pessoa física') + '"' : '') + '><input type="radio" name="ct" value="' + ct.id + '"><span>' + esc(VC.PESSOA_LBL[ct.pessoa]) + '</span></label>';
      }).join('') + '</div></div>').join('') + '</div>' +
    '<div id="ctParams"></div><div id="ctCheck"></div>';
  const m = openModal({
    title: 'Gerar contrato', size: 'lg', body,
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn" data-editcli hidden>' + icon('edit') + 'Completar cadastro do cliente</button>' +
      '<button class="btn" data-editprop hidden>' + icon('file') + 'Ajustar proposta</button>' +
      '<button class="btn btn-primary" data-gerar disabled>' + icon('download') + 'Baixar contrato em PDF</button>'
  });
  const avaliar = async () => {
    if (!st.def) return;
    $('#ctCheck', m).innerHTML = '<p class="muted">Lendo o modelo do contrato…</p>';
    try {
      st.res = await VC.preparar(st.def, cli(), prop, st.params);
    } catch (e) { $('#ctCheck', m).innerHTML = '<p class="late">' + esc(e.message) + '</p>'; return; }
    desenharParams();
    desenharCheck();
  };
  const desenharParams = () => {
    const pz = st.res.precisa, P = st.params;
    let h = '<div class="field-label" style="margin:18px 0 8px">2. Dados do contrato</div><div class="grid g4" id="ctForm">' +
      '<label class="field"><span>Local de assinatura</span><select name="local">' + options(['Volta Redonda', 'Niterói'], P.local, null) + '</select></label>' +
      '<label class="field"><span>Data do contrato</span><input type="date" name="data" value="' + esc(P.data) + '"></label>' +
      (pz.numAditivo ? '<label class="field"><span class="req">Número do aditivo</span><input type="number" min="1" step="1" name="numAditivo" value="' + esc(P.numAditivo) + '" placeholder="Ex.: 2 (2º aditivo)"></label>' : '') +
      (pz.prazo ? '<label class="field"><span class="req">Prazo (meses)</span><input type="number" min="1" step="1" name="prazo" value="' + esc(P.prazo) + '"></label>' : '') +
      (pz.dias ? '<label class="field"><span class="req">Retenção das imagens (dias)</span><input type="number" min="1" step="1" name="dias" value="' + esc(P.dias) + '" placeholder="Ex.: 30"></label>' : '') +
      (pz.instalacao ? '<div class="field span2"><span class="field-label req">Modalidade de instalação</span><div class="segmented">' +
        [['com', 'Com instalação'], ['sem', 'Sem instalação']].map(o => '<label><input type="radio" name="instalacao" value="' + o[0] + '"' + (P.instalacao === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>').join('') + '</div></div>' : '') +
      '</div>';
    if (pz.veiculos) {
      h += '<div class="field-label" style="margin:16px 0 8px">Veículos a rastrear</div><div id="ctVeic">' +
        P.veiculos.map((v, i) => '<div class="ct-veic" data-vi="' + i + '">' +
          [['placa', 'Placa *'], ['modelo', 'Marca / modelo *'], ['ano', 'Ano'], ['cor', 'Cor'], ['chassi', 'Chassi'], ['renavam', 'Renavam']].map(f =>
            '<input data-v="' + f[0] + '" placeholder="' + f[1] + '" value="' + esc(v[f[0]]) + '" aria-label="' + f[1] + '">').join('') +
          '<button class="btn-icon" data-vdel="' + i + '" aria-label="Remover veículo">' + icon('trash') + '</button></div>').join('') +
        '</div><button class="btn btn-sm" data-vadd style="margin-top:6px">' + icon('plus') + 'Adicionar veículo</button>';
    }
    const box = $('#ctParams', m);
    const foco = document.activeElement && box.contains(document.activeElement) ? [document.activeElement.name || document.activeElement.dataset.v, document.activeElement.closest('[data-vi]') ? document.activeElement.closest('[data-vi]').dataset.vi : null] : null;
    box.innerHTML = h;
    if (foco) { const sel = foco[1] != null ? '[data-vi="' + foco[1] + '"] [data-v="' + foco[0] + '"]' : '[name="' + foco[0] + '"]'; const el = $(sel, box); if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'number' && el.type !== 'date') el.setSelectionRange(el.value.length, el.value.length); } }
  };
  const desenharCheck = () => {
    const r = st.res;
    const grupo = { cliente: 'Cadastro do cliente', proposta: 'Proposta', contrato: 'Dados do contrato', modelo: 'Modelo do contrato' };
    const faltaCli = r.pend.filter(x => x.onde === 'cliente' && !x.ok);
    const faltaProp = r.pend.filter(x => x.onde === 'proposta' && !x.ok);
    $('#ctCheck', m).innerHTML = '<div class="field-label" style="margin:18px 0 8px">3. Conferência — todos os campos precisam estar preenchidos</div><div class="ct-check">' +
      Object.keys(grupo).filter(g => r.pend.some(x => x.onde === g)).map(g => '<div><strong>' + grupo[g] + '</strong><ul>' +
        r.pend.filter(x => x.onde === g).map(x => '<li class="' + (x.ok ? 'ok' : 'nok') + '">' + icon(x.ok ? 'check' : 'x') + '<span>' + esc(x.label) + (x.erro ? ' <small>' + esc(x.erro) + '</small>' : '') + '</span></li>').join('') +
        '</ul></div>').join('') + '</div>' +
      '<p class="ct-status ' + (r.ok ? 'ok' : 'nok') + '">' + (r.ok ? icon('check') + ' Tudo preenchido. O contrato pode ser baixado.' : icon('alert') + ' Faltam ' + r.pend.filter(x => !x.ok).length + ' item(ns). O download fica liberado quando tudo estiver preenchido.') + '</p>';
    $('[data-gerar]', m).disabled = !r.ok;
    const be = $('[data-editcli]', m); be.hidden = !faltaCli.length;
    be.onclick = () => openClienteForm(cli().id, { destacar: [...new Set(faltaCli.map(x => x.campo).filter(Boolean))], onSaved: () => avaliar() });
    const bp = $('[data-editprop]', m); bp.hidden = !faltaProp.length;
    bp.onclick = () => { modals.slice().forEach(x => closeModal(x)); go('propostas', 'editar/' + reg.id); };
  };
  const reavaliar = debounce(avaliar, 250);
  m.addEventListener('change', e => {
    if (e.target.name === 'ct') {
      st.def = VC.CONTRATOS.find(ct => ct.id === e.target.value);
      if (!st.params.prazo) st.params.prazo = String(st.def.prazo || 12);
      avaliar();
    } else if (e.target.closest('#ctForm')) { st.params[e.target.name] = e.target.value; reavaliar(); }
  });
  m.addEventListener('input', e => {
    const f = e.target.closest('#ctForm [name]');
    if (f && f.type !== 'radio') { st.params[f.name] = f.value; reavaliar(); return; }
    const v = e.target.closest('[data-v]');
    if (v) { st.params.veiculos[+v.closest('[data-vi]').dataset.vi][v.dataset.v] = v.value; reavaliar(); }
  });
  m.addEventListener('click', e => {
    if (e.target.closest('[data-vadd]')) { st.params.veiculos.push({ placa: '', modelo: '', ano: '', cor: '', chassi: '', renavam: '' }); avaliar(); }
    const d = e.target.closest('[data-vdel]');
    if (d) { st.params.veiculos.splice(+d.dataset.vdel, 1); if (!st.params.veiculos.length) st.params.veiculos.push({ placa: '', modelo: '' }); avaliar(); }
  });
  $('[data-gerar]', m).onclick = async () => {
    await avaliar();
    if (!st.res || !st.res.ok) return toast('Preencha todos os campos obrigatórios do contrato.', 'err');
    if (!window.jspdf) return toast('O gerador de PDF ainda está carregando.', 'warn');
    loading(true);
    try {
      const nomeCli = clienteNome(cli());
      const titulo = 'Contrato — ' + st.def.grupo + ' — ' + nomeCli;
      const doc = await VC.gerarPDF(st.res, titulo);
      const nome = 'Contrato_' + st.def.id + '_' + nomeCli.replace(/[^\w]+/g, '_').slice(0, 40) + '.pdf';
      closeModal(m);
      mostrarArquivoPdf(doc, nome, 'Contrato pronto', 'Contrato de ' + st.def.grupo.toLowerCase() + ' (' + VC.PESSOA_LBL[st.def.pessoa].toLowerCase() + ') preenchido com os dados do cliente.');
      const c = cli();
      run(() => api('saveAtividade', { clienteId: c.id, tipo: 'Outro', data: nowStamp(), descricao: 'Contrato gerado: ' + st.def.grupo + ' — ' + VC.PESSOA_LBL[st.def.pessoa] + ' (Orçamento Nº ' + reg.numero + ', prazo ' + (st.params.prazo || '-') + ' meses).', dataProximoContato: c.dataProximoContato, proximoContato: c.proximoContato }, { silent: true }))
        .then(x => { if (x) { S.data.atividades.unshift(x.atividade); upsert(S.data.clientes, x.cliente); } });
    } catch (e) {
      console.error(e);
      toast('Não foi possível gerar o contrato: ' + e.message, 'err');
    } finally { loading(false); }
  };
  // Pré-seleciona o contrato compatível com o cliente
  const radio = $('input[name=ct][value="' + sugerido.id + '"]', m);
  if (radio && pessoaCli) { radio.checked = true; st.def = sugerido; st.params.prazo = String(sugerido.prazo || 12); avaliar(); }
}
/** Janela padrão de download/compartilhamento de um PDF. */
function mostrarArquivoPdf(doc, nome, titulo, texto) {
  const blob = doc.output('blob');
  const file = typeof File === 'function' ? new File([blob], nome, { type: 'application/pdf' }) : null;
  const canShare = file && navigator.canShare && navigator.canShare({ files: [file] });
  const m = openModal({
    title: titulo, size: 'sm',
    body: '<p style="margin-top:0">' + esc(texto) + '</p><div class="grid"><button class="btn btn-primary btn-lg" data-dl>' + icon('download') + 'Baixar PDF</button>' +
      '<button class="btn btn-lg" data-open>' + icon('eye') + 'Abrir PDF</button>' + (canShare ? '<button class="btn btn-lg" data-share>' + icon('share') + 'Compartilhar arquivo</button>' : '') + '</div>'
  });
  $('[data-dl]', m).onclick = () => { downloadFile(nome, blob); toast('PDF baixado.'); };
  $('[data-open]', m).onclick = () => { const u = URL.createObjectURL(blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); };
  if (canShare) $('[data-share]', m).onclick = () => navigator.share({ files: [file], title: nome }).catch(() => {});
}
async function deleteProposta(id) {
  const p = byId(S.data.propostas, id);
  if (!(await confirmDialog('Excluir a proposta Nº ' + p.numero + ' de ' + p.cliente + '?', { title: 'Excluir proposta', ok: 'Excluir', danger: true }))) return;
  if (!(await run(() => api('deleteProposta', { id })))) return;
  S.data.propostas = S.data.propostas.filter(x => x.id !== id);
  toast('Proposta excluída.');
  refreshAll();
}
async function changePropStatus(id, status) {
  const r = await run(() => api('updateStatusProposta', { id, status }));
  if (r) { upsert(S.data.propostas, r); toast('Proposta marcada como "' + status + '".'); }
  refreshAll();
}

/* ===== 9.9 Relatórios ===== */
const REL_TIPOS = [
  { v: 'clientes', l: 'Clientes' }, { v: 'propostas', l: 'Propostas / orçamentos' }, { v: 'contatos', l: 'Contatos realizados' },
  { v: 'prospeccoes', l: 'Produtos em prospecção' }, { v: 'produtos', l: 'Produtos mais orçados' },
  { v: 'vendedores', l: 'Desempenho por vendedor' }, { v: 'segmentos', l: 'Resultado por segmento' }
];
function relatorioDados(f) {
  const inP = d => { d = String(d || '').slice(0, 10); return (!f.de || d >= f.de) && (!f.ate || d <= f.ate); };
  const vend = r => !f.vendedor || r.usuarioVendedor === f.vendedor;
  const cli = r => !f.cliente || norm(r.cliente || clienteNome(r)).includes(norm(f.cliente));
  const clientes = scoped(S.data.clientes), propostas = scoped(S.data.propostas), ativ = scoped(S.data.atividades), prosp = scoped(S.data.prospeccoes);
  const cliMap = Object.fromEntries(S.data.clientes.map(c => [c.id, c]));
  const segOk = r => !f.segmento || (cliMap[r.clienteId] || r).segmento === f.segmento;
  const prodOk = p => !f.produto || parseJSON(p.itens, []).some(i => norm(i.descricao + ' ' + i.codigo).includes(norm(f.produto)));
  const R = { cols: [], rows: [], resumo: [] };
  const L = (k, l, a) => ({ k, l, a });
  if (f.tipo === 'clientes') {
    const pids = f.produto ? new Set(prosp.filter(p => norm(p.produto).includes(norm(f.produto))).map(p => p.clienteId)) : null;
    const l = clientes.filter(c => inP(c.dataCadastro) && vend(c) && (!f.status || c.status === f.status) && (!f.segmento || c.segmento === f.segmento) &&
      (!f.cliente || norm(clienteNome(c) + ' ' + c.contato).includes(norm(f.cliente))) && (!pids || pids.has(c.id) || norm(c.produtoInteresse).includes(norm(f.produto))));
    R.cols = [L('codigo', 'Cód.'), L('nome', 'Cliente'), L('contato', 'Contato'), L('fone', 'Telefone'), L('cidade', 'Cidade'), L('segmento', 'Segmento'), L('status', 'Status'), L('vendedor', 'Vendedor'), L('cadastro', 'Cadastro')];
    R.rows = l.map(c => ({ codigo: c.codigo, nome: clienteNome(c), contato: c.contato, fone: maskPhone(c.whatsapp || c.telefone), cidade: c.cidade, segmento: c.segmento, status: c.status, vendedor: c.vendedor, cadastro: fmtDate(c.dataCadastro) }));
    R.resumo = [['Clientes', l.length], ['Ganhos', l.filter(c => c.status === 'Cliente ganho').length], ['Perdidos', l.filter(c => c.status === 'Cliente perdido' || c.status === 'Sem interesse').length], ['Em andamento', l.filter(c => !ENCERRADOS.includes(c.status)).length]];
  } else if (f.tipo === 'propostas') {
    const l = propostas.filter(p => inP(p.dataEmissao) && vend(p) && cli(p) && (!f.status || p.status === f.status) && segOk(p) && prodOk(p));
    R.cols = [L('numero', 'Nº'), L('emissao', 'Emissão'), L('cliente', 'Cliente'), L('tipo', 'Tipo'), L('status', 'Status'), L('vendedor', 'Vendedor'), L('valor', 'Valor final', 'r'), L('mensal', 'Mensal', 'r')];
    R.rows = l.map(p => ({ numero: p.numero, emissao: fmtDate(p.dataEmissao), cliente: p.cliente, tipo: p.tipoOrcamento, status: p.status, vendedor: p.vendedor, valor: money(p.valorFinal), mensal: p.incluirMensal === 'Sim' ? money(p.totalMensal) : '' }));
    const soma = x => money(x.reduce((s, p) => s + num(p.valorFinal), 0));
    R.resumo = [['Propostas', l.length], ['Valor total', soma(l)], ['Aprovadas', soma(l.filter(p => p.status === 'Aprovada'))], ['Mensalidades', money(l.filter(p => p.incluirMensal === 'Sim').reduce((s, p) => s + num(p.totalMensal), 0))]];
  } else if (f.tipo === 'contatos') {
    const l = ativ.filter(a => inP(a.data) && vend(a) && cli(a) && (!f.status || a.tipo === f.status) && segOk(a)).sort((a, b) => b.data.localeCompare(a.data));
    R.cols = [L('data', 'Data'), L('cliente', 'Cliente'), L('tipo', 'Tipo'), L('descricao', 'Descrição'), L('resultado', 'Resultado'), L('vendedor', 'Vendedor')];
    R.rows = l.map(a => ({ data: fmtDate(a.data, true), cliente: a.cliente, tipo: a.tipo, descricao: a.descricao, resultado: a.resultado, vendedor: a.vendedor }));
    R.resumo = [['Contatos', l.length]].concat(TIPOS_CONTATO.map(t => [t.t, l.filter(a => a.tipo === t.t).length]).filter(x => x[1]));
  } else if (f.tipo === 'prospeccoes') {
    const l = prosp.filter(p => inP(p.data) && vend(p) && cli(p) && (!f.status || p.status === f.status) && segOk(p) && (!f.produto || norm(p.produto).includes(norm(f.produto))));
    R.cols = [L('data', 'Data'), L('cliente', 'Cliente'), L('produto', 'Produto'), L('qtd', 'Qtd.', 'r'), L('valor', 'Valor', 'r'), L('status', 'Status'), L('vendedor', 'Vendedor')];
    R.rows = l.map(p => ({ data: fmtDate(p.data), cliente: p.cliente, produto: p.produto, qtd: p.quantidade, valor: money(p.valor), status: p.status, vendedor: p.vendedor }));
    R.resumo = [['Itens', l.length], ['Valor estimado', money(l.reduce((s, p) => s + num(p.valor), 0))]];
  } else if (f.tipo === 'produtos') {
    const agg = {};
    propostas.filter(p => inP(p.dataEmissao) && vend(p) && cli(p) && (!f.status || p.status === f.status) && segOk(p)).forEach(p => {
      parseJSON(p.itens, []).forEach(i => {
        if (f.produto && !norm(i.descricao + ' ' + i.codigo).includes(norm(f.produto))) return;
        const k = i.codigo || i.descricao;
        const a = agg[k] = agg[k] || { codigo: i.codigo, produto: i.descricao, qtd: 0, props: new Set(), valor: 0 };
        a.qtd += num(i.quantidade); a.props.add(p.id); a.valor += num(i.total);
      });
    });
    const l = Object.values(agg).sort((a, b) => b.qtd - a.qtd);
    R.cols = [L('codigo', 'Código'), L('produto', 'Produto'), L('qtd', 'Qtd. orçada', 'r'), L('props', 'Propostas', 'r'), L('valor', 'Valor total', 'r')];
    R.rows = l.map(a => ({ codigo: a.codigo, produto: a.produto, qtd: a.qtd, props: a.props.size, valor: money(a.valor) }));
    R.resumo = [['Produtos diferentes', l.length], ['Valor total', money(l.reduce((s, a) => s + a.valor, 0))]];
  } else if (f.tipo === 'vendedores' || f.tipo === 'segmentos') {
    const porV = f.tipo === 'vendedores';
    const chave = r => porV ? (r.usuarioVendedor || '-') : ((cliMap[r.clienteId] || r).segmento || 'Não informado');
    const agg = {};
    const g = k => agg[k] = agg[k] || { nome: porV ? nomeVendedor(k) : k, clientes: 0, ganhos: 0, contatos: 0, propostas: 0, valor: 0, aprovado: 0 };
    clientes.filter(c => inP(c.dataCadastro) && vend(c) && (!f.segmento || c.segmento === f.segmento)).forEach(c => { const a = g(chave(c)); a.clientes++; if (c.status === 'Cliente ganho') a.ganhos++; });
    ativ.filter(a => inP(a.data) && vend(a) && segOk(a)).forEach(x => g(chave(x)).contatos++);
    propostas.filter(p => inP(p.dataEmissao) && vend(p) && segOk(p)).forEach(p => { const a = g(chave(p)); a.propostas++; a.valor += num(p.valorFinal); if (p.status === 'Aprovada') a.aprovado += num(p.valorFinal); });
    const l = Object.values(agg).sort((a, b) => b.valor - a.valor);
    R.cols = [L('nome', porV ? 'Vendedor' : 'Segmento'), L('clientes', 'Clientes', 'r'), L('ganhos', 'Ganhos', 'r'), L('contatos', 'Contatos', 'r'), L('propostas', 'Propostas', 'r'), L('valor', 'Valor propostas', 'r'), L('aprovado', 'Aprovado', 'r')];
    R.rows = l.map(a => Object.assign({}, a, { valor: money(a.valor), aprovado: money(a.aprovado) }));
    R.resumo = [['Clientes', l.reduce((s, a) => s + a.clientes, 0)], ['Propostas', l.reduce((s, a) => s + a.propostas, 0)], ['Valor', money(l.reduce((s, a) => s + num(a.valor), 0))]];
  }
  R.title = 'Relatório — ' + REL_TIPOS.find(t => t.v === f.tipo).l;
  R.filtros = [f.de || f.ate ? 'Período: ' + (f.de ? fmtDate(f.de) : 'início') + ' a ' + (f.ate ? fmtDate(f.ate) : 'hoje') : 'Período: todo',
    f.vendedor ? 'Vendedor: ' + nomeVendedor(f.vendedor) : (isAdmin() ? (S.scope ? 'Vendedor: ' + nomeVendedor(S.scope) : 'Todos os vendedores') : 'Vendedor: ' + S.user.nome),
    f.status && 'Status: ' + f.status, f.segmento && 'Segmento: ' + f.segmento, f.cliente && 'Cliente: ' + f.cliente, f.produto && 'Produto: ' + f.produto].filter(Boolean).join(' • ');
  return R;
}
VIEWS.relatorios = () => {
  const f = S.relFiltro = Object.assign({ tipo: 'clientes', de: addDays(-30), ate: today(), vendedor: '', status: '', segmento: '', cliente: '', produto: '' }, S.relFiltro || {});
  const statusList = f.tipo === 'propostas' || f.tipo === 'produtos' ? STATUS_PROPOSTA : f.tipo === 'contatos' ? TIPOS_CONTATO.map(t => t.t) : f.tipo === 'prospeccoes' ? STATUS_PROSPECCAO : STATUS;
  const vend = S.data.usuarios.filter(u => u.perfil !== 'admin').map(u => ({ v: u.usuario, l: u.nome }));
  const R = relatorioDados(f);
  return pageHead('Relatórios', 'Filtre, confira na tela e exporte em CSV ou PDF.',
    '<button class="btn" data-act="rel-csv">' + icon('download') + 'Exportar CSV</button><button class="btn btn-primary" data-act="rel-pdf">' + icon('file') + 'Gerar PDF</button>') +
    '<section class="panel"><div class="panel-body grid g4" id="relFiltros">' +
    '<label class="field"><span>Relatório</span><select name="tipo">' + options(REL_TIPOS, f.tipo, null) + '</select></label>' +
    '<label class="field"><span>De</span><input type="date" name="de" value="' + esc(f.de) + '"></label><label class="field"><span>Até</span><input type="date" name="ate" value="' + esc(f.ate) + '"></label>' +
    (isAdmin() ? '<label class="field"><span>Vendedor</span><select name="vendedor">' + options(vend, f.vendedor, 'Todos') + '</select></label>' : '') +
    (['vendedores', 'segmentos'].includes(f.tipo) ? '' : '<label class="field"><span>' + (f.tipo === 'contatos' ? 'Tipo de contato' : 'Status') + '</span><select name="status">' + options(statusList, f.status, 'Todos') + '</select></label>') +
    '<label class="field"><span>Segmento</span><select name="segmento">' + options(SEGMENTOS, f.segmento, 'Todos') + '</select></label>' +
    '<label class="field"><span>Cliente</span><input name="cliente" value="' + esc(f.cliente) + '" placeholder="Nome do cliente"></label>' +
    '<label class="field"><span>Produto</span><input name="produto" value="' + esc(f.produto) + '" placeholder="Nome ou código"></label>' +
    '<div class="field"><span>&nbsp;</span><div class="stat-line"><button class="btn btn-sm" data-act="rel-periodo" data-d="7">7 dias</button><button class="btn btn-sm" data-act="rel-periodo" data-d="30">30 dias</button><button class="btn btn-sm" data-act="rel-periodo" data-d="mes">Este mês</button><button class="btn btn-sm" data-act="rel-periodo" data-d="0">Tudo</button></div></div>' +
    '</div></section>' +
    '<section class="panel"><div class="panel-head"><h2>' + esc(R.title) + '</h2><span class="muted">' + esc(R.filtros) + '</span></div>' +
    '<div class="panel-body"><div class="stat-line">' + R.resumo.map(x => '<span class="tag">' + esc(x[0]) + ': <strong>' + esc(x[1]) + '</strong></span>').join('') + '</div></div>' +
    (R.rows.length ? '<div class="table-wrap"><table class="tbl responsive"><thead><tr>' + R.cols.map(c => '<th class="' + (c.a === 'r' ? 'right' : '') + '">' + esc(c.l) + '</th>').join('') + '</tr></thead><tbody>' +
      R.rows.slice(0, 500).map(r => '<tr>' + R.cols.map((c, i) => '<td ' + (i === 0 ? '' : 'data-label="' + esc(c.l) + '"') + ' class="' + (c.a === 'r' ? 'right num' : '') + '">' + esc(r[c.k]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
      (R.rows.length > 500 ? '<div class="more muted">Mostrando 500 de ' + R.rows.length + ' linhas. A exportação inclui todas.</div>' : '')
      : emptyState('Sem resultados', 'Nenhum registro atende aos filtros escolhidos.')) + '</section>';
};
VIEWS.relatorios.after = () => {
  const box = $('#relFiltros');
  box.addEventListener('change', () => { Object.assign(S.relFiltro, formDataFrom(box)); render(); });
};
function relPeriodo(d) {
  const f = S.relFiltro;
  if (d === 'mes') { const n = new Date(); f.de = isoDate(new Date(n.getFullYear(), n.getMonth(), 1)); f.ate = today(); }
  else if (d === '0') { f.de = ''; f.ate = ''; }
  else { f.de = addDays(-d); f.ate = today(); }
  render();
}
function relCSV() {
  const R = relatorioDados(S.relFiltro);
  downloadFile(R.title.replace(/\W+/g, '_') + '_' + today() + '.csv', toCSV(R.cols.map(c => c.l), R.rows.map(r => R.cols.map(c => r[c.k]))));
  toast('Relatório exportado.');
}
async function relPDF() {
  if (!window.VegasPDF || !window.jspdf) return toast('O gerador de PDF ainda está carregando.', 'warn');
  const R = relatorioDados(S.relFiltro);
  loading(true);
  try {
    const doc = await VegasPDF.relatorio({ titulo: R.title, filtros: R.filtros, resumo: R.resumo, cols: R.cols, rows: R.rows, usuario: S.user.nome });
    downloadFile(R.title.replace(/\W+/g, '_') + '_' + today() + '.pdf', doc.output('blob'));
    toast('PDF do relatório gerado.');
  } catch (e) { toast('Não foi possível gerar o PDF: ' + e.message, 'err'); } finally { loading(false); }
}

/* ===== 9.10 Configurações ===== */
VIEWS.configuracoes = () => {
  const pref = store.get('vg_theme', 'auto');
  const u = S.user, cfg = S.data.config || {};
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const cfgField = (k, l, type = 'input') => '<label class="field span2"><span>' + l + '</span>' + (type === 'textarea' ? '<textarea name="' + k + '">' + esc(cfg[k] || '') + '</textarea>' : '<input name="' + k + '" value="' + esc(cfg[k] || '') + '">') + '</label>';
  return pageHead('Configurações', 'Preferências deste aparelho e dados usados nos orçamentos.') + '<div class="settings">' +
    '<section class="panel"><div class="panel-head"><h2>Aparência</h2></div><div class="panel-body"><div class="theme-pick">' +
    [['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Automático']].map(t => '<label><input type="radio" name="theme" value="' + t[0] + '"' + (pref === t[0] ? ' checked' : '') + '><span class="sw sw-' + t[0] + '"><i></i>' + t[1] + '</span></label>').join('') +
    '</div><p class="muted" style="margin-bottom:0">A escolha fica salva neste aparelho. “Automático” segue o tema do sistema.</p></div></section>' +
    '<section class="panel"><div class="panel-head"><h2>Aplicativo no celular</h2></div><div class="panel-body grid">' +
    (standalone ? '<p style="margin:0">' + icon('check') + ' O app já está instalado neste aparelho.</p>'
      : '<p style="margin:0">Instale o sistema na tela inicial para abrir como aplicativo, em tela cheia.</p><button class="btn btn-primary" data-act="install">' + icon('install') + 'Instalar aplicativo</button>' +
      (isIOS ? '<p class="muted" style="margin:0">No iPhone: toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>' : '')) +
    '<div class="grid g2"><button class="btn" data-act="server-config">' + icon('gear') + 'Endereço do servidor</button><button class="btn" data-act="clear-cache">' + icon('trash') + 'Limpar dados do aparelho</button></div>' +
    '<small class="muted">Versão ' + APP_VERSION + ' • Servidor: ' + esc(getApiUrl() ? getApiUrl().slice(0, 48) + '…' : 'não configurado') + '</small></div></section>' +
    '<section class="panel"><div class="panel-head"><h2>Meu perfil no orçamento</h2></div><div class="panel-body"><form id="perfilForm" class="grid g2">' +
    '<label class="field span2"><span>Nome completo (sai na assinatura do PDF)</span><input name="nomeCompleto" value="' + esc(u.nomeCompleto) + '"></label>' +
    '<label class="field"><span>Código do vendedor</span><input name="codigo" value="' + esc(u.codigo) + '"></label>' +
    '<label class="field"><span>CPF</span><input name="cpf" data-mask="doc" value="' + esc(u.cpf) + '"></label>' +
    '<label class="field"><span>E-mail comercial</span><input name="email" type="email" value="' + esc(u.email) + '"></label>' +
    '<label class="field"><span>Telefone</span><input name="telefone" data-mask="phone" value="' + esc(maskPhone(u.telefone)) + '"></label>' +
    '<div class="span2"><button class="btn btn-primary" type="submit">' + icon('check') + 'Salvar perfil</button></div></form></div></section>' +
    '<section class="panel"><div class="panel-head"><h2>Alterar senha</h2></div><div class="panel-body"><form id="senhaForm" class="grid">' +
    '<label class="field"><span>Senha atual</span><input type="password" name="atual" autocomplete="current-password"></label>' +
    '<label class="field"><span>Nova senha (mínimo 6 caracteres)</span><input type="password" name="nova" autocomplete="new-password"></label>' +
    '<label class="field"><span>Repita a nova senha</span><input type="password" name="nova2" autocomplete="new-password"></label>' +
    '<div><button class="btn btn-primary" type="submit">Alterar senha</button></div></form></div></section>' +
    (isAdmin() ? '<section class="panel" style="grid-column:1/-1"><div class="panel-head"><h2>Dados do orçamento (todos os vendedores)</h2></div><div class="panel-body"><form id="cfgForm" class="grid g4">' +
      cfgField('banco', 'Dados bancários') + cfgField('validade_dias', 'Validade padrão (dias)') + cfgField('proximo_orcamento', 'Próximo número de orçamento') +
      cfgField('aviso_precos', 'Aviso da página 1', 'textarea') + cfgField('texto_impostos', 'Texto de impostos (página 2)', 'textarea') +
      cfgField('texto_autorizo', 'Texto de autorização', 'textarea') + cfgField('condicoes_comerciais', 'Condições comerciais (aparecem no PDF se preenchidas)', 'textarea') +
      '<div class="span-all"><button class="btn btn-primary" type="submit">' + icon('check') + 'Salvar configurações</button></div></form></div></section>' : '') +
    '</div>';
};
VIEWS.configuracoes.after = () => {
  $$('input[name=theme]').forEach(r => { r.onchange = () => { setTheme(r.value); toast('Tema salvo.'); }; });
  $('#perfilForm').onsubmit = async e => {
    e.preventDefault();
    const d = formData(e.target);
    if (d.cpf && !validaDoc(d.cpf)) return toast('CPF inválido.', 'err');
    const r = await run(() => api('updatePerfil', d));
    if (r) { S.user = r; store.set('vg_user', JSON.stringify(r)); upsert(S.data.usuarios, r); toast('Perfil atualizado.'); }
  };
  $('#senhaForm').onsubmit = async e => {
    e.preventDefault();
    const d = formData(e.target);
    if (d.nova.length < 6) return toast('A nova senha precisa ter pelo menos 6 caracteres.', 'err');
    if (d.nova !== d.nova2) return toast('As senhas novas não conferem.', 'err');
    if (await run(() => api('changePassword', d))) { e.target.reset(); toast('Senha alterada com sucesso.'); }
  };
  const cf = $('#cfgForm');
  if (cf) cf.onsubmit = async e => {
    e.preventDefault();
    const r = await run(() => api('saveConfig', formData(cf)));
    if (r) { S.data.config = r; toast('Configurações salvas.'); }
  };
};

/* ===== 9.11 Administração ===== */
VIEWS.admin = () => {
  const t = today(), lim = addDays(-30);
  const rows = S.data.usuarios.map(u => {
    const cl = S.data.clientes.filter(c => c.usuarioVendedor === u.usuario);
    const pr = S.data.propostas.filter(p => p.usuarioVendedor === u.usuario);
    return {
      u, clientes: cl.length, ativos: cl.filter(c => !ENCERRADOS.includes(c.status)).length, ganhos: cl.filter(c => c.status === 'Cliente ganho').length,
      atrasados: cl.filter(c => c.dataProximoContato && c.dataProximoContato.slice(0, 10) < t && !ENCERRADOS.includes(c.status)).length,
      contatos: S.data.atividades.filter(a => a.usuarioVendedor === u.usuario && a.data.slice(0, 10) >= lim).length,
      propostas: pr.length, valor: pr.reduce((s, p) => s + num(p.valorFinal), 0)
    };
  });
  return pageHead('Administração', 'Equipe comercial, carteiras e acessos.', '<button class="btn btn-primary" data-act="new-usuario">' + icon('userplus') + 'Novo usuário</button>') +
    '<section class="panel"><div class="table-wrap"><table class="tbl responsive"><thead><tr><th>Usuário</th><th class="right">Clientes</th><th class="right">Em andamento</th><th class="right">Ganhos</th><th class="right">Atrasados</th><th class="right">Contatos (30d)</th><th class="right">Propostas</th><th class="right">Valor</th><th>Status</th><th></th></tr></thead><tbody>' +
    rows.map(r => '<tr><td class="cell-main"><strong>' + esc(r.u.nome) + (r.u.perfil === 'admin' ? ' <span class="tag">Admin</span>' : '') + '</strong><small>' + esc(r.u.usuario + (r.u.email ? ' • ' + r.u.email : '')) + '</small></td>' +
      '<td data-label="Clientes" class="right num">' + r.clientes + '</td><td data-label="Em andamento" class="right num">' + r.ativos + '</td><td data-label="Ganhos" class="right num">' + r.ganhos + '</td>' +
      '<td data-label="Atrasados" class="right num ' + (r.atrasados ? 'late' : '') + '">' + r.atrasados + '</td><td data-label="Contatos (30d)" class="right num">' + r.contatos + '</td>' +
      '<td data-label="Propostas" class="right num">' + r.propostas + '</td><td data-label="Valor" class="right num nowrap">' + money(r.valor) + '</td>' +
      '<td data-label="Status"><span class="chip" style="--c:' + (r.u.status === 'Ativo' ? '#22b35e' : '#6b7280') + '">' + esc(r.u.status) + '</span></td>' +
      '<td class="row-actions-cell no-label"><div class="row-actions">' + (r.u.perfil !== 'admin' ? '<button class="btn btn-sm" data-act="scope-to" data-u="' + esc(r.u.usuario) + '">Ver carteira</button>' : '') +
      '<button class="btn-icon" data-act="edit-usuario" data-id="' + esc(r.u.id) + '" aria-label="Editar usuário">' + icon('edit') + '</button></div></td></tr>').join('') +
    '</tbody></table></div></section>' +
    '<p class="muted">Todos os clientes, prospecções, propostas e contatos da equipe ficam visíveis ao administrador. Use o seletor no topo para filtrar por vendedor em qualquer tela.</p>';
};
function openUsuarioForm(id) {
  const u = id ? byId(S.data.usuarios, id) : { perfil: 'vendedor', status: 'Ativo' };
  const f = (n, l, t = 'text') => '<label class="field"><span>' + l + '</span><input name="' + n + '" type="' + t + '" value="' + esc(u[n] || '') + '"></label>';
  const m = openModal({
    title: id ? 'Editar usuário' : 'Novo usuário', body: '<form id="usrForm" class="grid g2">' + f('nome', 'Nome de exibição') + f('usuario', 'Usuário (login)') +
      '<label class="field"><span>Perfil</span><select name="perfil">' + options([{ v: 'vendedor', l: 'Vendedor' }, { v: 'admin', l: 'Administrador' }], u.perfil, null) + '</select></label>' +
      '<label class="field"><span>Status</span><select name="status">' + options(['Ativo', 'Inativo'], u.status, null) + '</select></label>' +
      '<label class="field span2"><span>Nome completo (PDF)</span><input name="nomeCompleto" value="' + esc(u.nomeCompleto || '') + '"></label>' +
      f('codigo', 'Código') + f('email', 'E-mail', 'email') + f('telefone', 'Telefone', 'tel') + f('cpf', 'CPF') +
      '<label class="field span2"><span>' + (id ? 'Nova senha (deixe vazio para manter)' : 'Senha inicial') + '</span><input name="novaSenha" type="password" autocomplete="new-password"></label></form>',
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-save>' + icon('check') + 'Salvar usuário</button>'
  });
  $('[data-save]', m).onclick = async () => {
    const d = formData($('#usrForm', m));
    d.id = id || '';
    const r = await run(() => api('saveUsuario', d));
    if (!r) return;
    upsert(S.data.usuarios, r);
    closeModal(m);
    toast('Usuário salvo.');
    renderShell();
    refreshAll();
  };
}

/* ---------- 11. Eventos globais, instalação e inicialização ---------- */
const UI = {
  go: el => { if (el.dataset.view === 'importar') S.impResult = null; go(el.dataset.view, el.dataset.param || ''); },
  'open-menu': () => $('#app').classList.add('menu-open'),
  'close-menu': () => $('#app').classList.remove('menu-open'),
  logout: () => logout(),
  sync: async () => {
    const ok = await run(() => loadData().then(() => true));
    if (!ok) return;
    renderShell(); refreshAll(); toast('Dados atualizados.');
    if (S.route.view === 'dashboard') refreshDashboard();
  },
  'theme-cycle': () => cycleTheme(),
  'server-config': () => openServerConfig(),
  'toggle-pass': el => { const i = $('#loginPass'); i.type = i.type === 'password' ? 'text' : 'password'; el.innerHTML = icon(i.type === 'password' ? 'eye' : 'eyeoff'); },
  install: () => installApp(),
  'clear-cache': async () => { if (await confirmDialog('Remover os dados guardados neste aparelho (cache e sessão)? Os dados da planilha não são afetados.', { ok: 'Limpar' })) { clearSession(); if (window.caches) (await caches.keys()).forEach(k => caches.delete(k)); location.reload(); } },
  kpi: el => { const k = KPIS[+el.dataset.i]; if (k.filtro) S.clienteFiltro = Object.assign({ q: '', status: '', agenda: '' }, k.filtro); go(k.go); },
  'new-cliente': () => openClienteForm(),
  'edit-cliente': el => openClienteForm(el.dataset.id),
  'open-cliente': el => { $('#searchResults').hidden = true; openFicha(el.dataset.id); },
  'delete-cliente': el => deleteCliente(el.dataset.id),
  'ficha-tab': el => { S.ficha.tab = el.dataset.tab; drawFicha(); },
  'new-atividade': el => openAtividadeForm(el.dataset.id),
  'delete-atividade': el => deleteAtividade(el.dataset.id),
  'new-prospeccao': el => openProspeccaoForm(el.dataset.id),
  'edit-prospeccao': el => openProspeccaoForm(null, el.dataset.id),
  'delete-prospeccao': el => deleteProspeccao(el.dataset.id),
  whatsapp: el => openWhatsApp(el.dataset.id),
  'proposta-cliente': el => escolherTipoOrcamento(el.dataset.id),
  'tipo-orc': el => { const id = el.dataset.id; modals.slice().forEach(m => closeModal(m)); go('propostas', 'nova/' + (id || '-') + '/' + el.dataset.tipo); },
  'pdf-proposta': el => gerarPdfProposta(el.dataset.id),
  'edit-proposta': el => { modals.slice().forEach(m => closeModal(m)); go('propostas', 'editar/' + el.dataset.id); },
  'dup-proposta': el => { modals.slice().forEach(m => closeModal(m)); go('propostas', 'duplicar/' + el.dataset.id); },
  'delete-proposta': el => deleteProposta(el.dataset.id),
  'contrato-proposta': el => openContratoModal(el.dataset.id),
  'prop-item-livre': () => { S.prop.itens.push({ produtoId: '', codigo: '', descricao: '', tipo: 'Produto', unidade: 'UN', quantidade: 1, valorUnitario: 0, desconto: 0, locado: false }); drawPropItens(); const l = $$('#pItens [data-f=descricao]').pop(); if (l) l.focus(); },
  'prop-item-del': el => { S.prop.itens.splice(+el.dataset.idx, 1); drawPropItens(); },
  'cond-add': el => addCondicao(el.dataset.tipo),
  'cond-del': el => { S.prop.condicoes.splice(+el.dataset.ci, 1); drawPropConds(); },
  'prop-obs-cliente': () => { const c = byId(S.data.clientes, S.prop.clienteId); if (c) { S.prop.obsCliente = c.obsCliente; $('#pObs').value = c.obsCliente; toast('Observações do cadastro inseridas.'); } },
  'prop-preview': () => { if (!S.prop.itens.length) return toast('Adicione itens para visualizar.', 'warn'); gerarPdfProposta(null, true); },
  'prop-save': el => salvarProposta(el.dataset.pdf === '1'),
  'cli-more': () => { S.cliLimite += 60; drawClientes(); },
  'prod-more': () => { S.prodLimite += 100; drawProdutos(); },
  'export-clientes': () => exportClientes(),
  'search-all': () => searchAll(),
  'new-produto': () => openProdutoForm(),
  'edit-produto': el => openProdutoForm(el.dataset.id),
  'delete-produto': el => deleteProduto(el.dataset.id),
  'export-produtos': () => exportProdutos(),
  'prs-tab': el => { S.prsTab = el.dataset.tab; render(); },
  'csv-modelo': () => csvModelo(),
  'csv-cancel': () => { S.imp = null; render(); },
  'csv-import': () => confirmImport(),
  'rel-csv': () => relCSV(),
  'rel-pdf': () => relPDF(),
  'rel-periodo': el => relPeriodo(el.dataset.d),
  'new-usuario': () => openUsuarioForm(),
  'edit-usuario': el => openUsuarioForm(el.dataset.id),
  'scope-to': el => { S.scope = el.dataset.u; $('#scopeSelect').value = S.scope; S.dash = null; go('dashboard'); }
};

function bindGlobalEvents() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (act === 'noop') return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
    // Cartões arrastáveis e linhas: não abre a ficha quando o clique foi num controle interno
    if (act === 'open-cliente' && e.target.closest('select, input, textarea')) return;
    const fn = UI[act];
    if (fn) fn(el, e);
  });
  document.addEventListener('change', e => {
    const s = e.target;
    if (s.matches('select[data-status-cliente]')) changeStatus(s.dataset.id, s.value);
    if (s.matches('select[data-status-proposta]')) changePropStatus(s.dataset.id, s.value);
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset && el.dataset.mask) {
      const end = el.selectionStart === el.value.length;
      el.value = applyMask(el.dataset.mask, el.value);
      if (end) el.setSelectionRange(el.value.length, el.value.length);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modals.length) closeModal(); });
  $('#loginForm').addEventListener('submit', doLogin);
  $('#scopeSelect').addEventListener('change', e => { S.scope = e.target.value; S.dash = null; refreshAll(); if (S.route.view === 'dashboard') refreshDashboard(); });
  window.addEventListener('hashchange', () => { modals.slice().forEach(m => closeModal(m)); render(); });
  // Ao voltar para o app (celular), sincroniza em segundo plano
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.user && Date.now() - last > 120000) {
      last = Date.now();
      run(() => loadData(true)).then(() => { if (!modals.length) refreshAll(); });
    }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (store.get('vg_theme', 'auto') === 'auto') applyTheme('auto'); });
}

/* Instalação do app (PWA) */
function updateInstallButton() {
  const b = $('#installBtn');
  if (!b) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  b.hidden = standalone || !(S.installPrompt || isIOS);
  b.innerHTML = icon('install') + '<span>Instalar aplicativo</span>';
}
async function installApp() {
  if (S.installPrompt) {
    S.installPrompt.prompt();
    const r = await S.installPrompt.userChoice;
    if (r.outcome === 'accepted') toast('Aplicativo instalado.');
    S.installPrompt = null;
    updateInstallButton();
    return;
  }
  openModal({
    title: 'Instalar no celular', size: 'sm',
    body: /iphone|ipad|ipod/i.test(navigator.userAgent)
      ? '<p style="margin-top:0">No iPhone/iPad (Safari):</p><ol><li>Toque no botão <strong>Compartilhar</strong> (quadrado com seta).</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Toque em <strong>Adicionar</strong>.</li></ol>'
      : '<p style="margin-top:0">No Android (Chrome):</p><ol><li>Toque no menu <strong>⋮</strong> do navegador.</li><li>Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li></ol><p class="muted">O sistema precisa estar publicado em HTTPS (ex.: GitHub Pages).</p>',
    foot: '<button class="btn btn-primary" data-close>Entendi</button>'
  });
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installPrompt = e; updateInstallButton(); });
window.addEventListener('appinstalled', () => { S.installPrompt = null; updateInstallButton(); toast('Aplicativo instalado na tela inicial.'); });

async function init() {
  applyTheme();
  bindGlobalEvents();
  bindGlobalSearch();
  $('[data-act=toggle-pass]').innerHTML = icon('eye');
  const token = store.get('vg_token'), user = store.get('vg_user');
  if (token && user) {
    S.token = token;
    try { S.user = JSON.parse(user); } catch (e) { S.user = null; }
  }
  if (S.token && S.user) await startApp(); else showLogin();
  if (!getApiUrl() && !S.user) setTimeout(openServerConfig, 400);
  const sp = $('#splash');
  sp.classList.add('hide');
  setTimeout(() => sp.remove(), 400);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem service worker: app funciona normalmente online */ });
  }
}
document.addEventListener('DOMContentLoaded', init);
