/* ==========================================================================
   VEGAS VIGILÂNCIA — PROSPECÇÃO DE CLIENTES
   kits.js — kits prontos para o orçamento (venda e locação/comodato)
   --------------------------------------------------------------------------
   Cada item do kit é [código, descrição]. O sistema procura o produto no
   catálogo pelo código (aceita com ou sem zeros à esquerda) e, se não achar,
   pelo nome. Item que não estiver no catálogo entra com o código e o nome
   abaixo e valor R$ 0,00 (o vendedor é avisado antes de adicionar).

   Kits de câmeras: o DVR e a câmera são procurados automaticamente no
   catálogo pela marca e pelo número de canais (4, 8 ou 16). O vendedor pode
   trocar o DVR, a câmera e a quantidade de câmeras antes de adicionar.
   Para mudar um kit, edite as listas abaixo e troque a versão no sw.js.
   ========================================================================== */
'use strict';

/* ---------- 1. Definição dos kits ---------- */

const KIT_CFTV = {
  tamanhos: [4, 8, 16],
  marcas: [
    {
      id: 'hikvision', nome: 'Hikvision (HiLook)',
      chaves: ['hilook', 'hikvision', 'hik ', 'ds-7', 'dvr-2', 'thc-', 'turbo hd'],
      camera: ['000340', 'CAMERA HILOOK FULL HD BULLET'],
      dvr: { 4: ['000397', 'DVR HILOOK 4 CN FULL HD'], 8: ['', 'DVR HILOOK 8 CN FULL HD'], 16: ['', 'DVR HILOOK 16 CN FULL HD'] }
    },
    {
      id: 'intelbras', nome: 'Intelbras',
      chaves: ['intelbras', 'mhdx', 'imhdx', 'vhl', 'vhd', 'multi hd', 'multihd'],
      camera: ['001168', 'CAMERA BULL 20MT VHL1220B FULLHD G2'],
      dvr: { 4: ['', 'DVR 04 CANAIS MHDX INTELBRAS'], 8: ['000762', 'DVR 08 CANAIS MHDX1308 C/ HD 1TB INTELBRAS'], 16: ['', 'DVR 16 CANAIS MHDX INTELBRAS'] }
    }
  ],
  /** Entra só se o DVR escolhido não vier com HD. */
  hd: ['000025', 'HD 1TB'],
  /** Um de cada por câmera. */
  porCamera: [['000045', 'VIDEO BALUM'], ['000047', 'CONECTOR P4 MACHO'], ['000044', 'CAIXA DE SOBREPOR P/ CAMERA']],
  /** Um por kit. */
  fixos: [['000107', 'RACK UNIVERSAL'], ['000093', 'FILTRO DE LINHA']],
  fonte5: ['000014', 'FONTE 5A INTELBRAS'],
  fonte10: ['000015', 'FONTE 10A COLMÉIA']
};
/** Até 4 câmeras: 1 fonte 5A. Acima disso: 1 fonte 10A a cada 8 câmeras (8 → 1, 16 → 2). */
const kitFontes = n => n <= 4 ? [[KIT_CFTV.fonte5, 1]] : [[KIT_CFTV.fonte10, Math.ceil(n / 8)]];

/** Kits de itens fixos. multiplicavel: mostra "Quantidade de kits". fixo: item que não multiplica. */
const KITS_PRONTOS = [
  {
    id: 'alarme-jfl', icone: 'shield', nome: 'Alarme JFL Active 20', sub: 'Central, teclado, sirene, sensor, controle e módulo GPRS 4G',
    itens: [['001218', 'CENTRAL ACTIVE 20 JFL'], ['000031', 'TECLADO LCD TEC 300'], ['001219', 'SIRENE'], ['000982', 'BATERIA 12V 7A'],
      ['000003', 'DETECTOR INTERNO C/ FIO'], ['000024', 'CONTROLE REMOTO TX 4R 4.0'], ['000409', 'MODULO (GPRS) MGP04 -4G']]
  },
  {
    id: 'alarme-intelbras', icone: 'shield', nome: 'Alarme Intelbras 2018', sub: 'Central com teclado, sirene, sensor, controle e módulo GSM 4G',
    itens: [['000312', 'CENTRAL INTELBRAS 2018 E COM TECLADO'], ['000810', 'MODULO GSM XG 4G INTELBRAS'], ['000030', 'SIRENE BRANCA'],
      ['000049', 'BATERIA SELADA 12V 7A'], ['000003', 'DETECTOR INTERNO C/ FIO'], ['000976', 'CONTROLE REMOTO XAC 4000 SMART']]
  },
  {
    id: 'camera-wifi', icone: 'wifi', nome: 'Câmera Wi-Fi TP C200', sub: 'Câmera interna, cartão 32GB, caixa, tomada e roteador', multiplicavel: true, rotulo: 'Quantidade de câmeras',
    itens: [['001065', 'CAMERA WIFI TP C200 INTERNA'], ['000476', 'CARTÃO DE MEMORIA 32GB'], ['000044', 'CAIXA DE SOBREPOR P/ CAMERA'],
      ['001207', 'TOMADA FEMEA 3 PINOS'], ['000834', 'ROTEADOR 3 ANTENAS', { fixo: true }]]
  },
  {
    id: 'cerca', icone: 'bolt', nome: 'Cerca elétrica', sub: 'Central, bateria, sirene, fio de aço, hastes e placa',
    itens: [['000002', 'CENTRAL DE CERCA ELÉTRICA'], ['000049', 'BATERIA SELADA 12V 7A'], ['000029', 'SIRENE PRETA'], ['000034', 'BOBINA FIO DE AÇO 0,70'],
      ['000043', 'HASTE DE ATERRAMENTO C/ CONECTOR'], ['000050', 'HASTE CERCA ELETRICA 4 ISOLADORES'], ['000105', 'PLACA AVISO CERCA'], ['000375', 'HASTE CANTONEIRA']]
  },
  {
    id: 'rastreador', icone: 'car', nome: 'Rastreador 4G', sub: 'Rastreador, chip de dados, relé, chicote e espuma', multiplicavel: true, rotulo: 'Quantidade de veículos',
    itens: [['000706', 'RASTREADOR 4 G'], ['000066', 'CHIP DE DADOS'], ['000102', 'RELE AUX 12'], ['000104', 'CHICOTE'], ['000101', 'ESPUMA ANTI CHAMA']]
  }
];

Object.assign(ICONS, {
  cctv: '<path d="M2.5 7l13 3.6-1.5 5.4L1 12.4z"/><path d="M15.6 10.4l4.6-1.4.9 3.7-6.6 2M6.5 14l-1 5.5H2.5"/>',
  wifi: '<path d="M2.5 9.2a14 14 0 0119 0M5.6 12.4a9.5 9.5 0 0112.8 0M8.7 15.6a5 5 0 016.6 0"/><path d="M12 19.2v.01"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  car: '<path d="M4 16.5V12l2-5h12l2 5v4.5z"/><path d="M4 12h16M7 19.5v-3M17 19.5v-3"/><path d="M7.5 14h.01M16.5 14h.01"/>'
});

/* ---------- 2. Busca no catálogo ---------- */

/** Código comparável: "000340", "340" e 340 viram "340". */
const kitCod = c => { const s = String(c == null ? '' : c).trim(); return /^\d+$/.test(s) ? String(+s) : norm(s); };
const kitTexto = p => norm([p.produto, p.descricao, p.categoria].join(' '));

function kitAcharProduto(codigo, descricao) {
  const lista = S.data.produtos || [];
  const k = kitCod(codigo);
  let p = k && lista.find(x => kitCod(x.codigo) === k);
  if (!p && descricao) { const d = norm(descricao); p = lista.find(x => norm(x.produto) === d); }
  return p || null;
}
/** Linha do kit: produto do catálogo (ou null) + código/descrição de reserva + quantidade. */
function kitLinha(def, qtd) {
  const p = kitAcharProduto(def[0], def[1]);
  return { p, codigo: def[0], descricao: def[1], qtd };
}

const kitEhDvr = p => { const n = norm(p.produto); return /(dvr|xvr|mhdx|gravador)/.test(n) && !/\bnvr\b/.test(n); };
const kitEhCamera = p => { const n = norm(p.produto); return /(camera|camara)/.test(n) && !/(caixa|wifi|wi-fi|suporte|conector)/.test(n); };
const kitDaMarca = (p, m) => { const t = ' ' + kitTexto(p) + ' '; return m.chaves.some(k => t.includes(k)); };
/** Número de canais pelo nome: "4 CN", "08 CANAIS", "16CH" ou pelo modelo (MHDX1308, DVR-208G, DS-7216). */
function kitCanais(nome) {
  const n = norm(nome);
  let m = n.match(/(\d{1,2})\s*(?:cn|cnl|canais|canal|ch)\b/);
  if (m) return +m[1];
  m = n.match(/(?:mhdx|dvr|xvr|ds-7)[\s-]*\d{0,2}?(04|08|16|32)(?!\d)/);
  return m ? +m[1] : 0;
}
/** O DVR já vem com HD? ("C/ HD", "COM HD", "1TB") */
const kitDvrComHd = nome => /((c\/|com)\s*hd|\d\s*tb\b)/.test(norm(nome));

const kitAtivos = () => (S.data.produtos || []).filter(p => p.status !== 'Inativo');
function kitOrdena(l) {
  return l.sort((a, b) => (kitCanais(a.produto) - kitCanais(b.produto)) || String(a.produto).localeCompare(String(b.produto), 'pt-BR'));
}
/** DVRs do catálogo: primeiro os da marca, depois os demais. */
function kitDvrs(marca) {
  const todos = kitAtivos().filter(kitEhDvr);
  return { marca: kitOrdena(todos.filter(p => kitDaMarca(p, marca))), outros: kitOrdena(todos.filter(p => !kitDaMarca(p, marca))) };
}
function kitCameras(marca) {
  const todos = kitAtivos().filter(kitEhCamera);
  return { marca: kitOrdena(todos.filter(p => kitDaMarca(p, marca))), outros: kitOrdena(todos.filter(p => !kitDaMarca(p, marca))) };
}
/** Melhor DVR para a marca e os canais: o código do kit, senão o 1º da marca com o mesmo número de canais. */
function kitDvrPadrao(marca, canais) {
  const def = marca.dvr[canais];
  const p = def && def[0] ? kitAcharProduto(def[0]) : null;
  if (p && p.status !== 'Inativo') return p;
  return kitDvrs(marca).marca.find(x => kitCanais(x.produto) === canais) || null;
}
function kitCameraPadrao(marca) {
  const p = kitAcharProduto(marca.camera[0], marca.camera[1]);
  if (p && p.status !== 'Inativo') return p;
  return kitCameras(marca).marca[0] || null;
}

/* ---------- 3. Montagem das linhas ---------- */

function kitLinhasCftv(st) {
  const marca = KIT_CFTV.marcas.find(m => m.id === st.marca);
  const n = Math.max(1, Math.round(num(st.cameras)) || 1);
  const dvrP = st.dvrId ? byId(S.data.produtos, st.dvrId) : null;
  const dvrDef = marca.dvr[st.canais] || ['', 'DVR ' + st.canais + ' CANAIS ' + marca.nome.toUpperCase()];
  const camP = st.camId ? byId(S.data.produtos, st.camId) : null;
  const linhas = [];
  /** Mantém o código com zeros do kit quando o catálogo guardou como número (000397 → 397). */
  const cod = (p, def) => def[0] && kitCod(def[0]) === kitCod(p.codigo) ? def[0] : p.codigo;
  linhas.push(dvrP ? { p: dvrP, codigo: cod(dvrP, dvrDef), descricao: dvrP.produto, qtd: 1 } : { p: null, codigo: dvrDef[0], descricao: dvrDef[1], qtd: 1 });
  if (!kitDvrComHd(dvrP ? dvrP.produto : dvrDef[1])) linhas.push(kitLinha(KIT_CFTV.hd, 1));
  linhas.push(camP ? { p: camP, codigo: cod(camP, marca.camera), descricao: camP.produto, qtd: n } : { p: null, codigo: marca.camera[0], descricao: marca.camera[1], qtd: n });
  KIT_CFTV.porCamera.forEach(d => linhas.push(kitLinha(d, n)));
  kitFontes(n).forEach(([d, q]) => linhas.push(kitLinha(d, q)));
  KIT_CFTV.fixos.forEach(d => linhas.push(kitLinha(d, 1)));
  return linhas;
}
function kitLinhasFixo(kit, qtdKits) {
  const q = Math.max(1, Math.round(num(qtdKits)) || 1);
  return kit.itens.map(d => kitLinha(d, d[2] && d[2].fixo ? 1 : q));
}

/** Soma as linhas do kit aos itens da proposta (item repetido soma a quantidade). */
function kitAplicar(linhas, nomeKit) {
  const P = S.prop, loc = P.tipoOrcamento === 'Locado';
  let faltando = 0;
  linhas.forEach(l => {
    if (!(l.qtd > 0)) return;
    const p = l.p;
    const ex = p ? P.itens.find(i => i.produtoId === p.id)
      : P.itens.find(i => !i.produtoId && kitCod(i.codigo) === kitCod(l.codigo) && norm(i.descricao) === norm(l.descricao));
    if (!p) faltando++;
    if (ex) { ex.quantidade = num(ex.quantidade) + l.qtd; return; }
    P.itens.push(p
      ? { produtoId: p.id, codigo: l.codigo && kitCod(l.codigo) === kitCod(p.codigo) ? l.codigo : p.codigo, descricao: p.produto, tipo: p.tipo || 'Produto', unidade: p.unidade || 'UN', quantidade: l.qtd, valorUnitario: num(p.preco), desconto: 0, locado: loc }
      : { produtoId: '', codigo: l.codigo, descricao: l.descricao, tipo: 'Produto', unidade: 'UN', quantidade: l.qtd, valorUnitario: 0, desconto: 0, locado: loc });
  });
  drawPropItens();
  toast(nomeKit + ' adicionado ao orçamento.' + (faltando ? ' ' + faltando + ' item(ns) fora do catálogo entraram com valor R$ 0,00.' : ''), faltando ? 'warn' : 'ok', faltando ? 6000 : 3800);
}

/* ---------- 4. Interface ---------- */

/** Painel "Kits prontos" do editor de proposta. */
function kitsPanelHtml() {
  const cftv = KIT_CFTV.marcas.map(m => '<div class="kit-card"><div class="kit-card-top"><span class="kit-ico">' + icon('cctv') + '</span><span><strong>Câmeras ' + esc(m.nome) + '</strong>' +
    '<small>DVR, câmeras, balun, P4, caixas, fonte e rack</small></span></div><div class="kit-sizes">' +
    KIT_CFTV.tamanhos.map(t => '<button class="btn btn-sm" data-act="kit" data-kit="cftv:' + m.id + ':' + t + '">' + t + ' câmeras</button>').join('') + '</div></div>').join('');
  const fixos = KITS_PRONTOS.map(k => '<button class="kit-card kit-btn" data-act="kit" data-kit="' + k.id + '"><span class="kit-card-top"><span class="kit-ico">' + icon(k.icone) + '</span>' +
    '<span><strong>' + esc(k.nome) + '</strong><small>' + esc(k.sub) + '</small></span></span></button>').join('');
  return '<section class="panel" id="pKitsSec"><div class="panel-head"><h2>Kits prontos</h2><span class="muted kit-hint">Escolha um kit e confira antes de adicionar</span></div>' +
    '<div class="panel-body kits-grid">' + cftv + fixos + '</div></section>';
}

function kitTabela(linhas) {
  const loc = S.prop && S.prop.tipoOrcamento === 'Locado';
  return '<div class="table-wrap"><table class="tbl kit-tbl"><thead><tr><th>Código</th><th>Item</th><th class="right">Qtd.</th><th class="right">' + (loc ? 'Valor reposição' : 'Valor unit.') + '</th><th>Catálogo</th></tr></thead><tbody>' +
    linhas.map(l => '<tr' + (l.p ? '' : ' class="kit-falta"') + '><td class="num">' + esc(l.codigo || (l.p && l.p.codigo) || '—') + '</td><td>' + esc(l.p ? l.p.produto : l.descricao) + '</td>' +
      '<td class="right num">' + esc(l.qtd) + '</td><td class="right num nowrap">' + (l.p ? money(l.p.preco) : '—') + '</td>' +
      '<td>' + (l.p ? (l.p.status === 'Inativo' ? '<span class="chip" style="--c:#e5a020">Inativo</span>' : '<span class="chip" style="--c:#22b35e">OK</span>') : '<span class="chip" style="--c:#e0232c">Não cadastrado</span>') + '</td></tr>').join('') +
    '</tbody></table></div>';
}

function kitOpcoes(grupos, sel, reserva) {
  const op = p => '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(produtoLabel(p)) + '</option>';
  return (grupos.marca.length ? '<optgroup label="Da marca">' + grupos.marca.map(op).join('') + '</optgroup>' : '') +
    (grupos.outros.length ? '<optgroup label="Outras marcas">' + grupos.outros.map(op).join('') + '</optgroup>' : '') +
    '<option value=""' + (!sel ? ' selected' : '') + '>Não cadastrado: ' + esc(reserva) + '</option>';
}

function openKitModal(kitId) {
  if (!S.prop) return;
  const [tipo, marcaId, canaisRaw] = String(kitId).split(':');
  let st, titulo, cfgHtml;
  if (tipo === 'cftv') {
    const marca = KIT_CFTV.marcas.find(m => m.id === marcaId);
    const canais = +canaisRaw;
    if (!marca) return;
    const dvr = kitDvrPadrao(marca, canais), cam = kitCameraPadrao(marca);
    st = { marca: marca.id, canais, cameras: canais, dvrId: dvr ? dvr.id : '', camId: cam ? cam.id : '' };
    titulo = 'Kit câmeras ' + marca.nome + ' — ' + canais + ' câmeras';
    const dvrDef = marca.dvr[canais] || ['', 'DVR ' + canais + ' CANAIS'];
    cfgHtml = '<div class="grid g3 kit-cfg">' +
      '<label class="field span2"><span>DVR (' + canais + ' canais)</span><select id="kDvr">' + kitOpcoes(kitDvrs(marca), st.dvrId, dvrDef[1]) + '</select><small id="kDvrInfo"></small></label>' +
      '<label class="field"><span>Quantidade de câmeras</span><input id="kCams" type="number" min="1" max="32" step="1" inputmode="numeric" value="' + canais + '"></label>' +
      '<label class="field span-all"><span>Câmera</span><select id="kCam">' + kitOpcoes(kitCameras(marca), st.camId, marca.camera[1]) + '</select></label></div>';
  } else {
    const kit = KITS_PRONTOS.find(k => k.id === tipo);
    if (!kit) return;
    st = { kit, qtd: 1 };
    titulo = 'Kit ' + kit.nome;
    cfgHtml = kit.multiplicavel
      ? '<div class="grid g3 kit-cfg"><label class="field"><span>' + esc(kit.rotulo || 'Quantidade de kits') + '</span><input id="kQtd" type="number" min="1" max="99" step="1" inputmode="numeric" value="1"></label>' +
        (kit.itens.some(d => d[2] && d[2].fixo) ? '<small class="muted span2" style="align-self:end;padding-bottom:10px">' + esc(kit.itens.filter(d => d[2] && d[2].fixo).map(d => d[1]).join(', ')) + ': 1 por instalação.</small>' : '') + '</div>'
      : '<p class="muted" style="margin:0 0 12px">As quantidades podem ser ajustadas depois, na lista de itens do orçamento.</p>';
  }
  const linhasAtuais = () => tipo === 'cftv' ? kitLinhasCftv(st) : kitLinhasFixo(st.kit, st.qtd);
  const m = openModal({
    title: titulo, size: 'lg',
    body: cfgHtml + '<div id="kPrev"></div><div id="kAviso"></div>',
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn btn-primary" data-kit-ok>' + icon('plus') + 'Adicionar ao orçamento</button>'
  });
  const desenhar = () => {
    const linhas = linhasAtuais();
    $('#kPrev', m).innerHTML = kitTabela(linhas);
    const falta = linhas.filter(l => !l.p).length;
    const loc = S.prop.tipoOrcamento === 'Locado';
    $('#kAviso', m).innerHTML = (falta
      ? '<p class="kit-aviso">' + icon('alert') + '<span><strong>' + falta + ' item(ns) não estão no catálogo.</strong> Entram com o código e o nome do kit e valor R$ 0,00. Cadastre em Produtos para que' + (loc ? ' o valor de reposição saia certo no contrato.' : ' o valor saia no orçamento.') + '</span></p>' : '') +
      (loc ? '<p class="muted kit-nota">Locação: os itens entram marcados como comodato e saem no PDF como “Locado”.</p>' : '');
    if (tipo === 'cftv') {
      const d = st.dvrId ? byId(S.data.produtos, st.dvrId) : null;
      const c = d ? kitCanais(d.produto) : st.canais;
      const info = $('#kDvrInfo', m);
      const cams = Math.round(num(st.cameras)) || 0;
      info.className = !d || (c && cams > c) ? 'warn-text' : '';
      info.textContent = !d ? 'Nenhum DVR de ' + st.canais + ' canais desta marca foi achado no catálogo. Escolha outro ou cadastre o produto.'
        : c && cams > c ? 'Atenção: ' + cams + ' câmeras para um DVR de ' + c + ' canais.'
          : (kitDvrComHd(d.produto) ? 'Este DVR já vem com HD: o HD avulso não entra.' : 'HD 1TB entra junto com o DVR.');
    }
  };
  desenhar();
  m.addEventListener('input', e => {
    if (e.target.id === 'kCams') st.cameras = e.target.value;
    if (e.target.id === 'kQtd') st.qtd = e.target.value;
    desenhar();
  });
  m.addEventListener('change', e => {
    if (e.target.id === 'kDvr') st.dvrId = e.target.value;
    if (e.target.id === 'kCam') st.camId = e.target.value;
    desenhar();
  });
  $('[data-kit-ok]', m).onclick = () => {
    const linhas = linhasAtuais();
    closeModal(m);
    kitAplicar(linhas, titulo);
  };
}

Object.assign(UI, { kit: el => openKitModal(el.dataset.kit) });
