/* ==========================================================================
   VEGAS VIGILÂNCIA — PROSPECÇÃO DE CLIENTES
   contratos.js — contratos em PDF a partir dos modelos Word (.docx)
   --------------------------------------------------------------------------
   Como funciona
   1. O modelo fica em assets/contratos/*.docx (editável no Word).
   2. O app abre o .docx no navegador (JSZip), lê parágrafos, negrito,
      alinhamento, recuos, espaçamentos e tabelas.
   3. Troca os campos de mesclagem pelos dados do cliente, da proposta e do
      contrato e preenche as tabelas de equipamentos/veículos.
   4. Desenha o PDF no papel timbrado Vegas, com fonte Caladea (mesma medida
      da Cambria usada nos modelos).

   Campos aceitos nos modelos
     CLI.NOME / Cli.NOME, Cli.CGCCPF, Cli.InscriçãoEstadual, Cli.InscriçãoMunicipal,
     Cli.Endereço, Cli.NumCasa, Cli.Complemento, Cli.Bairro, Cli.Cidade, Cli.Estado,
     Cli.CEP, Cli.Telefone, Cli.Email, Cli.Representante, Cli.RepCPF, Cli.RepRG,
     Cli.RepCargo, Cli.RepNacionalidade, Cli.RepEstadoCivil, Cli.RepProfissao, Cli.ValorME, vExtensoValorME, CONTR.Prazo, CONTR.PrazoExtenso,
     CONTR.DiasRetencao, CONTR.ComInstalacao, CONTR.SemInstalacao, CONTR.Local,
     CONTR.DataExtenso, CONTR.Data
   Trechos condicionais
     [[PJ|texto]]  aparece só para pessoa jurídica
     [[PF|texto]]  aparece só para pessoa física
     [[OPC|texto]] aparece só se os campos dentro dele estiverem preenchidos
   Tabelas: cabeçalhos "Código / Descrição / Qtde / Unidade / Locado / Valor…"
   recebem os equipamentos da proposta; "Placa / Marca / Modelo…" recebem
   os veículos informados na tela do contrato.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Catálogo de contratos ---------- */
  const CONTRATOS = [
    { id: 'camera_pf', grupo: 'Câmeras (CFTV) em comodato', pessoa: 'PF', arquivo: 'camera_pf.docx', prazo: 12 },
    { id: 'camera_pj', grupo: 'Câmeras (CFTV) em comodato', pessoa: 'PJ', arquivo: 'camera_pj.docx', prazo: 12 },
    { id: 'alarme_pf', grupo: 'Alarme monitorado com equipamentos em comodato', pessoa: 'PF', arquivo: 'alarme_pf.docx', prazo: 12 },
    { id: 'alarme_pj', grupo: 'Alarme monitorado com equipamentos em comodato', pessoa: 'PJ', arquivo: 'alarme_pj.docx', prazo: 12 },
    { id: 'monitoramento_pf', grupo: 'Somente monitoramento (equipamento do cliente)', pessoa: 'PF', arquivo: 'monitoramento_pf.docx', prazo: 12 },
    { id: 'monitoramento_pj', grupo: 'Somente monitoramento (equipamento do cliente)', pessoa: 'PJ', arquivo: 'monitoramento_pj.docx', prazo: 12 },
    { id: 'rastreamento', grupo: 'Rastreamento veicular', pessoa: 'AMBOS', arquivo: 'rastreamento.docx', prazo: 12 },
    { id: 'manutencao_cftv', grupo: 'Manutenção de CFTV', pessoa: 'PJ', arquivo: 'manutencao_cftv.docx', prazo: 24 }
  ];
  const PESSOA_LBL = { PF: 'Pessoa física', PJ: 'Pessoa jurídica', AMBOS: 'Física ou jurídica' };
  const TOKEN_RE = /\b(?:CLI|Cli|CONTR)\.[A-Za-zÀ-ÿ]+|\bvExtensoValorME\b/g;
  const COND_RE = /\[\[(PJ|PF|OPC)\|([\s\S]*?)\]\]/g;

  /* ---------- Utilitários ---------- */
  const dig = v => String(v == null ? '' : v).replace(/\D/g, '');
  const up = v => String(v == null ? '' : v).trim().toUpperCase();
  const nrm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9º°]+/g, ' ').trim();
  const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function cpfOk(v) {
    const d = dig(v);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +d[t]) return false; }
    return true;
  }
  function cnpjOk(v) {
    const d = dig(v);
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const calc = len => { const p = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = p.reduce((a, w, i) => a + +d[i] * w, 0) % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }
  const fmtCPF = v => { const d = dig(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : v; };
  const fmtDoc = v => { const d = dig(v); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : fmtCPF(v); };
  const fmtFone = v => { const d = dig(v).slice(-11); return d.length === 11 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7) : d.length === 10 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6) : v; };
  const fmtCEP = v => { const d = dig(v); return d.length === 8 ? d.slice(0, 2) + '.' + d.slice(2, 5) + '-' + d.slice(5) : v; };

  /* ---------- Número por extenso (português) ---------- */
  const UN = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const DZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const CT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  function ate999(n) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, p = [];
    if (c) p.push(CT[c]);
    if (r) p.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : ''));
    return p.join(' e ');
  }
  function extensoInteiro(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'zero';
    const grupos = [[Math.floor(n / 1e9) % 1000, 'bilhão', 'bilhões'], [Math.floor(n / 1e6) % 1000, 'milhão', 'milhões'], [Math.floor(n / 1e3) % 1000, 'mil', 'mil'], [n % 1000, '', '']];
    const partes = [];
    grupos.forEach(([v, s, pl]) => {
      if (!v) return;
      if (s === 'mil') partes.push({ v, t: v === 1 ? 'mil' : ate999(v) + ' mil' });
      else partes.push({ v, t: ate999(v) + (s ? ' ' + (v === 1 ? s : pl) : '') });
    });
    return partes.map((p, i) => {
      if (i === 0) return p.t;
      const ultimo = i === partes.length - 1;
      return (ultimo && (p.v < 100 || p.v % 100 === 0) ? ' e ' : ', ') + p.t;
    }).join('');
  }
  function extensoReais(valor) {
    const tot = Math.round((Number(valor) || 0) * 100);
    const r = Math.floor(tot / 100), c = tot % 100;
    const pr = [];
    if (r) pr.push(extensoInteiro(r) + (r % 1e6 === 0 ? ' de' : '') + (r === 1 ? ' real' : ' reais'));
    if (c) pr.push(extensoInteiro(c) + (c === 1 ? ' centavo' : ' centavos'));
    return pr.join(' e ') || 'zero reais';
  }
  const dataExtenso = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return d + ' de ' + MESES[m - 1] + ' de ' + y; };

  /* ---------- Leitura do .docx ---------- */
  let jszipPromise = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!jszipPromise) jszipPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error('Não foi possível carregar o leitor de Word (sem internet?).'));
      document.head.appendChild(s);
    });
    return jszipPromise;
  }
  const kids = (el, name) => el ? Array.from(el.childNodes).filter(n => n.nodeType === 1 && n.localName === name) : [];
  const kid = (el, name) => kids(el, name)[0] || null;
  const at = (el, name) => el ? (el.getAttribute('w:' + name) ?? null) : null;
  const tw = v => (v == null || v === '' ? null : Number(v) / 20);   // twips → pontos
  const onOff = el => el ? !['0', 'false', 'off'].includes(at(el, 'val')) : undefined;

  function readPPr(pPr) {
    const o = {};
    if (!pPr) return o;
    const jc = kid(pPr, 'jc'); if (jc) o.jc = at(jc, 'val');
    const sp = kid(pPr, 'spacing');
    if (sp) {
      if (at(sp, 'before') != null) o.before = tw(at(sp, 'before'));
      if (at(sp, 'after') != null) o.after = tw(at(sp, 'after'));
      if (at(sp, 'line') != null) { o.line = Number(at(sp, 'line')); o.lineRule = at(sp, 'lineRule') || 'auto'; }
    }
    const ind = kid(pPr, 'ind');
    if (ind) {
      const l = at(ind, 'left') ?? at(ind, 'start'), r = at(ind, 'right') ?? at(ind, 'end');
      if (l != null) o.indL = tw(l); if (r != null) o.indR = tw(r);
      if (at(ind, 'firstLine') != null) o.first = tw(at(ind, 'firstLine'));
      if (at(ind, 'hanging') != null) o.first = -tw(at(ind, 'hanging'));
    }
    if (kid(pPr, 'keepNext')) o.keepNext = onOff(kid(pPr, 'keepNext'));
    if (kid(pPr, 'pageBreakBefore')) o.pageBreakBefore = onOff(kid(pPr, 'pageBreakBefore'));
    const ps = kid(pPr, 'pStyle'); if (ps) o.style = at(ps, 'val');
    return o;
  }
  function readRPr(rPr) {
    const o = {};
    if (!rPr) return o;
    ['b', 'i', 'caps'].forEach(k => { const e = kid(rPr, k); if (e) o[k] = onOff(e); });
    const u = kid(rPr, 'u'); if (u) o.u = at(u, 'val') !== 'none';
    const sz = kid(rPr, 'sz'); if (sz) o.sz = Number(at(sz, 'val')) / 2;
    const f = kid(rPr, 'rFonts'); if (f && at(f, 'ascii')) o.font = at(f, 'ascii');
    const rs = kid(rPr, 'rStyle'); if (rs) o.rStyle = at(rs, 'val');
    return o;
  }
  function readStyles(xml) {
    const st = { p: {}, r: {}, defP: {}, defR: { sz: 11 }, map: {} };
    if (!xml) return st;
    const d = new DOMParser().parseFromString(xml, 'application/xml').documentElement;
    const dd = kid(d, 'docDefaults');
    if (dd) {
      Object.assign(st.defR, readRPr(kid(kid(dd, 'rPrDefault'), 'rPr')));
      Object.assign(st.defP, readPPr(kid(kid(dd, 'pPrDefault'), 'pPr')));
    }
    kids(d, 'style').forEach(s => {
      const id = at(s, 'styleId');
      const based = kid(s, 'basedOn');
      st.map[id] = { p: readPPr(kid(s, 'pPr')), r: readRPr(kid(s, 'rPr')), based: based ? at(based, 'val') : null, type: at(s, 'type'), def: at(s, 'default') === '1' };
      if (st.map[id].def && st.map[id].type === 'paragraph') st.defStyle = id;
    });
    return st;
  }
  function styleChain(st, id, kind) {
    const out = {}, chain = [];
    let cur = id, guard = 0;
    while (cur && st.map[cur] && guard++ < 10) { chain.unshift(st.map[cur]); cur = st.map[cur].based; }
    chain.forEach(s => Object.assign(out, s[kind]));
    return out;
  }
  function readParagraph(p, st) {
    const pPr = kid(p, 'pPr');
    const direct = readPPr(pPr);
    const sid = direct.style || st.defStyle;
    const pp = Object.assign({}, st.defP, styleChain(st, sid, 'p'), direct);
    const pr = Object.assign({}, st.defR, styleChain(st, sid, 'r'));
    const mark = Object.assign({}, pr, readRPr(kid(pPr, 'rPr')));
    const runs = [];
    const addRun = r => {
      const rp = Object.assign({}, pr, r.rStyle ? styleChain(st, r.rStyle, 'r') : {}, readRPr(kid(r, 'rPr')));
      let txt = '';
      Array.from(r.childNodes).forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.localName === 't') txt += n.textContent;
        else if (n.localName === 'tab') txt += '\t';
        else if (n.localName === 'br') txt += at(n, 'type') === 'page' ? '\f' : '\n';
        else if (n.localName === 'noBreakHyphen') txt += '-';
      });
      if (txt) runs.push({ text: txt, b: !!rp.b, i: !!rp.i, u: !!rp.u, caps: !!rp.caps, sz: rp.sz || 11, font: rp.font || '' });
    };
    const walk = el => Array.from(el.childNodes).forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.localName === 'r') addRun(n);
      else if (['hyperlink', 'ins', 'smartTag', 'fldSimple', 'sdt', 'sdtContent'].includes(n.localName)) walk(n);
    });
    walk(p);
    return { type: 'p', pp, runs, markSz: mark.sz || 11 };
  }
  function readTable(tbl, st) {
    const tblPr = kid(tbl, 'tblPr');
    const grid = kids(kid(tbl, 'tblGrid'), 'gridCol').map(g => tw(at(g, 'w')));
    const ind = kid(tblPr, 'tblInd');
    const bd = kid(tblPr, 'tblBorders');
    const borderOn = side => { const e = kid(bd, side); return e ? !['none', 'nil'].includes(at(e, 'val')) : false; };
    const borders = bd ? { top: borderOn('top'), bottom: borderOn('bottom'), left: borderOn('left'), right: borderOn('right'), h: borderOn('insideH'), v: borderOn('insideV') } : { top: false, bottom: false, left: false, right: false, h: false, v: false };
    const cm = kid(tblPr, 'tblCellMar');
    const defMar = { t: 0, b: 0, l: tw(at(kid(cm, 'left'), 'w')) ?? 5.4, r: tw(at(kid(cm, 'right'), 'w')) ?? 5.4 };
    const jcT = kid(tblPr, 'jc');
    const rows = kids(tbl, 'tr').map(tr => ({
      cells: kids(tr, 'tc').map(tc => {
        const tcPr = kid(tc, 'tcPr');
        const shd = kid(tcPr, 'shd'), mar = kid(tcPr, 'tcMar'), span = kid(tcPr, 'gridSpan');
        const m = side => { const e = kid(mar, side); return e ? tw(at(e, 'w')) : null; };
        return {
          span: span ? Number(at(span, 'val')) : 1,
          fill: shd && at(shd, 'fill') && at(shd, 'fill') !== 'auto' ? at(shd, 'fill') : null,
          mar: { t: m('top') ?? defMar.t, b: m('bottom') ?? defMar.b, l: m('left') ?? defMar.l, r: m('right') ?? defMar.r },
          blocks: kids(tc, 'p').map(p => readParagraph(p, st))
        };
      })
    }));
    return { type: 'tbl', grid, ind: ind ? tw(at(ind, 'w')) : 0, jc: jcT ? at(jcT, 'val') : null, borders, rows };
  }
  const cache = {};
  async function carregarModelo(arquivo) {
    if (cache[arquivo]) return cache[arquivo];
    const JSZip = await loadJSZip();
    const res = await fetch('assets/contratos/' + arquivo);
    if (!res.ok) throw new Error('Modelo "' + arquivo + '" não encontrado em assets/contratos.');
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const st = readStyles(zip.file('word/styles.xml') ? await zip.file('word/styles.xml').async('string') : null);
    const doc = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml').documentElement;
    const body = kid(doc, 'body');
    const blocks = [];
    let sect = null;
    Array.from(body.childNodes).forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.localName === 'p') blocks.push(readParagraph(n, st));
      else if (n.localName === 'tbl') blocks.push(readTable(n, st));
      else if (n.localName === 'sectPr') sect = n;
    });
    if (!sect) sect = body.getElementsByTagName('w:sectPr')[0];
    const pgSz = kid(sect, 'pgSz'), pgMar = kid(sect, 'pgMar');
    const page = {
      w: tw(at(pgSz, 'w')) || 595.3, h: tw(at(pgSz, 'h')) || 841.9,
      top: tw(at(pgMar, 'top')) ?? 72, bottom: tw(at(pgMar, 'bottom')) ?? 72, left: tw(at(pgMar, 'left')) ?? 72, right: tw(at(pgMar, 'right')) ?? 72
    };
    cache[arquivo] = { blocks, page };
    return cache[arquivo];
  }

  /* ---------- Substituição em runs (preserva negrito/estilo) ---------- */
  function replaceInRuns(runs, re, fn) {
    const full = runs.map(r => r.text).join('');
    const ms = [];
    full.replace(re, (...a) => { const m = a[0], off = a[a.length - 2]; ms.push({ s: off, e: off + m.length, rep: fn(...a) }); return m; });
    for (let k = ms.length - 1; k >= 0; k--) {
      const { s, e, rep } = ms[k];
      let pos = 0, first = true;
      for (const r of runs) {
        const a = pos, b = pos + r.text.length; pos = b;
        if (b < s || (b === s && !(first && a === s)) || a > e || (a === e && !first)) continue;
        const ls = Math.max(s, a) - a, le = Math.min(e, b) - a;
        if (first) { r.text = r.text.slice(0, ls) + rep + r.text.slice(le); first = false; }
        else r.text = r.text.slice(0, ls) + r.text.slice(le);
      }
    }
    return runs.filter(r => r.text !== '');
  }
  const eachParagraph = (blocks, fn) => blocks.forEach(b => {
    if (b.type === 'p') fn(b);
    else if (b.type === 'tbl') b.rows.forEach(r => r.cells.forEach(c => eachParagraph(c.blocks, fn)));
  });
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- Dados: campos → valores ---------- */
  function pessoaDoCliente(c, def) {
    const d = dig(c.documento);
    if (d.length === 14) return 'PJ';
    if (d.length === 11) return 'PF';
    return def === 'PJ' ? 'PJ' : 'PF';
  }
  /** Definição de cada campo: rótulo, onde se corrige e como obter o valor. */
  function campos(ctx) {
    const c = ctx.cliente, pj = ctx.pessoa === 'PJ', P = ctx.proposta, par = ctx.params;
    const nome = up(pj ? (c.razaoSocial || c.empresa) : (c.empresa || c.razaoSocial));
    const doc = dig(c.documento);
    const docOk = ctx.def.pessoa === 'PF' ? cpfOk(doc) : ctx.def.pessoa === 'PJ' ? cnpjOk(doc) : (cpfOk(doc) || cnpjOk(doc));
    const docMsg = !doc ? '' : docOk ? '' : ctx.def.pessoa === 'PF' && doc.length === 14 ? 'O cliente tem CNPJ: use o contrato de pessoa jurídica.'
      : ctx.def.pessoa === 'PJ' && doc.length === 11 ? 'O cliente tem CPF: use o contrato de pessoa física.' : 'Documento inválido.';
    const mensal = Number(P.totalMensal != null ? P.totalMensal : (Number(P.valorMensal) || 0) + (Number(P.outrosMensal) || 0)) || 0;
    const prazo = parseInt(par.prazo, 10);
    const C = (label, campo, valor, extra) => Object.assign({ label, onde: 'cliente', campo, valor }, extra || {});
    return {
      'NOME': C(pj ? 'Razão social / nome do cliente' : 'Nome do cliente', pj && !c.razaoSocial ? 'razaoSocial' : 'empresa', nome),
      'CGCCPF': C(ctx.def.pessoa === 'AMBOS' ? 'CPF/CNPJ' : pj ? 'CNPJ' : 'CPF', 'documento', docOk ? fmtDoc(doc) : '', { erro: docMsg }),
      'InscriçãoEstadual': C(ctx.def.pessoa === 'AMBOS' ? 'RG / Inscrição estadual' : pj ? 'Inscrição estadual' : 'RG', 'inscricao', up(c.inscricao)),
      'InscriçãoMunicipal': C('Inscrição municipal', 'inscricaoMunicipal', up(c.inscricaoMunicipal)),
      'Endereço': C('Endereço', 'endereco', up(c.endereco)),
      'NumCasa': C('Número', 'numero', up(c.numero)),
      'Complemento': C('Complemento', 'complemento', up(c.complemento)),
      'Bairro': C('Bairro', 'bairro', up(c.bairro)),
      'Cidade': C('Cidade', 'cidade', up(c.cidade)),
      'Estado': C('Estado (UF)', 'estado', up(c.estado)),
      'CEP': C('CEP', 'cep', dig(c.cep).length === 8 ? fmtCEP(c.cep) : ''),
      'Telefone': C('Telefone / WhatsApp', 'telefone', (c.whatsapp || c.telefone) && dig(c.whatsapp || c.telefone).length >= 10 ? fmtFone(c.whatsapp || c.telefone) : ''),
      'Email': C('E-mail', 'email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '') ? String(c.email).toLowerCase() : ''),
      'Representante': C('Representante legal', 'representante', up(c.representante)),
      'RepCPF': C('CPF do representante', 'representanteCpf', cpfOk(c.representanteCpf) ? fmtCPF(c.representanteCpf) : '', { erro: c.representanteCpf && !cpfOk(c.representanteCpf) ? 'CPF do representante inválido.' : '' }),
      'RepRG': C('RG do representante', 'representanteRg', up(c.representanteRg)),
      'RepCargo': C('Cargo do representante', 'representanteCargo', up(c.representanteCargo)),
      'RepNacionalidade': C('Nacionalidade do representante', 'representanteNacionalidade', String(c.representanteNacionalidade || '').trim().toLowerCase()),
      'RepEstadoCivil': C('Estado civil do representante', 'representanteEstadoCivil', String(c.representanteEstadoCivil || '').trim().toLowerCase()),
      'RepProfissao': C('Profissão do representante', 'representanteProfissao', String(c.representanteProfissao || '').trim().toLowerCase()),
      'ValorME': { label: 'Valor mensal na proposta', onde: 'proposta', valor: mensal > 0 ? brl(mensal) : '' },
      'vExtensoValorME': { label: 'Valor mensal na proposta', onde: 'proposta', valor: mensal > 0 ? extensoReais(mensal) : '' },
      'Prazo': { label: 'Prazo do contrato (meses)', onde: 'contrato', valor: prazo > 0 ? String(prazo) : '' },
      'PrazoExtenso': { label: 'Prazo do contrato (meses)', onde: 'contrato', valor: prazo > 0 ? extensoInteiro(prazo) : '' },
      'DiasRetencao': { label: 'Dias de retenção das imagens', onde: 'contrato', valor: parseInt(par.dias, 10) > 0 ? String(parseInt(par.dias, 10)) : '' },
      'ComInstalacao': { label: 'Modalidade de instalação', onde: 'contrato', valor: par.instalacao ? (par.instalacao === 'com' ? 'X' : ' ') : '' },
      'SemInstalacao': { label: 'Modalidade de instalação', onde: 'contrato', valor: par.instalacao ? (par.instalacao === 'sem' ? 'X' : ' ') : '' },
      'Local': { label: 'Local de assinatura', onde: 'contrato', valor: par.local || '' },
      'DataExtenso': { label: 'Data do contrato', onde: 'contrato', valor: par.data ? dataExtenso(par.data) : '' },
      'Data': { label: 'Data do contrato', onde: 'contrato', valor: par.data ? par.data.split('-').reverse().join('/') : '' }
    };
  }
  const chave = tok => tok.replace(/^(CLI|Cli|CONTR)\./, '');

  /* ---------- Tabelas de equipamentos e veículos ---------- */
  const COLUNAS = [
    [/^codigo/, 'codigo'], [/serie/, 'serie'], [/^qtd|^qtde|^quant/, 'qtd'], [/^unidade|^un$|^und/, 'unidade'], [/^locado/, 'locado'],
    [/valor unit/, 'unit'], [/valor total|reposicao/, 'total'], [/^descri|^produto|^equipamento/, 'descricao'],
    [/^placa/, 'placa'], [/marca|modelo/, 'modelo'], [/^ano/, 'ano'], [/^cor$/, 'cor'], [/^chassi/, 'chassi'], [/^renavam/, 'renavam']
  ];
  const cellText = cell => cell.blocks.map(b => b.runs.map(r => r.text).join('')).join(' ').trim();
  function tipoTabela(t) {
    if (!t.rows.length) return null;
    const cols = t.rows[0].cells.map(c => { const n = nrm(cellText(c)); const f = COLUNAS.find(([re]) => re.test(n)); return f ? f[1] : null; });
    const corpoVazio = t.rows.slice(1).every(r => r.cells.every(c => /^(r\$)?\s*$/i.test(cellText(c))));
    if (!corpoVazio || t.rows.length < 2) return null;
    if (cols.includes('placa')) return { tipo: 'veiculos', cols };
    if (cols.includes('codigo') && cols.includes('descricao')) return { tipo: 'equipamentos', cols };
    return null;
  }
  function preencherTabela(t, info, linhas) {
    const modelo = t.rows[1];
    const novas = (linhas.length ? linhas : [{}]).map(l => {
      const row = clone(modelo);
      row.cells.forEach((cell, i) => {
        const v = l[info.cols[i]] == null ? '' : String(l[info.cols[i]]);
        const p = cell.blocks[0] || { type: 'p', pp: {}, runs: [], markSz: 11 };
        const base = p.runs[0] || { b: false, i: false, u: false, caps: false, sz: p.markSz || 11, font: '' };
        p.runs = v ? [Object.assign({}, base, { text: v, b: false })] : [];
        cell.blocks = [p];
      });
      return row;
    });
    t.rows = [t.rows[0]].concat(novas);
  }
  function linhasEquipamentos(P) {
    return (P.itens || []).filter(i => i.tipo !== 'Serviço' && String(i.descricao || '').trim()).map(i => {
      const q = Number(i.quantidade) || 1, u = Number(i.valorUnitario) || 0;
      return { codigo: i.codigo || '', descricao: up(i.descricao), qtd: Number.isInteger(q) ? String(q) : brl(q), unidade: up(i.unidade || 'UN'), locado: i.locado ? 'Sim' : 'Não', unit: 'R$ ' + brl(u), total: 'R$ ' + brl(u * q), serie: '' };
    });
  }

  /* ---------- Montagem: modelo + dados ---------- */
  async function preparar(def, cliente, proposta, params) {
    const modelo = await carregarModelo(def.arquivo);
    const blocks = clone(modelo.blocks);
    const ctx = { def, cliente, proposta, params, pessoa: def.pessoa === 'AMBOS' ? pessoaDoCliente(cliente, 'PF') : def.pessoa };
    const C = campos(ctx);
    const usados = new Set(), opcionais = new Set(), desconhecidos = new Set();
    // 1) Trechos condicionais
    eachParagraph(blocks, p => {
      p.runs = replaceInRuns(p.runs, COND_RE, (m, tipo, inner) => {
        if (tipo === 'OPC') {
          const toks = inner.match(TOKEN_RE) || [];
          toks.forEach(t => opcionais.add(chave(t)));
          return toks.every(t => C[chave(t)] && C[chave(t)].valor) ? inner : '';
        }
        return tipo === ctx.pessoa ? inner : '';
      });
    });
    // 2) Campos
    eachParagraph(blocks, p => {
      p.runs.map(r => r.text).join('').replace(TOKEN_RE, t => { const k = chave(t); if (!C[k]) desconhecidos.add(t); else if (!opcionais.has(k)) usados.add(k); return t; });
      p.runs = replaceInRuns(p.runs, TOKEN_RE, t => { const k = chave(t); return C[k] ? C[k].valor : t; });
    });
    // 3) Tabelas
    const tabelas = { equipamentos: false, veiculos: false };
    const equip = linhasEquipamentos(proposta);
    const veic = (params.veiculos || []).filter(v => v.placa || v.modelo).map(v => ({ placa: up(v.placa), modelo: up(v.modelo), ano: v.ano || '', cor: up(v.cor), chassi: up(v.chassi), renavam: v.renavam || '' }));
    blocks.forEach(b => {
      if (b.type !== 'tbl') return;
      const info = tipoTabela(b);
      if (!info) return;
      tabelas[info.tipo] = true;
      preencherTabela(b, info, info.tipo === 'veiculos' ? veic : equip);
    });
    // 4) Pendências
    const pend = [];
    const vistos = new Set();
    usados.forEach(k => {
      const f = C[k];
      const id = f.label;
      if (vistos.has(id)) return;
      vistos.add(id);
      pend.push({ label: f.label, onde: f.onde, campo: f.campo, ok: !!f.valor && !f.erro, erro: f.erro || '' });
    });
    if (tabelas.equipamentos) pend.push({ label: 'Equipamentos na proposta', onde: 'proposta', ok: equip.length > 0 });
    if (tabelas.veiculos) pend.push({ label: 'Veículo(s) a rastrear (placa e marca/modelo)', onde: 'contrato', ok: veic.length > 0 && veic.every(v => v.placa && v.modelo) });
    desconhecidos.forEach(t => pend.push({ label: 'Campo "' + t + '" do modelo não é reconhecido', onde: 'modelo', ok: false }));
    const precisa = { prazo: usados.has('Prazo'), dias: usados.has('DiasRetencao'), instalacao: usados.has('ComInstalacao') || usados.has('SemInstalacao'), veiculos: tabelas.veiculos };
    return { blocks, page: modelo.page, pend, precisa, pessoa: ctx.pessoa, ok: pend.every(p => p.ok) };
  }

  /* ---------- Renderização em PDF ---------- */
  const FONTES = {
    Caladea: { normal: 'Caladea-Regular.ttf', bold: 'Caladea-Bold.ttf', italic: 'Caladea-Italic.ttf', bolditalic: 'Caladea-BoldItalic.ttf' },
    Carlito: { normal: 'Carlito-Regular.ttf', bold: 'Carlito-Bold.ttf', italic: 'Carlito-Italic.ttf', bolditalic: 'Carlito-BoldItalic.ttf' }
  };
  const fontData = {};
  let fundo = null;
  async function recursos() {
    const b64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
    const jobs = [];
    Object.values(FONTES).forEach(f => Object.values(f).forEach(arq => {
      if (!fontData[arq]) jobs.push(fetch('assets/fonts/' + arq).then(r => r.ok ? r.arrayBuffer() : null).then(x => { if (x) fontData[arq] = b64(x); }).catch(() => {}));
    }));
    if (!fundo) jobs.push(fetch('assets/pdf-fundo.jpg').then(r => r.ok ? r.blob() : null).then(bl => bl && new Promise(res => { const fr = new FileReader(); fr.onload = () => { fundo = fr.result; res(); }; fr.readAsDataURL(bl); })).catch(() => {}));
    await Promise.all(jobs);
  }
  const familia = font => /calibri|carlito|arial|liberation sans|tahoma|helvetica|verdana/i.test(font || '') ? 'Carlito' : 'Caladea';

  async function gerarPDF(montado, titulo) {
    await recursos();
    const { jsPDF } = window.jspdf;
    const pg = montado.page;
    const doc = new jsPDF({ unit: 'pt', format: [pg.w, pg.h], compress: true });
    const disponiveis = {};
    Object.entries(FONTES).forEach(([fam, st]) => Object.entries(st).forEach(([estilo, arq]) => {
      if (!fontData[arq]) return;
      doc.addFileToVFS(arq, fontData[arq]); doc.addFont(arq, fam, estilo);
      disponiveis[fam + estilo] = true;
    }));
    const setFonte = r => {
      let fam = familia(r.font), est = r.b && r.i ? 'bolditalic' : r.b ? 'bold' : r.i ? 'italic' : 'normal';
      if (!disponiveis[fam + est]) { if (disponiveis[fam + (r.b ? 'bold' : 'normal')]) est = r.b ? 'bold' : 'normal'; else { fam = 'times'; } }
      doc.setFont(fam, est); doc.setFontSize(r.sz);
    };
    const larguras = {};
    const medir = (txt, r) => {
      const k = familia(r.font) + (r.b ? 1 : 0) + (r.i ? 1 : 0) + r.sz + '|' + txt;
      if (larguras[k] == null) { setFonte(r); larguras[k] = doc.getTextWidth(txt); }
      return larguras[k];
    };
    doc.setProperties({ title: titulo, author: 'Vegas Vigilância e Segurança', creator: 'Vegas Prospecção' });
    const pintarFundo = () => { if (fundo) doc.addImage(fundo, 'JPEG', 0, 0, pg.w, pg.h, 'VEGAS_FUNDO', 'FAST'); };
    pintarFundo();
    // O rodapé do timbrado (endereços e 0800) começa a ~112 pt do fim da página: o texto nunca invade essa área
    const X0 = pg.left, LARG = pg.w - pg.left - pg.right, TOPO = pg.top, FIM = Math.min(pg.h - pg.bottom, pg.h - 112);
    let y = TOPO;
    const novaPagina = () => { doc.addPage([pg.w, pg.h]); pintarFundo(); y = TOPO; };

    /** Quebra um parágrafo em linhas. Retorna linhas com palavras posicionadas. */
    function linhasDo(p, largura) {
      const pp = p.pp;
      const pedacos = [];
      p.runs.forEach(r => {
        const txt = r.caps ? r.text.toUpperCase() : r.text;
        txt.split(/(\s)/).forEach(s => { if (s !== '') pedacos.push({ t: s, r }); });
      });
      const linhas = [];
      let atual = { itens: [], w: 0 }, palavra = [], palavraW = 0;
      const indL = pp.indL || 0, indR = pp.indR || 0, first = pp.first || 0;
      const disp = () => largura - indL - indR - (linhas.length === 0 ? first : 0);
      const fecharPalavra = () => {
        if (!palavra.length) return;
        if (atual.w + palavraW > disp() + 0.01 && atual.itens.some(i => !i.esp)) {
          while (atual.itens.length && atual.itens[atual.itens.length - 1].esp) { atual.w -= atual.itens.pop().w; }
          linhas.push(atual); atual = { itens: [], w: 0 };
        }
        // palavra maior que a linha (ex.: linha de assinatura): quebra por caracteres
        if (palavraW > disp()) {
          palavra.forEach(pz => {
            let buf = '';
            for (const ch of pz.t) {
              const w = medir(buf + ch, pz.r);
              if (atual.w + w > disp() && (buf || atual.itens.length)) {
                if (buf) { atual.itens.push({ t: buf, r: pz.r, w: medir(buf, pz.r) }); atual.w += medir(buf, pz.r); }
                linhas.push(atual); atual = { itens: [], w: 0 }; buf = ch;
              } else buf += ch;
            }
            if (buf) { const w = medir(buf, pz.r); atual.itens.push({ t: buf, r: pz.r, w }); atual.w += w; }
          });
        } else palavra.forEach(pz => { atual.itens.push(pz); atual.w += pz.w; });
        palavra = []; palavraW = 0;
      };
      pedacos.forEach(pz => {
        if (pz.t === '\n' || pz.t === '\f') { fecharPalavra(); atual.quebra = true; linhas.push(atual); atual = { itens: [], w: 0 }; return; }
        if (/\s/.test(pz.t)) {
          fecharPalavra();
          if (pz.t === '\t') { const pos = (linhas.length === 0 ? first : 0) + atual.w; const prox = (Math.floor(pos / 35.4) + 1) * 35.4; const w = prox - pos; atual.itens.push({ t: ' ', r: pz.r, w, esp: true, tab: true }); atual.w += w; }
          else if (atual.itens.length) { const w = medir(' ', pz.r); atual.itens.push({ t: ' ', r: pz.r, w, esp: true }); atual.w += w; }
          return;
        }
        pz.w = medir(pz.t, pz.r); palavra.push(pz); palavraW += pz.w;
      });
      fecharPalavra();
      while (atual.itens.length && atual.itens[atual.itens.length - 1].esp && !atual.itens[atual.itens.length - 1].tab) atual.w -= atual.itens.pop().w;
      linhas.push(atual);
      return linhas;
    }
    function alturaLinha(p, linha) {
      const pp = p.pp;
      const sz = Math.max(p.markSz || 11, ...linha.itens.map(i => i.r.sz), 1);
      const natural = sz * 1.17;
      if (pp.line && pp.lineRule === 'exact') return pp.line / 20;
      if (pp.line && pp.lineRule === 'atLeast') return Math.max(pp.line / 20, natural);
      return natural * ((pp.line || 240) / 240);
    }
    /** Desenha (ou só mede, se desenhar=false) um parágrafo a partir de y0. */
    function desenharParagrafo(p, x, largura, desenhar, quebraPagina) {
      const pp = p.pp;
      const linhas = linhasDo(p, largura);
      let yy = quebraPagina ? y : 0;
      const before = pp.before || 0, after = pp.after != null ? pp.after : 0;
      yy += before;
      if (quebraPagina && pp.keepNext && linhas.length <= 2 && yy + alturaLinha(p, linhas[0]) * 3 > FIM) { novaPagina(); yy = y + before; }
      linhas.forEach((ln, idx) => {
        const h = alturaLinha(p, ln);
        if (quebraPagina && yy + h > FIM) { novaPagina(); yy = y; }
        if (desenhar) {
          const primeira = idx === 0;
          const xi = x + (pp.indL || 0) + (primeira ? (pp.first || 0) : 0);
          const disp = largura - (pp.indL || 0) - (pp.indR || 0) - (primeira ? (pp.first || 0) : 0);
          const ultima = idx === linhas.length - 1 || ln.quebra;
          let dx = 0, extra = 0;
          const esp = ln.itens.filter(i => i.esp && !i.tab).length;
          if (pp.jc === 'center') dx = (disp - ln.w) / 2;
          else if (pp.jc === 'right' || pp.jc === 'end') dx = disp - ln.w;
          else if ((pp.jc === 'both' || pp.jc === 'distribute') && !ultima && esp) extra = Math.max(0, (disp - ln.w) / esp);
          const sz = Math.max(...ln.itens.map(i => i.r.sz), p.markSz || 11);
          const base = yy + h / 2 + sz * 0.34;
          let cx = xi + dx;
          ln.itens.forEach(it => {
            if (it.esp) {
              if (it.r.u && !it.tab) { doc.setLineWidth(0.5); doc.line(cx, base + 1.6, cx + it.w + extra, base + 1.6); }
              cx += it.w + (it.tab ? 0 : extra); return;
            }
            setFonte(it.r); doc.setTextColor(0, 0, 0);
            doc.text(it.t, cx, base);
            if (it.r.u) { doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.line(cx, base + 1.6, cx + it.w, base + 1.6); }
            cx += it.w;
          });
        }
        yy += h;
      });
      yy += after;
      if (quebraPagina) y = yy;
      return yy;
    }
    function desenharTabela(t) {
      const soma = t.grid.reduce((a, b) => a + b, 0) || LARG;
      const escala = Math.min(1, (LARG - (t.ind || 0)) / soma);
      const cols = t.grid.map(g => g * escala);
      const larguraT = cols.reduce((a, b) => a + b, 0);
      const xT = t.jc === 'center' ? X0 + (LARG - larguraT) / 2 : X0 + (t.ind || 0);
      const B = t.borders;
      const linha = (row, ri, repetida) => {
        // mede cada célula
        let ci = 0;
        const cels = row.cells.map(cell => {
          const w = cols.slice(ci, ci + cell.span).reduce((a, b) => a + b, 0);
          const x = xT + cols.slice(0, ci).reduce((a, b) => a + b, 0);
          ci += cell.span;
          const inner = w - cell.mar.l - cell.mar.r;
          const h = cell.blocks.reduce((acc, p) => acc + desenharParagrafo(p, 0, inner, false, false), 0) + cell.mar.t + cell.mar.b;
          return { cell, x, w, inner, h };
        });
        const hRow = Math.max(14, ...cels.map(c => c.h));
        if (y + hRow > FIM) { novaPagina(); if (ri > 0 && !repetida) linha(t.rows[0], 0, true); }
        cels.forEach(c => {
          if (c.cell.fill && /^[0-9a-f]{6}$/i.test(c.cell.fill)) {
            const n = parseInt(c.cell.fill, 16);
            doc.setFillColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
            doc.rect(c.x, y, c.w, hRow, 'F');
          }
          const yAnt = y;
          y = yAnt + c.cell.mar.t;
          c.cell.blocks.forEach(p => {
            const yy = desenharParagrafoEm(p, c.x + c.cell.mar.l, c.inner, y);
            y = yy;
          });
          y = yAnt;
        });
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5);
        const x1 = xT, x2 = xT + larguraT;
        if (ri === 0 || repetida ? B.top : B.h) doc.line(x1, y, x2, y);
        if ((ri === t.rows.length - 1 && B.bottom) || (repetida && B.h)) doc.line(x1, y + hRow, x2, y + hRow);
        cels.forEach((c, i) => {
          if (i === 0 ? B.left : B.v) doc.line(c.x, y, c.x, y + hRow);
          if (i === cels.length - 1 && B.right) doc.line(c.x + c.w, y, c.x + c.w, y + hRow);
        });
        y += hRow;
      };
      t.rows.forEach((row, ri) => linha(row, ri, false));
    }
    function desenharParagrafoEm(p, x, largura, y0) {
      const salvo = y; y = y0;
      const pp = p.pp;
      const linhas = linhasDo(p, largura);
      let yy = y0 + (pp.before || 0);
      linhas.forEach((ln, idx) => {
        const h = alturaLinha(p, ln);
        const primeira = idx === 0;
        const xi = x + (pp.indL || 0) + (primeira ? (pp.first || 0) : 0);
        const disp = largura - (pp.indL || 0) - (pp.indR || 0) - (primeira ? (pp.first || 0) : 0);
        let dx = 0;
        if (pp.jc === 'center') dx = (disp - ln.w) / 2; else if (pp.jc === 'right' || pp.jc === 'end') dx = disp - ln.w;
        const sz = Math.max(...ln.itens.map(i => i.r.sz), p.markSz || 11);
        const base = yy + h / 2 + sz * 0.34;
        let cx = xi + dx;
        ln.itens.forEach(it => { if (!it.esp) { setFonte(it.r); doc.setTextColor(0, 0, 0); doc.text(it.t, cx, base); } cx += it.w; });
        yy += h;
      });
      y = salvo;
      return yy + (pp.after || 0);
    }

    montado.blocks.forEach(b => {
      if (b.type === 'tbl') { desenharTabela(b); return; }
      if (b.pp.pageBreakBefore) novaPagina();
      const txt = b.runs.map(r => r.text).join('');
      if (txt.includes('\f')) {
        const partes = txt.split('\f');
        partes.forEach((_, i) => { if (i > 0) novaPagina(); });
        b = Object.assign({}, b, { runs: b.runs.map(r => Object.assign({}, r, { text: r.text.replace(/\f/g, '') })) });
      }
      desenharParagrafo(b, X0, LARG, true, true);
    });
    return doc;
  }

  window.VegasContratos = { CONTRATOS, PESSOA_LBL, preparar, gerarPDF, pessoaDoCliente, extensoReais, extensoInteiro };
})();
