/* ==========================================================================
   VEGAS VIGILÂNCIA — PROSPECÇÃO DE CLIENTES
   pdf.js — geração dos PDFs (orçamento e relatórios)
   --------------------------------------------------------------------------
   O orçamento reproduz o modelo oficial (Orçamento Nº 12986):
   • Página A4 com o papel timbrado original (assets/pdf-fundo.jpg), extraído
     do próprio PDF de referência: faixas, logo, marca d'água e rodapé.
   • Fonte Carlito (métrica idêntica à Calibri usada no modelo).
   • Faixas cinza (#BFBFBF), tamanhos e posições medidos no modelo, em pontos.
   Para trocar o papel timbrado, substitua assets/pdf-fundo.jpg (A4 retrato).
   ========================================================================== */
(function () {
  'use strict';

  const W = 595.28, H = 841.89;
  const BAR_X = 65.4, BAR_W = 531.7 - 65.4, BAR_CX = (65.4 + 531.7) / 2;
  const COL = { cod: 70.9, desc: 120.6, qtdH: 347.5, qtd: 354.6, unit: 397.1, totH: 453.8, tot: 460.9 };
  const TOPO_CONTINUACAO = 110;   // início do conteúdo nas páginas seguintes (abaixo do logo)
  const LIMITE = 722;             // o rodapé do timbrado começa logo abaixo daqui

  /* ---------- Recursos (fundo e fontes), carregados uma vez ---------- */
  let assets = null;
  const toB64 = buf => {
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const blobToDataURL = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  async function loadAssets() {
    if (assets) return assets;
    const get = (url, type) => fetch(url).then(r => (r.ok ? (type === 'img' ? r.blob().then(blobToDataURL) : r.arrayBuffer().then(toB64)) : null)).catch(() => null);
    const [bg, reg, bold] = await Promise.all([get('assets/pdf-fundo.jpg', 'img'), get('assets/fonts/Carlito-Regular.ttf'), get('assets/fonts/Carlito-Bold.ttf')]);
    assets = { bg, reg, bold };
    return assets;
  }
  function newDoc(a) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    doc.__font = 'helvetica';
    if (a.reg && a.bold) {
      doc.addFileToVFS('Carlito-Regular.ttf', a.reg);
      doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
      doc.addFileToVFS('Carlito-Bold.ttf', a.bold);
      doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
      doc.__font = 'Carlito';
    }
    doc.setProperties({ title: 'Vegas Vigilância e Segurança', creator: 'Vegas Prospecção', author: 'Vegas Vigilância e Segurança' });
    return doc;
  }
  function fundo(doc, a) {
    if (a.bg) doc.addImage(a.bg, 'JPEG', 0, 0, W, H, 'VEGAS_FUNDO', 'FAST');
  }

  /* ---------- Helpers de texto ---------- */
  const up = v => String(v == null ? '' : v).toUpperCase();
  const brl = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qtdFmt = n => { n = Number(n) || 0; return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 }); };
  const dt = v => {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00') : '') : String(v || '');
  };
  function setF(doc, size, bold) { doc.setFont(doc.__font, bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(0, 0, 0); }
  /** Escreve texto usando o TOPO da linha (como medido no modelo) em vez da linha de base. */
  function T(doc, txt, x, top, size, bold, opt) {
    setF(doc, size, bold);
    doc.text(String(txt == null ? '' : txt), x, top + size * 0.75, opt || {});
  }
  function fit(doc, txt, maxW) {
    txt = String(txt == null ? '' : txt);
    if (doc.getTextWidth(txt) <= maxW) return txt;
    while (txt.length > 1 && doc.getTextWidth(txt + '…') > maxW) txt = txt.slice(0, -1);
    return txt + '…';
  }
  function underline(doc, x1, x2, y, w) { doc.setFillColor(0, 0, 0); doc.rect(x1, y, x2 - x1, w || 0.9, 'F'); }
  function faixa(doc, titulo, top, h) {
    doc.setFillColor(191, 191, 191);
    doc.rect(BAR_X, top, BAR_W, h, 'F');
    T(doc, titulo, BAR_CX, top + 2.4, 12, true, { align: 'center' });
  }
  /** Linha pontilhada "RÓTULO:.......: VALOR" do bloco Cobrança Mensal. */
  function pontilhado(doc, label, valor, top, bold) {
    setF(doc, 11, bold);
    const x0 = 67.3;
    let s = label;
    while (doc.getTextWidth(s + '.:') < 376 - x0) s += '.';
    doc.text(s + ':', x0, top + 8.25);
    setF(doc, 11, true);
    doc.text(valor, 531.7, top + 8.25, { align: 'right' });
  }

  /* ======================================================================
     ORÇAMENTO
     ====================================================================== */
  async function proposta({ proposta: p, cliente: c, vendedor: v, config: cfg }) {
    const a = await loadAssets();
    const doc = newDoc(a);
    c = c || {}; v = v || {}; cfg = cfg || {};
    fundo(doc, a);
    const novaPagina = () => { doc.addPage(); fundo(doc, a); return TOPO_CONTINUACAO; };

    /* Título e tipo (ex.: "Locado") centralizados e sublinhados */
    const titulo = 'ORÇAMENTO Nº: ' + p.numero;
    T(doc, titulo, W / 2, 71.9, 14, true, { align: 'center' });
    let tw = doc.getTextWidth(titulo);
    underline(doc, W / 2 - tw / 2, W / 2 + tw / 2, 84, 1);
    const tipo = p.tipoOrcamento || '';
    if (tipo) {
      T(doc, tipo, W / 2, 89.1, 14, true, { align: 'center' });
      tw = doc.getTextWidth(tipo);
      underline(doc, W / 2 - tw / 2, W / 2 + tw / 2, 101.2, 0.9);
    }

    /* Dados do cliente — duas colunas, como no modelo */
    const nomeCliente = up(c.razaoSocial || c.empresa || c.contato || p.cliente);
    const linhas = [
      [['CLIENTE:', (c.codigo ? c.codigo + '   ' : '') + nomeCliente]],
      [['CNPJ/CPF:', c.documento], ['INSCRIÇAO:', up(c.inscricao)]],
      [['ENDEREÇO:', up([c.endereco, c.complemento].filter(Boolean).join(' - '))], ['NÚMERO:', up(c.numero)]],
      [['BAIRRO:', up(c.bairro)], ['CIDADE:', up(c.cidade), up(c.estado)]]
    ];
    const fone = c.whatsapp || c.telefone;
    const pessoa = c.contato && c.empresa && c.contato !== c.empresa ? up(c.contato) : '';
    if (fone || pessoa) linhas.push([['TELEFONE:', fone ? mascaraFone(fone) : '']].concat(pessoa ? [['CONTATO:', pessoa]] : []));
    linhas.push([['VALIDO ATÉ:', dt(p.validade)], ['EMISSÃO:', dt(p.dataEmissao)]]);
    let y = 122.4;
    linhas.forEach(row => {
      row.forEach((cel, i) => {
        const xl = i === 0 ? 70.9 : 297.8;
        T(doc, cel[0], xl, y, 11, true);
        const lw = doc.getTextWidth(cel[0]);
        const xv = Math.max(i === 0 ? 127.6 : 354.6, xl + lw + 4);
        const maxW = row.length === 1 || i === 1 ? 531 - xv : 292 - xv;
        setF(doc, 11, false);
        if (cel.length === 3) { // cidade + UF
          doc.text(fit(doc, cel[1], 100), xv, y + 8.25);
          doc.text(String(cel[2] || ''), 460.4, y + 8.25);
        } else doc.text(fit(doc, cel[1] || '', maxW), xv, y + 8.25);
      });
      y += 13.45;
    });
    y += 11.35; // topo da faixa PRODUTOS (201,0 no modelo)

    const itens = (p.itens || []).filter(i => String(i.descricao || '').trim());
    const produtos = itens.filter(i => i.tipo !== 'Serviço');
    const servicos = itens.filter(i => i.tipo === 'Serviço');
    const totalDe = l => l.reduce((s, i) => s + (i.locado ? 0 : Number(i.total != null ? i.total : (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0) - (Number(i.desconto) || 0)) || 0), 0);

    /** Tabela de itens (produtos ou serviços). Quebra de página automática. */
    function tabela(lista, rotuloCol, headSize, headOffset, firstRowOffset, headerTop) {
      const cab = yy => {
        T(doc, 'CÓDIGO', COL.cod, yy, headSize, true);
        T(doc, rotuloCol, COL.desc, yy, headSize, true);
        T(doc, 'QTD.', COL.qtdH, yy, headSize, true);
        T(doc, 'UNIT.', COL.unit, yy, headSize, true);
        T(doc, 'TOTAL', COL.totH, yy, headSize, true);
      };
      let yy = headerTop + headOffset;
      cab(yy);
      yy = headerTop + firstRowOffset;
      let last = yy;
      lista.forEach(i => {
        setF(doc, 10, false);
        const desc = doc.splitTextToSize(up(i.descricao) + (Number(i.desconto) > 0 && !i.locado ? ' (DESC. ' + brl(i.desconto) + ')' : ''), 222);
        if (yy + desc.length * 12.2 > LIMITE) { yy = novaPagina(); cab(yy); yy += 22.5; }
        T(doc, i.codigo || '', COL.cod, yy, 10, false);
        desc.forEach((ln, k) => T(doc, ln, COL.desc, yy + k * 12.2, 10, false));
        T(doc, qtdFmt(i.quantidade), COL.qtd, yy, 10, false);
        T(doc, i.locado ? 'Locado' : brl(i.valorUnitario), COL.unit, yy, 10, false);
        if (!i.locado) T(doc, brl(i.total != null ? i.total : (Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0)), COL.tot, yy, 10, false);
        last = yy;
        yy += desc.length * 12.2;
      });
      return last;
    }
    const garantir = altura => { if (y + altura > LIMITE) y = novaPagina(); };

    /* PRODUTOS */
    if (produtos.length) {
      garantir(100);
      faixa(doc, 'PRODUTOS', y, 23.7);
      const last = tabela(produtos, 'PRODUTO', 12, 46.2, 68.7, y);
      let t = last + 12.2;
      if (t + 35 > LIMITE) t = novaPagina();
      T(doc, 'TOTAL DE PRODUTOS:', 368.7, t, 11, true);
      T(doc, brl(totalDe(produtos)), 390, t + 22.6, 11, true);
      y = t + 22.6 + 11.6;
    }

    /* SERVIÇO */
    if (servicos.length) {
      garantir(90);
      faixa(doc, 'SERVIÇO', y, 21.3);
      const last = tabela(servicos, 'SERVIÇO', 11, 23.3, 38.8, y);
      let t = last + 22;
      if (t + 30 > LIMITE) t = novaPagina();
      T(doc, 'TOTAL SERVIÇOS', 368.7, t, 11, true);
      T(doc, brl(totalDe(servicos)), 425, t + 13.7, 12, true);
      y = t + 13.7 + 13.5;
    }

    /* RESUMO e COBRANÇA MENSAL
       Venda: resumo (subtotal, desconto, valor final) e, se houver, a mensalidade.
       Locação: primeiro o aluguel mensal (como no modelo); o resumo só aparece
       quando existem itens cobrados à parte (ex.: cabos, instalação). */
    const locacao = /loca|comod|alug/i.test(String(p.tipoOrcamento || ''));
    const blocoResumo = () => {
      garantir(72);
      faixa(doc, locacao ? 'VALORES COBRADOS À PARTE' : 'RESUMO DO ORÇAMENTO', y, 19.7);
      pontilhado(doc, 'SUBTOTAL', brl(p.subtotal), y + 27, false);
      pontilhado(doc, 'DESCONTO', (Number(p.desconto) > 0 ? '- ' : '') + brl(p.desconto), y + 41.5, false);
      pontilhado(doc, 'VALOR FINAL', brl(p.valorFinal), y + 56, true);
      y += 76;
    };
    const blocoMensal = () => {
      garantir(95);
      faixa(doc, 'COBRANÇA MENSAL', y, 19.7);
      pontilhado(doc, 'VALOR MENSAL', brl(p.valorMensal), y + 35.1, false);
      pontilhado(doc, 'VALOR MENSAL OUTROS SERVIÇOS', brl(p.outrosMensal), y + 50.8, false);
      pontilhado(doc, 'VALOR TOTAL DA MENSALIDADE', brl(p.totalMensal != null ? p.totalMensal : (Number(p.valorMensal) || 0) + (Number(p.outrosMensal) || 0)), y + 66.2, true);
      y += 93.3;
    };
    if (locacao) {
      blocoMensal();
      if (Number(p.subtotal) > 0 || Number(p.desconto) > 0) blocoResumo();
    } else {
      blocoResumo();
      if (p.incluirMensal) blocoMensal();
    }

    /* CONDIÇÕES DE PAGAMENTO */
    const conds = (p.condicoes && p.condicoes.length) ? p.condicoes : [{ entrada: 'A VISTA', condicao: brl(p.valorFinal), parcelas: '', valor: p.valorFinal }];
    garantir(115 + conds.length * 12.3);
    faixa(doc, 'CONDIÇOES DE PAGAMENTO', y, 20);
    const hy = y + 43.5;
    T(doc, 'ENTRADA', 70.9, hy, 11, true);
    T(doc, 'CONDIÇOES DE PAGAMENTO', 141.9, hy, 11, true);
    T(doc, 'PARCELAS', 324.4, hy, 11, true);
    T(doc, 'VALOR FINAL', 433, hy, 11, true);
    let ry = y + 64.9;
    conds.forEach(cd => {
      setF(doc, 10, false);
      T(doc, fit(doc, up(cd.entrada), 66), 70.9, ry, 10, false);
      T(doc, fit(doc, up(cd.condicao), 176), 141.9, ry, 10, false);
      T(doc, fit(doc, cd.parcelas, 104), 324.4, ry, 10, false);
      T(doc, brl(cd.valor), 433, ry, 10, false);
      ry += 12.3;
    });
    T(doc, '*S: SEM ENTRADA', 70.9, ry, 11, true);
    T(doc, '*E: COM ENTRADA', 161.9, ry, 11, true);
    if (cfg.banco) T(doc, cfg.banco, 70.9, ry + 22.4, 10, false);
    y = ry + 22.4 + 43.7;

    /* Aviso de preços */
    const aviso = cfg.aviso_precos || 'OS PREÇOS PODEM SOFRER ALTERAÇÕES E DEVEM SER CONFIRMADOS ATÉ O FECHAMENTO DA PROPOSTA.';
    setF(doc, 11, true);
    const av = doc.splitTextToSize(up(aviso), 452);
    if (y + av.length * 14.5 > LIMITE) y = novaPagina();
    av.forEach((l, i) => T(doc, l, W / 2, y + i * 14.5, 11, true, { align: 'center' }));
    y += av.length * 14.5;

    /* ---------- Fechamento: impostos, OBS, autorização e assinaturas ---------- */
    setF(doc, 10.5, false);
    const obsTxt = String(p.obsCliente || '').trim();
    const obs = obsTxt ? doc.splitTextToSize(obsTxt, 455) : [];
    const cc = String(cfg.condicoes_comerciais || '').trim();
    const ccl = cc ? doc.splitTextToSize(cc, 455) : [];
    const alturaFixa = 330;
    const alturaTexto = (obs.length + (ccl.length ? ccl.length + 2 : 0)) * 13;
    // Como no modelo, o fechamento vai para uma nova página quando não cabe inteiro
    if (y + 24 + alturaFixa + alturaTexto > LIMITE) { doc.addPage(); fundo(doc, a); y = 71.2; } else y += 24;

    T(doc, up(cfg.texto_impostos || 'NOS VALORES ACIMA ESTÃO INCLUSOS TODOS OS IMPOSTOS.'), 70.9, y, 11, true);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.74); doc.line(65.4, y + 12.5, 525.9, y + 12.5);
    y += 22.5;
    T(doc, 'OBS:', 70.9, y, 11, true);
    underline(doc, 70.9, 70.9 + doc.getTextWidth('OBS:'), y + 10, 0.7);
    y += 15;
    const escreveBloco = linhasTxt => {
      linhasTxt.forEach(l => {
        if (y + 13 > LIMITE) { doc.addPage(); fundo(doc, a); y = 71.2; }
        T(doc, l, 70.9, y, 10.5, false);
        y += 13;
      });
    };
    escreveBloco(obs);
    if (ccl.length) {
      y += 8;
      T(doc, 'CONDIÇÕES COMERCIAIS:', 70.9, y, 11, true);
      y += 15;
      escreveBloco(ccl);
    }
    if (y + 290 > LIMITE) { doc.addPage(); fundo(doc, a); y = 71.2; }
    y += 12;
    T(doc, up(cfg.texto_autorizo || 'AUTORIZO A EXECUÇÃO DOS PRODUTOS E SERVIÇOS ACIMA ORÇADOS.'), W / 2, y, 11, false, { align: 'center' });

    const cxL = (69.5 + 291.9) / 2, cxR = (299.8 + 522.2) / 2;
    const rot = (txt, cx, yy) => { T(doc, txt, cx, yy, 11, false, { align: 'center' }); const w = doc.getTextWidth(txt); underline(doc, cx - w / 2, cx + w / 2, yy + 9.5, 0.7); };
    rot('RESPONSÁVEL DO ORÇAMENTO', cxL, y + 40.3);
    rot('CLIENTE', cxR, y + 40.3);

    const ny = y + 107.6;
    setF(doc, 11, false);
    T(doc, fit(doc, up(v.nomeCompleto || v.nome || p.vendedor), 215), cxL, ny, 11, false, { align: 'center' });
    T(doc, fit(doc, nomeCliente, 215), cxR, ny, 11, false, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(69.5, ny + 12.5, 291.9, ny + 12.5);
    doc.line(299.8, ny + 12.5, 522.2, ny + 12.5);
    T(doc, 'CPF: ' + (v.cpf || ''), cxL, ny + 14.9, 11, false, { align: 'center' });
    T(doc, 'CPF/CNPJ: ' + (c.documento || ''), cxR, ny + 14.9, 11, false, { align: 'center' });
    doc.setLineWidth(1.4);
    doc.line(69.5, ny + 28, 291.9, ny + 28);
    doc.line(299.8, ny + 28, 522.2, ny + 28);

    const cy = ny + 116.3;
    T(doc, 'CONTATO:', 70.9, cy, 12, true);
    T(doc, fit(doc, (v.codigo ? v.codigo + ' - ' : '') + up(v.nomeCompleto || v.nome || p.vendedor), 380), 141.9, cy, 12, false);
    let ly = cy + 29.3;
    if (v.email) { T(doc, v.email, 141.9, ly, 12, false); ly += 16; }
    if (v.telefone) T(doc, mascaraFone(v.telefone), 141.9, ly, 12, false);

    return doc;
  }

  function mascaraFone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(-11);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return v || '';
  }

  /* ======================================================================
     RELATÓRIOS — tabela no mesmo papel timbrado
     ====================================================================== */
  async function relatorio({ titulo, filtros, resumo, cols, rows, usuario }) {
    const a = await loadAssets();
    const doc = newDoc(a);
    fundo(doc, a);
    const gerado = new Date().toLocaleString('pt-BR');
    T(doc, up(titulo), 70.9, 66, 14, true);
    setF(doc, 9, false);
    doc.splitTextToSize(filtros || '', 300).slice(0, 3).forEach((l, i) => T(doc, l, 70.9, 86 + i * 11, 9, false));
    const res = (resumo || []).map(r => r[0] + ': ' + r[1]).join('   |   ');
    setF(doc, 10, true);
    const resL = doc.splitTextToSize(res, 455);
    resL.forEach((l, i) => T(doc, l, 70.9, 124 + i * 13, 10, true));
    const startY = 124 + resL.length * 13 + 8;

    doc.autoTable({
      head: [cols.map(c => c.l)],
      body: rows.map(r => cols.map(c => String(r[c.k] == null ? '' : r[c.k]))),
      startY,
      margin: { top: TOPO_CONTINUACAO, bottom: 125, left: 65.4, right: W - 531.7 },
      theme: 'plain',
      styles: { font: doc.__font, fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 }, textColor: 20, overflow: 'linebreak' },
      headStyles: { fillColor: [191, 191, 191], textColor: 0, fontStyle: 'bold', fontSize: 9 },
      columnStyles: Object.fromEntries(cols.map((c, i) => [i, c.a === 'r' ? { halign: 'right' } : {}])),
      willDrawPage: data => { if (data.pageNumber > 1) fundo(doc, a); },
      didDrawCell: data => {
        if (data.section !== 'body') return;
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.4);
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    });
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      setF(doc, 8, false);
      doc.setTextColor(110, 110, 110);
      doc.text('Página ' + i + ' de ' + n + '  •  Gerado em ' + gerado + ' por ' + (usuario || ''), 65.4, 726);
    }
    return doc;
  }

  window.VegasPDF = { proposta, relatorio };
})();
