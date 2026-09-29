/**
 * ============================================================================
 *  VEGAS VIGILÂNCIA — PROSPECÇÃO DE CLIENTES
 *  Backend Google Apps Script (API JSON) — Code.gs
 * ============================================================================
 *  • Banco de dados: Google Sheets
 *  • O frontend (index.html / script.js) chama esta API via POST (JSON).
 *  • Execute setupDatabase() UMA vez para criar as abas e os usuários.
 *  • Publique como App da Web: Executar como "Eu" / Acesso "Qualquer pessoa".
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * 1. CONFIGURAÇÃO
 * --------------------------------------------------------------------------*/

/** Cole aqui o ID da planilha (trecho entre /d/ e /edit na URL).
 *  Se deixar vazio, o script usa a planilha à qual está vinculado. */
const SPREADSHEET_ID = '';

/** Dias que o vendedor permanece conectado sem precisar logar de novo. */
const SESSION_DAYS = 30;

/** Fuso horário usado nas datas. */
const TZ = 'America/Sao_Paulo';

/** Status possíveis do cliente (funil comercial). */
const STATUS_CLIENTE = [
  'Novo lead', 'Primeiro contato', 'Em negociação', 'Visita agendada',
  'Orçamento enviado', 'Aguardando retorno', 'Cliente interessado',
  'Cliente ganho', 'Cliente perdido', 'Sem interesse', 'Retornar depois'
];
const STATUS_ENCERRADOS = ['Cliente ganho', 'Cliente perdido', 'Sem interesse'];

/** Estrutura das abas: [chave usada no código, cabeçalho da planilha]. */
const SCHEMA = {
  USUARIOS: [
    ['id', 'ID'], ['nome', 'Nome'], ['usuario', 'Usuário'], ['senha', 'Senha (hash)'],
    ['salt', 'Salt'], ['perfil', 'Perfil'], ['status', 'Status'], ['dataCadastro', 'Data de cadastro'],
    ['nomeCompleto', 'Nome completo'], ['codigo', 'Código'], ['email', 'E-mail'],
    ['telefone', 'Telefone'], ['cpf', 'CPF']
  ],
  CLIENTES: [
    ['id', 'ID'], ['codigo', 'Código'], ['dataCadastro', 'Data de cadastro'], ['vendedor', 'Vendedor'],
    ['usuarioVendedor', 'Usuário vendedor'], ['empresa', 'Empresa'], ['razaoSocial', 'Razão social'],
    ['documento', 'CPF/CNPJ'], ['inscricao', 'Inscrição'], ['segmento', 'Segmento'],
    ['endereco', 'Endereço'], ['numero', 'Número'], ['complemento', 'Complemento'],
    ['bairro', 'Bairro'], ['cidade', 'Cidade'], ['estado', 'Estado'], ['cep', 'CEP'],
    ['contato', 'Nome do contato'], ['cargo', 'Cargo'], ['telefone', 'Telefone'],
    ['whatsapp', 'WhatsApp'], ['email', 'E-mail'], ['origem', 'Origem do lead'], ['status', 'Status'],
    ['interesse', 'Interesse'], ['produtoInteresse', 'Produto de interesse'],
    ['proximoContato', 'Próximo contato'], ['dataProximoContato', 'Data do próximo contato'],
    ['obsCliente', 'Observações para o cliente'], ['obsInterna', 'Observações internas'],
    ['dataAtualizacao', 'Data da última atualização'], ['atualizadoPor', 'Atualizado por'],
    ['latitude', 'Latitude'], ['longitude', 'Longitude']
  ],
  PRODUTOS: [
    ['id', 'ID'], ['codigo', 'Código'], ['produto', 'Produto'], ['categoria', 'Categoria'],
    ['tipo', 'Tipo'], ['descricao', 'Descrição'], ['unidade', 'Unidade'], ['preco', 'Preço'],
    ['status', 'Status'], ['dataAtualizacao', 'Data da última atualização'], ['atualizadoPor', 'Atualizado por']
  ],
  PROSPECCOES: [
    ['id', 'ID'], ['clienteId', 'ID do cliente'], ['cliente', 'Cliente'], ['vendedor', 'Vendedor'],
    ['usuarioVendedor', 'Usuário vendedor'], ['produtoId', 'ID do produto'], ['produto', 'Produto'],
    ['quantidade', 'Quantidade'], ['valor', 'Valor'], ['data', 'Data'], ['status', 'Status'],
    ['observacao', 'Observação'], ['dataAtualizacao', 'Data da última atualização']
  ],
  ATIVIDADES: [
    ['id', 'ID'], ['clienteId', 'ID do cliente'], ['cliente', 'Cliente'], ['vendedor', 'Vendedor'],
    ['usuarioVendedor', 'Usuário vendedor'], ['data', 'Data'], ['tipo', 'Tipo de contato'],
    ['descricao', 'Descrição'], ['resultado', 'Resultado'], ['proximoContato', 'Próximo contato'],
    ['dataProximoContato', 'Data do próximo contato'], ['observacoes', 'Observações']
  ],
  PROPOSTAS: [
    ['id', 'ID'], ['numero', 'Número'], ['dataEmissao', 'Data de emissão'], ['validade', 'Válido até'],
    ['clienteId', 'ID do cliente'], ['cliente', 'Cliente'], ['vendedor', 'Vendedor'],
    ['usuarioVendedor', 'Usuário vendedor'], ['tipoOrcamento', 'Tipo do orçamento'],
    ['itens', 'Itens (JSON)'], ['subtotal', 'Subtotal'], ['desconto', 'Desconto (R$)'],
    ['valorFinal', 'Valor final'], ['incluirMensal', 'Cobrança mensal'], ['valorMensal', 'Valor mensal'],
    ['outrosMensal', 'Outros serviços mensais'], ['totalMensal', 'Total da mensalidade'],
    ['condicoes', 'Condições de pagamento (JSON)'], ['obsCliente', 'Observações para o cliente'],
    ['status', 'Status'], ['dataAtualizacao', 'Data da última atualização']
  ],
  HISTORICO: [
    ['id', 'ID'], ['data', 'Data'], ['usuario', 'Usuário'], ['entidade', 'Entidade'],
    ['entidadeId', 'ID do registro'], ['acao', 'Ação'], ['detalhes', 'Detalhes']
  ],
  CONFIG: [['chave', 'Chave'], ['valor', 'Valor'], ['descricao', 'Descrição']]
};

/** Usuários criados pelo setupDatabase(). Altere as senhas após o primeiro acesso. */
const USUARIOS_INICIAIS = [
  { nome: 'André',   usuario: 'andre',   senha: 'andre123',   perfil: 'vendedor', nomeCompleto: 'ANDRE LUIZ LEAL DA CRUZ', codigo: '11529', email: 'andrecomercial@vegasvigilancia.com.br' },
  { nome: 'Marcio',  usuario: 'marcio',  senha: 'marcio123',  perfil: 'vendedor', nomeCompleto: 'MARCIO' },
  { nome: 'Ronaldo', usuario: 'ronaldo', senha: 'ronaldo123', perfil: 'vendedor', nomeCompleto: 'RONALDO' },
  { nome: 'Osias',   usuario: 'osias',   senha: 'osias123',   perfil: 'vendedor', nomeCompleto: 'OSIAS' },
  { nome: 'Gil',     usuario: 'gil',     senha: 'gil123',     perfil: 'vendedor', nomeCompleto: 'GIL' },
  { nome: 'Juliano', usuario: 'juliano', senha: 'juliano123', perfil: 'vendedor', nomeCompleto: 'JULIANO' },
  { nome: 'Administrador', usuario: 'admin', senha: 'vegas@admin2026', perfil: 'admin', nomeCompleto: 'ADMINISTRADOR' }
];

/** Configurações iniciais (editáveis na aba CONFIG ou na tela Configurações). */
const CONFIG_INICIAL = [
  ['proximo_orcamento', '12987', 'Próximo número de orçamento'],
  ['proximo_cliente', '1', 'Próximo código de cliente'],
  ['validade_dias', '7', 'Dias de validade padrão do orçamento'],
  ['banco', 'Banco Sicoob 100017-9', 'Dados bancários exibidos no orçamento'],
  ['aviso_precos', 'OS PREÇOS PODEM SOFRER ALTERAÇÕES E DEVEM SER CONFIRMADOS ATÉ O FECHAMENTO DA PROPOSTA.', 'Aviso da página 1'],
  ['texto_impostos', 'NOS VALORES ACIMA ESTÃO INCLUSOS TODOS OS IMPOSTOS.', 'Texto da página 2'],
  ['texto_autorizo', 'AUTORIZO A EXECUÇÃO DOS PRODUTOS E SERVIÇOS ACIMA ORÇADOS.', 'Texto de autorização'],
  ['condicoes_comerciais', '', 'Condições comerciais padrão (aparecem no PDF, se preenchidas)'],
  ['empresa_nome', 'VEGAS VIGILÂNCIA E SEGURANÇA', 'Nome da empresa'],
  ['empresa_cnpj', '', 'CNPJ da empresa'],
  ['empresa_telefone', '0800 0522 555', 'Telefone principal'],
  ['empresa_email', 'sac@vegasvigilancia.com.br', 'E-mail'],
  ['empresa_site', 'www.vegasvigilancia.com.br', 'Site']
];

/* ----------------------------------------------------------------------------
 * 2. INICIALIZAÇÃO DO BANCO
 * --------------------------------------------------------------------------*/

/** Cria todas as abas, cabeçalhos, usuários e configurações. Pode ser executada
 *  novamente sem apagar dados: só cria o que estiver faltando. */
function setupDatabase() {
  const ss = getDb_();
  Object.keys(SCHEMA).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SCHEMA[name].map(function (c) { return c[1]; });
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1b1c1f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    // Texto puro em todas as células: preserva zeros à esquerda (códigos, CEP, CPF)
    sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), headers.length).setNumberFormat('@');
  });

  // Usuários
  const existentes = readAll_('USUARIOS').map(function (u) { return u.usuario; });
  USUARIOS_INICIAIS.forEach(function (u) {
    if (existentes.indexOf(u.usuario) !== -1) return;
    const salt = Utilities.getUuid();
    insert_('USUARIOS', {
      id: newId_('USR'), nome: u.nome, usuario: u.usuario, senha: hash_(u.senha, salt), salt: salt,
      perfil: u.perfil, status: 'Ativo', dataCadastro: now_(), nomeCompleto: u.nomeCompleto || u.nome.toUpperCase(),
      codigo: u.codigo || '', email: u.email || '', telefone: '', cpf: ''
    });
  });

  // Configurações
  const chaves = readAll_('CONFIG').map(function (c) { return c.chave; });
  CONFIG_INICIAL.forEach(function (c) {
    if (chaves.indexOf(c[0]) === -1) insert_('CONFIG', { chave: c[0], valor: c[1], descricao: c[2] });
  });

  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && ss.getSheets().length > 1 && padrao.getLastRow() === 0) ss.deleteSheet(padrao);
  CacheService.getScriptCache().removeAll(['USERS']);
  Logger.log('Banco configurado com sucesso.');
  return 'Banco configurado com sucesso.';
}

/* ----------------------------------------------------------------------------
 * 3. ENTRADA HTTP (API)
 * --------------------------------------------------------------------------*/

function doGet() {
  return json_({ ok: true, data: { app: 'Vegas Prospecção API', status: 'online', hora: now_() } });
}

function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = route_(req);
  } catch (err) {
    out = { ok: false, code: err.code || 'ERRO', error: err.message || String(err) };
  }
  return json_(out);
}

/** Mapa de ações disponíveis para usuários autenticados. */
const ACTIONS = {
  bootstrap: bootstrap_,
  dashboard: dashboard_,
  searchClientes: searchClientes_,
  saveCliente: saveCliente_,
  deleteCliente: deleteCliente_,
  updateStatusCliente: updateStatusCliente_,
  saveProduto: saveProduto_,
  deleteProduto: deleteProduto_,
  importProdutos: importProdutos_,
  exportProdutos: exportProdutos_,
  saveProspeccao: saveProspeccao_,
  deleteProspeccao: deleteProspeccao_,
  saveAtividade: saveAtividade_,
  deleteAtividade: deleteAtividade_,
  saveProposta: saveProposta_,
  deleteProposta: deleteProposta_,
  updateStatusProposta: updateStatusProposta_,
  historico: historico_,
  updatePerfil: updatePerfil_,
  changePassword: changePassword_,
  saveUsuario: saveUsuario_,
  saveConfig: saveConfig_,
  logout: logout_
};

function route_(req) {
  const action = String(req.action || '');
  const payload = req.payload || {};
  if (action === 'login') return { ok: true, data: login_(payload) };
  if (action === 'ping') return { ok: true, data: { status: 'online' } };
  const user = auth_(req.token);
  const fn = ACTIONS[action];
  if (!fn) throw new Error('Ação inválida: ' + action);
  return { ok: true, data: fn(payload, user, req.token) };
}

/* ----------------------------------------------------------------------------
 * 4. AUTENTICAÇÃO E SESSÕES
 * --------------------------------------------------------------------------*/

function login_(p) {
  const usuario = clean_(p.usuario, 40).toLowerCase();
  const senha = String(p.senha || '');
  if (!usuario || !senha) throw new Error('Informe usuário e senha.');

  const cache = CacheService.getScriptCache();
  const tentativasKey = 'FAIL_' + usuario;
  const tentativas = Number(cache.get(tentativasKey) || 0);
  if (tentativas >= 6) throw new Error('Muitas tentativas. Aguarde 10 minutos e tente novamente.');

  const u = readAll_('USUARIOS').filter(function (x) { return x.usuario.toLowerCase() === usuario; })[0];
  if (!u || u.status !== 'Ativo' || hash_(senha, u.salt) !== u.senha) {
    cache.put(tentativasKey, String(tentativas + 1), 600);
    throw new Error('Login inválido.');
  }
  cache.remove(tentativasKey);
  limparSessoes_();
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('S_' + token,
    JSON.stringify({ u: u.usuario, exp: Date.now() + SESSION_DAYS * 864e5 }));
  return { token: token, user: publicUser_(u, true) };
}

function auth_(token) {
  const err = new Error('Sua sessão expirou. Entre novamente.');
  err.code = 'AUTH';
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) throw err;
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('S_' + token);
  if (!raw) throw err;
  const s = JSON.parse(raw);
  if (s.exp < Date.now()) { props.deleteProperty('S_' + token); throw err; }
  // Renovação automática da sessão (sessão deslizante)
  if (s.exp - Date.now() < (SESSION_DAYS - 1) * 864e5) {
    s.exp = Date.now() + SESSION_DAYS * 864e5;
    props.setProperty('S_' + token, JSON.stringify(s));
  }
  const u = usersMap_()[s.u];
  if (!u || u.status !== 'Ativo') { props.deleteProperty('S_' + token); throw err; }
  return u;
}

function logout_(p, user, token) {
  PropertiesService.getScriptProperties().deleteProperty('S_' + token);
  return true;
}

function limparSessoes_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/** Mapa usuario → dados (com cache de 5 minutos). */
function usersMap_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('USERS');
  if (c) return JSON.parse(c);
  const map = {};
  readAll_('USUARIOS').forEach(function (u) { map[u.usuario] = publicUser_(u, true); });
  cache.put('USERS', JSON.stringify(map), 300);
  return map;
}

/** Remove senha/salt antes de enviar ao frontend. */
function publicUser_(u, completo) {
  const o = { id: u.id, nome: u.nome, usuario: u.usuario, perfil: u.perfil, status: u.status };
  if (completo) {
    o.nomeCompleto = u.nomeCompleto; o.codigo = u.codigo; o.email = u.email;
    o.telefone = u.telefone; o.cpf = u.cpf; o.dataCadastro = u.dataCadastro;
  }
  return o;
}

function isAdmin_(user) { return user.perfil === 'admin'; }

function podeAlterar_(registro, user) {
  if (isAdmin_(user) || registro.usuarioVendedor === user.usuario) return;
  throw new Error('Este registro pertence ao vendedor ' + (registro.vendedor || registro.usuarioVendedor) + '. Você não pode alterá-lo.');
}

function hash_(senha, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + senha, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

/* ----------------------------------------------------------------------------
 * 5. CARGA INICIAL E DASHBOARD
 * --------------------------------------------------------------------------*/

/** Retorna todos os dados que o usuário pode ver. Vendedor: só os próprios. */
function bootstrap_(p, user) {
  const mine = function (r) { return isAdmin_(user) || r.usuarioVendedor === user.usuario; };
  const users = readAll_('USUARIOS').map(function (u) { return publicUser_(u, isAdmin_(user) || u.usuario === user.usuario); });
  return {
    user: usersMap_()[user.usuario],
    usuarios: users,
    clientes: readAll_('CLIENTES').filter(mine),
    produtos: readAll_('PRODUTOS'),
    prospeccoes: readAll_('PROSPECCOES').filter(mine),
    atividades: readAll_('ATIVIDADES').filter(mine),
    propostas: readAll_('PROPOSTAS').filter(mine),
    config: getConfig_(),
    statusCliente: STATUS_CLIENTE,
    serverTime: now_()
  };
}

/** Indicadores e séries para os gráficos.
 *  p.vendedor: usuário a filtrar (admin pode deixar vazio para "todos"). */
function dashboard_(p, user) {
  const alvo = isAdmin_(user) ? clean_(p.vendedor, 40) : user.usuario;
  const f = function (r) { return !alvo || r.usuarioVendedor === alvo; };
  const clientes = readAll_('CLIENTES').filter(f);
  const atividades = readAll_('ATIVIDADES').filter(f);
  const propostas = readAll_('PROPOSTAS').filter(f);
  const hoje = today_();
  const limiteNovos = Utilities.formatDate(new Date(Date.now() - 30 * 864e5), TZ, 'yyyy-MM-dd');
  const comContato = {};
  atividades.forEach(function (a) { comContato[a.clienteId] = true; });

  const count = function (arr, fn) { return arr.filter(fn).length; };
  const cards = {
    totalClientes: clientes.length,
    novosClientes: count(clientes, function (c) { return c.dataCadastro.slice(0, 10) >= limiteNovos; }),
    emAndamento: count(clientes, function (c) { return STATUS_ENCERRADOS.indexOf(c.status) === -1 && c.status !== 'Novo lead'; }),
    contatoHoje: count(clientes, function (c) { return c.dataProximoContato.slice(0, 10) === hoje && STATUS_ENCERRADOS.indexOf(c.status) === -1; }),
    atrasados: count(clientes, function (c) { return c.dataProximoContato && c.dataProximoContato.slice(0, 10) < hoje && STATUS_ENCERRADOS.indexOf(c.status) === -1; }),
    semContato: count(clientes, function (c) { return !comContato[c.id]; }),
    propostasEnviadas: propostas.length,
    valorPropostas: propostas.reduce(function (s, x) { return s + num_(x.valorFinal); }, 0),
    ganhos: count(clientes, function (c) { return c.status === 'Cliente ganho'; }),
    perdidos: count(clientes, function (c) { return c.status === 'Cliente perdido' || c.status === 'Sem interesse'; })
  };

  const group = function (arr, key) {
    const o = {};
    arr.forEach(function (r) { const k = r[key] || 'Não informado'; o[k] = (o[k] || 0) + 1; });
    return o;
  };
  // Últimos 6 meses
  const meses = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    meses.push(Utilities.formatDate(m, TZ, 'yyyy-MM'));
  }
  const periodo = meses.map(function (m) {
    return {
      mes: m,
      clientes: count(clientes, function (c) { return c.dataCadastro.slice(0, 7) === m; }),
      propostas: count(propostas, function (x) { return x.dataEmissao.slice(0, 7) === m; }),
      ganhos: count(clientes, function (c) { return c.status === 'Cliente ganho' && c.dataAtualizacao.slice(0, 7) === m; })
    };
  });
  const porStatus = {};
  STATUS_CLIENTE.forEach(function (s) { porStatus[s] = 0; });
  clientes.forEach(function (c) { if (porStatus[c.status] !== undefined) porStatus[c.status]++; });

  return {
    vendedor: alvo,
    cards: cards,
    porVendedor: group(clientes, 'vendedor'),
    porStatus: porStatus,
    porSegmento: group(clientes, 'segmento'),
    periodo: periodo
  };
}

/* ----------------------------------------------------------------------------
 * 6. CLIENTES
 * --------------------------------------------------------------------------*/

const CAMPOS_CLIENTE = ['empresa', 'razaoSocial', 'documento', 'inscricao', 'segmento', 'endereco', 'numero',
  'complemento', 'bairro', 'cidade', 'estado', 'cep', 'contato', 'cargo', 'telefone', 'whatsapp', 'email',
  'origem', 'status', 'interesse', 'produtoInteresse', 'proximoContato', 'dataProximoContato', 'obsCliente', 'obsInterna',
  'latitude', 'longitude'];

function searchClientes_(p, user) {
  const q = normalize_(p.q || '');
  const qd = digits_(p.q || '');
  return readAll_('CLIENTES').filter(function (c) {
    if (!isAdmin_(user) && c.usuarioVendedor !== user.usuario) return false;
    if (p.status && c.status !== p.status) return false;
    if (p.cidade && normalize_(c.cidade) !== normalize_(p.cidade)) return false;
    if (p.segmento && c.segmento !== p.segmento) return false;
    if (p.vendedor && c.usuarioVendedor !== p.vendedor) return false;
    if (!q) return true;
    const texto = normalize_([c.empresa, c.razaoSocial, c.contato, c.email, c.cidade, c.vendedor, c.status, c.codigo].join(' '));
    if (texto.indexOf(q) !== -1) return true;
    return qd.length >= 3 && [c.documento, c.telefone, c.whatsapp].some(function (v) { return digits_(v).indexOf(qd) !== -1; });
  });
}

function saveCliente_(p, user) {
  const lock = lock_();
  try {
    const data = {};
    CAMPOS_CLIENTE.forEach(function (k) { data[k] = clean_(p[k], k.indexOf('obs') === 0 ? 5000 : 300); });
    data.estado = data.estado.toUpperCase().slice(0, 2);
    data.email = data.email.toLowerCase();
    if (!data.empresa && !data.contato) throw new Error('Informe o nome da empresa ou do contato.');
    if (data.status && STATUS_CLIENTE.indexOf(data.status) === -1) throw new Error('Status inválido.');
    if (!data.status) data.status = 'Novo lead';
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('E-mail inválido.');
    if (data.documento && !validaDocumento_(data.documento)) throw new Error('CPF/CNPJ inválido.');
    if (data.dataProximoContato && !/^\d{4}-\d{2}-\d{2}$/.test(data.dataProximoContato)) throw new Error('Data do próximo contato inválida.');
    ['latitude', 'longitude'].forEach(function (k) { if (data[k] && !/^-?\d{1,3}\.\d+$/.test(data[k])) data[k] = ''; });

    const todos = readAll_('CLIENTES');
    const atual = p.id ? todos.filter(function (c) { return c.id === p.id; })[0] : null;
    if (p.id && !atual) throw new Error('Cliente não encontrado.');
    if (atual) podeAlterar_(atual, user);

    // Verificação de duplicidade (em toda a base, inclusive de outros vendedores)
    const outros = todos.filter(function (c) { return !atual || c.id !== atual.id; });
    const doc = digits_(data.documento);
    if (doc) {
      const dupDoc = outros.filter(function (c) { return digits_(c.documento) === doc; })[0];
      if (dupDoc) throw new Error('CPF/CNPJ já cadastrado para "' + (dupDoc.empresa || dupDoc.contato) + '" (vendedor ' + dupDoc.vendedor + ').');
    }
    if (!p.confirmarDuplicado) {
      const fones = [digits_(data.telefone), digits_(data.whatsapp)].filter(function (x) { return x.length >= 8; });
      const nome = normalize_(data.empresa);
      const dup = outros.filter(function (c) {
        const mesmoFone = fones.some(function (f) { return f === digits_(c.telefone) || f === digits_(c.whatsapp); });
        const mesmoNome = nome && normalize_(c.empresa) === nome && normalize_(c.cidade) === normalize_(data.cidade);
        return mesmoFone || mesmoNome;
      })[0];
      if (dup) {
        const e = new Error('Possível duplicidade: "' + (dup.empresa || dup.contato) + '" já está cadastrado (vendedor ' + dup.vendedor + ') com o mesmo telefone ou nome/cidade.');
        e.code = 'DUP';
        throw e;
      }
    }

    // Vendedor responsável: vendedor comum sempre fica como responsável; admin pode escolher
    let dono = user;
    if (isAdmin_(user) && p.usuarioVendedor) dono = usersMap_()[p.usuarioVendedor] || user;
    else if (atual) dono = usersMap_()[atual.usuarioVendedor] || { nome: atual.vendedor, usuario: atual.usuarioVendedor };

    data.vendedor = dono.nome;
    data.usuarioVendedor = dono.usuario;
    data.dataAtualizacao = now_();
    data.atualizadoPor = user.nome;

    if (atual) {
      const mudancas = diff_(atual, data, CAMPOS_CLIENTE.concat(['usuarioVendedor']));
      const salvo = update_('CLIENTES', atual.id, data);
      if (mudancas) log_(user, 'CLIENTE', atual.id, 'Alteração', mudancas);
      return salvo;
    }
    data.id = newId_('CLI');
    data.codigo = nextCounter_('proximo_cliente');
    data.dataCadastro = now_();
    insert_('CLIENTES', data);
    log_(user, 'CLIENTE', data.id, 'Cadastro', 'Cliente cadastrado com status "' + data.status + '"');
    return data;
  } finally { lock.releaseLock(); }
}

function deleteCliente_(p, user) {
  const lock = lock_();
  try {
    const c = findById_('CLIENTES', p.id);
    if (!c) throw new Error('Cliente não encontrado.');
    podeAlterar_(c, user);
    remove_('CLIENTES', c.id);
    // Remove interesses e contatos vinculados (propostas ficam guardadas como histórico)
    removeWhere_('PROSPECCOES', function (r) { return r.clienteId === c.id; });
    removeWhere_('ATIVIDADES', function (r) { return r.clienteId === c.id; });
    log_(user, 'CLIENTE', c.id, 'Exclusão', 'Cliente "' + (c.empresa || c.contato) + '" excluído');
    return true;
  } finally { lock.releaseLock(); }
}

function updateStatusCliente_(p, user) {
  const lock = lock_();
  try {
    const c = findById_('CLIENTES', p.id);
    if (!c) throw new Error('Cliente não encontrado.');
    podeAlterar_(c, user);
    if (STATUS_CLIENTE.indexOf(p.status) === -1) throw new Error('Status inválido.');
    const salvo = update_('CLIENTES', c.id, { status: p.status, dataAtualizacao: now_(), atualizadoPor: user.nome });
    log_(user, 'CLIENTE', c.id, 'Status', 'Status: "' + c.status + '" → "' + p.status + '"');
    return salvo;
  } finally { lock.releaseLock(); }
}

/* ----------------------------------------------------------------------------
 * 7. PRODUTOS (catálogo, importação e exportação CSV)
 * --------------------------------------------------------------------------*/

function produtoData_(p) {
  const d = {
    codigo: clean_(p.codigo, 40),
    produto: clean_(p.produto, 200),
    categoria: clean_(p.categoria, 80),
    tipo: clean_(p.tipo, 20) === 'Serviço' ? 'Serviço' : 'Produto',
    descricao: clean_(p.descricao, 1000),
    unidade: clean_(p.unidade, 20) || 'UN',
    preco: String(round2_(num_(p.preco))),
    status: clean_(p.status, 20) === 'Inativo' ? 'Inativo' : 'Ativo'
  };
  if (!d.produto) throw new Error('Informe o nome do produto.');
  if (num_(p.preco) < 0) throw new Error('O preço não pode ser negativo.');
  return d;
}

function saveProduto_(p, user) {
  const lock = lock_();
  try {
    const d = produtoData_(p);
    const todos = readAll_('PRODUTOS');
    if (d.codigo) {
      const dup = todos.filter(function (x) { return x.codigo === d.codigo && x.id !== p.id; })[0];
      if (dup) throw new Error('Já existe um produto com o código ' + d.codigo + ' (' + dup.produto + ').');
    }
    d.dataAtualizacao = now_();
    d.atualizadoPor = user.nome;
    if (p.id) {
      const atual = todos.filter(function (x) { return x.id === p.id; })[0];
      if (!atual) throw new Error('Produto não encontrado.');
      const salvo = update_('PRODUTOS', p.id, d);
      log_(user, 'PRODUTO', p.id, 'Alteração', diff_(atual, d, Object.keys(d).filter(function (k) { return k !== 'dataAtualizacao' && k !== 'atualizadoPor'; })) || 'Sem mudanças');
      return salvo;
    }
    d.id = newId_('PRD');
    if (!d.codigo) d.codigo = proximoCodigoProduto_(todos);
    insert_('PRODUTOS', d);
    log_(user, 'PRODUTO', d.id, 'Cadastro', d.codigo + ' - ' + d.produto);
    return d;
  } finally { lock.releaseLock(); }
}

function proximoCodigoProduto_(todos) {
  const max = todos.reduce(function (m, x) { const n = parseInt(digits_(x.codigo), 10); return isNaN(n) ? m : Math.max(m, n); }, 0);
  return String(max + 1).padStart(6, '0');
}

function deleteProduto_(p, user) {
  const lock = lock_();
  try {
    const x = findById_('PRODUTOS', p.id);
    if (!x) throw new Error('Produto não encontrado.');
    remove_('PRODUTOS', x.id);
    log_(user, 'PRODUTO', x.id, 'Exclusão', x.codigo + ' - ' + x.produto);
    return true;
  } finally { lock.releaseLock(); }
}

/** p.produtos: [{codigo, produto, categoria, tipo, descricao, unidade, preco, status}]
 *  p.atualizarExistentes: se true, atualiza produtos com o mesmo código. */
function importProdutos_(p, user) {
  const lock = lock_(60000);
  try {
    const lista = Array.isArray(p.produtos) ? p.produtos : [];
    if (!lista.length) throw new Error('Nenhum produto para importar.');
    if (lista.length > 2000) throw new Error('Envie no máximo 2.000 produtos por vez.');
    const todos = readAll_('PRODUTOS');
    const porCodigo = {};
    todos.forEach(function (x) { if (x.codigo) porCodigo[x.codigo] = x; });
    const novos = [], erros = [];
    let atualizados = 0, ignorados = 0;
    const sh = sheet_('PRODUTOS');

    lista.forEach(function (item, i) {
      const linha = (item._linha || i + 2);
      try {
        const d = produtoData_(item);
        d.dataAtualizacao = now_();
        d.atualizadoPor = user.nome;
        const existente = d.codigo && porCodigo[d.codigo];
        if (existente) {
          if (!p.atualizarExistentes) { ignorados++; return; }
          const row = SCHEMA.PRODUTOS.map(function (c) { return safe_(c[0] in d ? d[c[0]] : existente[c[0]]); });
          sh.getRange(existente._row, 1, 1, row.length).setValues([row]);
          atualizados++;
          return;
        }
        d.id = newId_('PRD');
        if (!d.codigo) d.codigo = proximoCodigoProduto_(todos.concat(novos));
        porCodigo[d.codigo] = d;
        novos.push(d);
      } catch (e) { erros.push('Linha ' + linha + ': ' + e.message); }
    });

    if (novos.length) {
      const rows = novos.map(function (d) { return SCHEMA.PRODUTOS.map(function (c) { return safe_(d[c[0]] || ''); }); });
      const start = sh.getLastRow() + 1;
      const range = sh.getRange(start, 1, rows.length, SCHEMA.PRODUTOS.length);
      range.setNumberFormat('@');
      range.setValues(rows);
    }
    log_(user, 'PRODUTO', '-', 'Importação CSV', novos.length + ' novos, ' + atualizados + ' atualizados, ' + ignorados + ' ignorados, ' + erros.length + ' erros');
    return { importados: novos.length, atualizados: atualizados, ignorados: ignorados, erros: erros, produtos: readAll_('PRODUTOS') };
  } finally { lock.releaseLock(); }
}

/** Retorna o catálogo em CSV (separador ponto e vírgula, UTF-8). */
function exportProdutos_() {
  const cols = ['codigo', 'produto', 'categoria', 'tipo', 'descricao', 'unidade', 'preco', 'status'];
  const head = ['Código', 'Produto', 'Categoria', 'Tipo', 'Descrição', 'Unidade', 'Preço', 'Status'];
  const q = function (v) { v = String(v == null ? '' : v); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [head.join(';')].concat(readAll_('PRODUTOS').map(function (x) {
    return cols.map(function (k) { return q(k === 'preco' ? String(num_(x.preco).toFixed(2)).replace('.', ',') : x[k]); }).join(';');
  }));
  return { csv: lines.join('\r\n'), nome: 'produtos_vegas_' + today_() + '.csv' };
}

/* ----------------------------------------------------------------------------
 * 8. PROSPECÇÕES (produtos de interesse do cliente)
 * --------------------------------------------------------------------------*/

function saveProspeccao_(p, user) {
  const lock = lock_();
  try {
    const cliente = findById_('CLIENTES', p.clienteId);
    if (!cliente) throw new Error('Cliente não encontrado.');
    podeAlterar_(cliente, user);
    const d = {
      clienteId: cliente.id, cliente: cliente.empresa || cliente.contato,
      vendedor: cliente.vendedor, usuarioVendedor: cliente.usuarioVendedor,
      produtoId: clean_(p.produtoId, 40), produto: clean_(p.produto, 200),
      quantidade: String(num_(p.quantidade) || 1), valor: String(round2_(num_(p.valor))),
      status: clean_(p.status, 40) || 'Em andamento', observacao: clean_(p.observacao, 1000),
      dataAtualizacao: now_()
    };
    if (!d.produto) throw new Error('Selecione o produto.');
    if (p.id) {
      const atual = findById_('PROSPECCOES', p.id);
      if (!atual) throw new Error('Prospecção não encontrada.');
      podeAlterar_(atual, user);
      const salvo = update_('PROSPECCOES', p.id, d);
      log_(user, 'CLIENTE', cliente.id, 'Produto de interesse', 'Atualizado: ' + d.produto + ' (' + d.status + ')');
      return salvo;
    }
    d.id = newId_('PRS');
    d.data = now_();
    insert_('PROSPECCOES', d);
    log_(user, 'CLIENTE', cliente.id, 'Produto de interesse', 'Adicionado: ' + d.quantidade + 'x ' + d.produto);
    return d;
  } finally { lock.releaseLock(); }
}

function deleteProspeccao_(p, user) {
  const lock = lock_();
  try {
    const x = findById_('PROSPECCOES', p.id);
    if (!x) throw new Error('Prospecção não encontrada.');
    podeAlterar_(x, user);
    remove_('PROSPECCOES', x.id);
    log_(user, 'CLIENTE', x.clienteId, 'Produto de interesse', 'Removido: ' + x.produto);
    return true;
  } finally { lock.releaseLock(); }
}

/* ----------------------------------------------------------------------------
 * 9. ATIVIDADES (histórico de contatos)
 * --------------------------------------------------------------------------*/

const TIPOS_CONTATO = ['Ligação', 'WhatsApp', 'E-mail', 'Visita', 'Reunião', 'Orçamento', 'Outro'];

function saveAtividade_(p, user) {
  const lock = lock_();
  try {
    const cliente = findById_('CLIENTES', p.clienteId);
    if (!cliente) throw new Error('Cliente não encontrado.');
    podeAlterar_(cliente, user);
    const d = {
      id: newId_('ATV'), clienteId: cliente.id, cliente: cliente.empresa || cliente.contato,
      vendedor: user.nome, usuarioVendedor: cliente.usuarioVendedor,
      data: clean_(p.data, 20) || now_(), tipo: clean_(p.tipo, 30), descricao: clean_(p.descricao, 3000),
      resultado: clean_(p.resultado, 300), proximoContato: clean_(p.proximoContato, 300),
      dataProximoContato: clean_(p.dataProximoContato, 10), observacoes: clean_(p.observacoes, 3000)
    };
    if (TIPOS_CONTATO.indexOf(d.tipo) === -1) throw new Error('Tipo de contato inválido.');
    if (!d.descricao) throw new Error('Descreva o contato realizado.');
    insert_('ATIVIDADES', d);

    // Atualiza o próximo contato / status do cliente
    const patch = { dataAtualizacao: now_(), atualizadoPor: user.nome, dataProximoContato: d.dataProximoContato, proximoContato: d.proximoContato };
    if (p.novoStatus && STATUS_CLIENTE.indexOf(p.novoStatus) !== -1 && p.novoStatus !== cliente.status) {
      patch.status = p.novoStatus;
      log_(user, 'CLIENTE', cliente.id, 'Status', 'Status: "' + cliente.status + '" → "' + p.novoStatus + '"');
    }
    const clienteSalvo = update_('CLIENTES', cliente.id, patch);
    log_(user, 'CLIENTE', cliente.id, 'Contato registrado', d.tipo + ': ' + d.descricao.slice(0, 120));
    return { atividade: d, cliente: clienteSalvo };
  } finally { lock.releaseLock(); }
}

function deleteAtividade_(p, user) {
  const lock = lock_();
  try {
    const x = findById_('ATIVIDADES', p.id);
    if (!x) throw new Error('Contato não encontrado.');
    podeAlterar_(x, user);
    remove_('ATIVIDADES', x.id);
    log_(user, 'CLIENTE', x.clienteId, 'Contato excluído', x.tipo + ' de ' + x.data);
    return true;
  } finally { lock.releaseLock(); }
}

/* ----------------------------------------------------------------------------
 * 10. PROPOSTAS / ORÇAMENTOS
 * --------------------------------------------------------------------------*/

function saveProposta_(p, user) {
  const lock = lock_();
  try {
    const cliente = findById_('CLIENTES', p.clienteId);
    if (!cliente) throw new Error('Selecione um cliente válido.');
    podeAlterar_(cliente, user);

    const itens = (Array.isArray(p.itens) ? p.itens : []).slice(0, 200).map(function (i) {
      const qtd = num_(i.quantidade) || 1;
      const unit = round2_(num_(i.valorUnitario));
      const locado = !!i.locado;
      const desc = Math.min(round2_(num_(i.desconto)), locado ? 0 : qtd * unit);
      return {
        produtoId: clean_(i.produtoId, 40), codigo: clean_(i.codigo, 40), descricao: clean_(i.descricao, 200),
        tipo: i.tipo === 'Serviço' ? 'Serviço' : 'Produto', unidade: clean_(i.unidade, 20),
        quantidade: qtd, valorUnitario: unit, desconto: desc, locado: locado,
        total: locado ? 0 : round2_(qtd * unit - desc)
      };
    }).filter(function (i) { return i.descricao; });
    if (!itens.length) throw new Error('Adicione pelo menos um produto ou serviço.');

    const subtotal = round2_(itens.reduce(function (s, i) { return s + i.total; }, 0));
    let desconto = round2_(num_(p.desconto));
    if (p.descontoTipo === '%') desconto = round2_(subtotal * Math.min(num_(p.desconto), 100) / 100);
    desconto = Math.min(Math.max(desconto, 0), subtotal);
    const valorFinal = round2_(subtotal - desconto);
    const valorMensal = round2_(num_(p.valorMensal));
    const outrosMensal = round2_(num_(p.outrosMensal));
    const condicoes = (Array.isArray(p.condicoes) ? p.condicoes : []).slice(0, 6).map(function (c) {
      return { entrada: clean_(c.entrada, 40), condicao: clean_(c.condicao, 80), parcelas: clean_(c.parcelas, 40), valor: round2_(num_(c.valor)) };
    });

    const d = {
      clienteId: cliente.id, cliente: cliente.empresa || cliente.contato,
      vendedor: user.nome, usuarioVendedor: cliente.usuarioVendedor,
      tipoOrcamento: clean_(p.tipoOrcamento, 40) || 'Venda',
      validade: clean_(p.validade, 20), itens: JSON.stringify(itens),
      subtotal: String(subtotal), desconto: String(desconto), valorFinal: String(valorFinal),
      incluirMensal: p.incluirMensal ? 'Sim' : 'Não', valorMensal: String(valorMensal), outrosMensal: String(outrosMensal),
      totalMensal: String(round2_(valorMensal + outrosMensal)), condicoes: JSON.stringify(condicoes),
      obsCliente: clean_(p.obsCliente, 5000), status: clean_(p.status, 30) || 'Enviada', dataAtualizacao: now_()
    };

    let salvo;
    if (p.id) {
      const atual = findById_('PROPOSTAS', p.id);
      if (!atual) throw new Error('Proposta não encontrada.');
      podeAlterar_(atual, user);
      d.vendedor = atual.vendedor;
      salvo = update_('PROPOSTAS', p.id, d);
      log_(user, 'CLIENTE', cliente.id, 'Orçamento alterado', 'Nº ' + atual.numero + ' — valor final ' + valorFinal.toFixed(2));
    } else {
      d.id = newId_('PRP');
      d.numero = nextCounter_('proximo_orcamento');
      d.dataEmissao = now_();
      if (!d.validade) {
        const dias = Number(getConfig_().validade_dias || 7);
        d.validade = Utilities.formatDate(new Date(Date.now() + dias * 864e5), TZ, 'yyyy-MM-dd HH:mm:ss');
      }
      insert_('PROPOSTAS', d);
      salvo = d;
      log_(user, 'CLIENTE', cliente.id, 'Orçamento criado', 'Nº ' + d.numero + ' — valor final ' + valorFinal.toFixed(2));
    }

    // Opcional: registra contato do tipo "Orçamento" e move o cliente no funil
    let clienteSalvo = cliente;
    if (p.atualizarStatusCliente && !p.id) {
      insert_('ATIVIDADES', {
        id: newId_('ATV'), clienteId: cliente.id, cliente: d.cliente, vendedor: user.nome,
        usuarioVendedor: cliente.usuarioVendedor, data: now_(), tipo: 'Orçamento',
        descricao: 'Orçamento Nº ' + salvo.numero + ' gerado (' + d.tipoOrcamento + ').',
        resultado: 'Orçamento enviado', proximoContato: cliente.proximoContato,
        dataProximoContato: cliente.dataProximoContato, observacoes: ''
      });
      if (cliente.status !== 'Orçamento enviado' && STATUS_ENCERRADOS.indexOf(cliente.status) === -1) {
        clienteSalvo = update_('CLIENTES', cliente.id, { status: 'Orçamento enviado', dataAtualizacao: now_(), atualizadoPor: user.nome });
        log_(user, 'CLIENTE', cliente.id, 'Status', 'Status: "' + cliente.status + '" → "Orçamento enviado"');
      }
    }
    return { proposta: salvo, cliente: clienteSalvo, atividades: readAll_('ATIVIDADES').filter(function (a) { return a.clienteId === cliente.id; }) };
  } finally { lock.releaseLock(); }
}

function deleteProposta_(p, user) {
  const lock = lock_();
  try {
    const x = findById_('PROPOSTAS', p.id);
    if (!x) throw new Error('Proposta não encontrada.');
    podeAlterar_(x, user);
    remove_('PROPOSTAS', x.id);
    log_(user, 'CLIENTE', x.clienteId, 'Orçamento excluído', 'Nº ' + x.numero);
    return true;
  } finally { lock.releaseLock(); }
}

function updateStatusProposta_(p, user) {
  const lock = lock_();
  try {
    const x = findById_('PROPOSTAS', p.id);
    if (!x) throw new Error('Proposta não encontrada.');
    podeAlterar_(x, user);
    const permitidos = ['Rascunho', 'Enviada', 'Aprovada', 'Recusada', 'Expirada'];
    if (permitidos.indexOf(p.status) === -1) throw new Error('Status inválido.');
    const salvo = update_('PROPOSTAS', x.id, { status: p.status, dataAtualizacao: now_() });
    log_(user, 'CLIENTE', x.clienteId, 'Orçamento', 'Nº ' + x.numero + ': "' + x.status + '" → "' + p.status + '"');
    return salvo;
  } finally { lock.releaseLock(); }
}

/* ----------------------------------------------------------------------------
 * 11. HISTÓRICO DE ALTERAÇÕES
 * --------------------------------------------------------------------------*/

function historico_(p, user) {
  const id = clean_(p.entidadeId, 40);
  if (!id) return [];
  if (!isAdmin_(user)) {
    const c = findById_('CLIENTES', id);
    if (c) podeAlterar_(c, user);
  }
  return readAll_('HISTORICO').filter(function (h) { return h.entidadeId === id; }).reverse().slice(0, 300);
}

function log_(user, entidade, id, acao, detalhes) {
  insert_('HISTORICO', { id: newId_('LOG'), data: now_(), usuario: user.nome, entidade: entidade, entidadeId: id, acao: acao, detalhes: String(detalhes || '').slice(0, 2000) });
}

function diff_(antes, depois, campos) {
  const m = [];
  campos.forEach(function (k) {
    if (!(k in depois)) return;
    const a = String(antes[k] == null ? '' : antes[k]), b = String(depois[k] == null ? '' : depois[k]);
    if (a !== b) m.push(k + ': "' + a.slice(0, 60) + '" → "' + b.slice(0, 60) + '"');
  });
  return m.join(' | ');
}

/* ----------------------------------------------------------------------------
 * 12. USUÁRIOS, PERFIL E CONFIGURAÇÕES
 * --------------------------------------------------------------------------*/

function updatePerfil_(p, user) {
  const lock = lock_();
  try {
    const patch = {
      nomeCompleto: clean_(p.nomeCompleto, 120).toUpperCase(), codigo: clean_(p.codigo, 20),
      email: clean_(p.email, 120).toLowerCase(), telefone: clean_(p.telefone, 30), cpf: clean_(p.cpf, 20)
    };
    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) throw new Error('E-mail inválido.');
    if (patch.cpf && !validaDocumento_(patch.cpf)) throw new Error('CPF inválido.');
    update_('USUARIOS', user.id, patch);
    CacheService.getScriptCache().remove('USERS');
    return usersMap_()[user.usuario];
  } finally { lock.releaseLock(); }
}

function changePassword_(p, user) {
  const u = findById_('USUARIOS', user.id);
  if (hash_(String(p.atual || ''), u.salt) !== u.senha) throw new Error('A senha atual está incorreta.');
  const nova = String(p.nova || '');
  if (nova.length < 6) throw new Error('A nova senha precisa ter pelo menos 6 caracteres.');
  const salt = Utilities.getUuid();
  update_('USUARIOS', u.id, { senha: hash_(nova, salt), salt: salt });
  log_(user, 'USUARIO', u.id, 'Senha alterada', '');
  return true;
}

/** Admin: cria/edita vendedores, ativa/desativa e redefine senha. */
function saveUsuario_(p, user) {
  if (!isAdmin_(user)) throw new Error('Apenas o administrador pode gerenciar usuários.');
  const lock = lock_();
  try {
    const todos = readAll_('USUARIOS');
    const usuario = clean_(p.usuario, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const d = {
      nome: clean_(p.nome, 60), usuario: usuario, perfil: p.perfil === 'admin' ? 'admin' : 'vendedor',
      status: p.status === 'Inativo' ? 'Inativo' : 'Ativo', nomeCompleto: clean_(p.nomeCompleto, 120).toUpperCase(),
      codigo: clean_(p.codigo, 20), email: clean_(p.email, 120).toLowerCase(), telefone: clean_(p.telefone, 30), cpf: clean_(p.cpf, 20)
    };
    if (!d.nome || !d.usuario) throw new Error('Informe nome e usuário.');
    if (todos.some(function (u) { return u.usuario === d.usuario && u.id !== p.id; })) throw new Error('Este usuário já existe.');
    if (p.novaSenha) {
      if (String(p.novaSenha).length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      d.salt = Utilities.getUuid();
      d.senha = hash_(String(p.novaSenha), d.salt);
    }
    let salvo;
    if (p.id) {
      const atual = todos.filter(function (u) { return u.id === p.id; })[0];
      if (!atual) throw new Error('Usuário não encontrado.');
      if (atual.usuario === user.usuario && (d.status === 'Inativo' || d.perfil !== 'admin')) throw new Error('Você não pode desativar ou rebaixar o próprio acesso.');
      salvo = update_('USUARIOS', p.id, d);
      log_(user, 'USUARIO', p.id, 'Alteração', d.usuario + (p.novaSenha ? ' (senha redefinida)' : ''));
    } else {
      if (!p.novaSenha) throw new Error('Defina a senha inicial do usuário.');
      d.id = newId_('USR'); d.dataCadastro = now_();
      insert_('USUARIOS', d);
      salvo = d;
      log_(user, 'USUARIO', d.id, 'Cadastro', d.usuario);
    }
    CacheService.getScriptCache().remove('USERS');
    return publicUser_(salvo, true);
  } finally { lock.releaseLock(); }
}

function getConfig_() {
  const o = {};
  readAll_('CONFIG').forEach(function (c) { o[c.chave] = c.valor; });
  return o;
}

function saveConfig_(p, user) {
  if (!isAdmin_(user)) throw new Error('Apenas o administrador pode alterar as configurações.');
  const lock = lock_();
  try {
    const sh = sheet_('CONFIG');
    const atuais = readAll_('CONFIG');
    Object.keys(p || {}).forEach(function (k) {
      if (!/^[a-z_]{2,40}$/.test(k)) return;
      const v = clean_(p[k], 3000);
      const ex = atuais.filter(function (c) { return c.chave === k; })[0];
      if (ex) sh.getRange(ex._row, 2).setValue(safe_(v));
      else insert_('CONFIG', { chave: k, valor: v, descricao: '' });
    });
    log_(user, 'CONFIG', '-', 'Alteração', Object.keys(p || {}).join(', '));
    return getConfig_();
  } finally { lock.releaseLock(); }
}

/* ----------------------------------------------------------------------------
 * 13. CAMADA DE ACESSO À PLANILHA
 * --------------------------------------------------------------------------*/

function getDb_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const sh = getDb_().getSheetByName(name);
  if (!sh) throw new Error('A aba ' + name + ' não existe. Execute setupDatabase() no editor do Apps Script.');
  return sh;
}

/** Lê a aba inteira e devolve objetos {chave: valor} (inclui _row). */
function readAll_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const cols = SCHEMA[name];
  return sh.getRange(2, 1, last - 1, cols.length).getValues()
    .map(function (r, i) {
      const o = { _row: i + 2 };
      cols.forEach(function (c, j) { o[c[0]] = norm_(r[j]); });
      return o;
    })
    .filter(function (o) { return o[cols[0][0]] !== ''; });
}

function findById_(name, id) {
  if (!id) return null;
  return readAll_(name).filter(function (r) { return r.id === String(id); })[0] || null;
}

function insert_(name, obj) {
  const sh = sheet_(name);
  const row = SCHEMA[name].map(function (c) { return safe_(obj[c[0]] == null ? '' : obj[c[0]]); });
  const range = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
  return obj;
}

function update_(name, id, patch) {
  const atual = findById_(name, id);
  if (!atual) throw new Error('Registro não encontrado.');
  const merged = {};
  SCHEMA[name].forEach(function (c) { merged[c[0]] = (c[0] in patch) ? patch[c[0]] : atual[c[0]]; });
  const row = SCHEMA[name].map(function (c) { return safe_(merged[c[0]] == null ? '' : merged[c[0]]); });
  sheet_(name).getRange(atual._row, 1, 1, row.length).setValues([row]);
  if (name === 'USUARIOS') { delete merged.senha; delete merged.salt; }
  return merged;
}

function remove_(name, id) {
  const r = findById_(name, id);
  if (r) sheet_(name).deleteRow(r._row);
}

function removeWhere_(name, fn) {
  const sh = sheet_(name);
  readAll_(name).filter(fn).map(function (r) { return r._row; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (row) { sh.deleteRow(row); });
}

/** Incrementa um contador da aba CONFIG (usar dentro de lock). */
function nextCounter_(chave) {
  const sh = sheet_('CONFIG');
  const c = readAll_('CONFIG').filter(function (x) { return x.chave === chave; })[0];
  if (!c) { insert_('CONFIG', { chave: chave, valor: '2', descricao: 'Contador automático' }); return '1'; }
  const atual = parseInt(c.valor, 10) || 1;
  sh.getRange(c._row, 2).setNumberFormat('@').setValue(String(atual + 1));
  return String(atual);
}

/* ----------------------------------------------------------------------------
 * 14. UTILITÁRIOS
 * --------------------------------------------------------------------------*/

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function lock_(ms) { const l = LockService.getScriptLock(); if (!l.tryLock(ms || 20000)) throw new Error('Sistema ocupado. Tente novamente em alguns segundos.'); return l; }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function newId_(prefix) { return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function digits_(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
function num_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function normalize_(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

/** Limpa texto recebido do frontend: remove controles e limita tamanho. */
function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max || 300);
}

/** Impede que textos iniciados por = ou + virem fórmulas na planilha. */
function safe_(v) {
  const s = String(v);
  return /^[=+]/.test(s) ? "'" + s : s;
}

function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  if (v === null || v === undefined) return '';
  const s = String(v);
  return s.charAt(0) === "'" ? s.slice(1) : s;
}

function validaDocumento_(v) {
  const d = digits_(v);
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    for (let t = 9; t < 11; t++) {
      let s = 0;
      for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = function (len) {
      const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce(function (acc, p, i) { return acc + Number(d[i]) * p; }, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  return false;
}
