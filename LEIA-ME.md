# Vegas Vigilância — Prospecção de Clientes

Sistema comercial com banco de dados no Google Sheets, instalável como aplicativo no celular de cada vendedor.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da interface |
| `style.css` | Visual (tema claro e escuro, responsivo) |
| `script.js` | Lógica do sistema (telas, formulários, CSV, WhatsApp, localização) |
| `pdf.js` | Orçamento e relatórios em PDF no padrão do modelo oficial |
| `contratos.js` | Contratos em PDF a partir dos modelos Word (`assets/contratos/`) |
| `Code.gs` | Backend no Google Apps Script (banco de dados, login, regras) |
| `manifest.json` + `sw.js` | Instalação como app no celular (PWA) |
| `assets/pdf-fundo.jpg` | Papel timbrado extraído do seu PDF de referência |
| `assets/fonts/` | Fonte Carlito (mesma medida da Calibri do modelo) |
| `icons/` | Ícone do app (gerado a partir da sua arte "Prospecção") |

## Acessos iniciais

| Vendedor | Usuário | Senha |
|---|---|---|
| André | `andre` | `andre123` |
| Marcio | `marcio` | `marcio123` |
| Ronaldo | `ronaldo` | `ronaldo123` |
| Osias | `osias` | `osias123` |
| Gil | `gil` | `gil123` |
| Juliano | `juliano` | `juliano123` |
| Administrador | `admin` | `vegas@admin2026` |

As senhas ficam gravadas na planilha apenas como hash (embaralhadas). Peça para cada vendedor trocar a senha em **Configurações → Alterar senha** no primeiro acesso, e troque a do administrador.

---

## 1. Criar o Google Sheets

1. Acesse sheets.google.com e crie uma planilha em branco.
2. Dê o nome **Vegas — Prospecção de Clientes**.
3. Não precisa criar abas: o sistema cria tudo sozinho.

## 2. Instalar o Code.gs

1. Na planilha, abra **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo do `Code.gs`.
3. Clique em **Salvar** (ícone de disquete).

## 3. Configurar o ID da planilha (opcional)

Como o script foi criado dentro da planilha, ele já sabe qual usar. Só é necessário informar o ID se o script estiver separado:

- O ID é o trecho entre `/d/` e `/edit` no endereço da planilha.
- No topo do `Code.gs`, preencha: `const SPREADSHEET_ID = 'COLE_O_ID_AQUI';`

## 4. Executar o setupDatabase()

1. No editor do Apps Script, escolha a função **setupDatabase** na lista ao lado do botão Executar.
2. Clique em **Executar**.
3. Autorize o acesso (Google → Avançado → Acessar projeto → Permitir).
4. Volte à planilha: as abas USUARIOS, CLIENTES, PRODUTOS, PROSPECCOES, ATIVIDADES, PROPOSTAS, HISTORICO e CONFIG estarão criadas, com os 6 vendedores e o administrador.

Pode rodar de novo sem medo: ela só cria o que falta e nunca apaga dados.

## 5. Publicar o Apps Script como aplicativo web

1. Clique em **Implantar → Nova implantação**.
2. Em "Tipo", escolha **App da Web**.
3. **Executar como:** Eu. **Quem pode acessar:** Qualquer pessoa.
4. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

> "Qualquer pessoa" é necessário para o celular conseguir falar com o servidor. A proteção é feita pelo login do próprio sistema: sem usuário e senha válidos nenhuma informação é devolvida.

Sempre que alterar o `Code.gs`, vá em **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**. A URL continua a mesma.

## 6. Publicar a interface e acessar o sistema

A interface precisa ficar num endereço **HTTPS** para funcionar a instalação no celular e a localização por GPS. A forma gratuita mais simples é o GitHub Pages:

1. Crie uma conta em github.com e um repositório (ex.: `vegas-prospeccao`).
2. Envie todos os arquivos desta pasta (mantendo as pastas `assets` e `icons`).
3. Em **Settings → Pages**, escolha a branch `main` e salve.
4. Em alguns minutos o sistema estará em `https://SEU-USUARIO.github.io/vegas-prospeccao/`.

Alternativa: arraste a pasta em app.netlify.com/drop.

**Informe a URL do servidor** de uma destas formas:
- cole a URL `/exec` na constante `API_URL_PADRAO` no topo do `script.js` (vale para todos os aparelhos), **ou**
- no primeiro acesso, toque em **Configurar servidor** na tela de login e cole a URL.

## 7. Instalar o app no celular de cada vendedor

- **Android (Chrome):** abra o endereço, faça login e toque em **Instalar aplicativo** no menu lateral (ou menu ⋮ → Instalar app).
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar → Adicionar à Tela de Início**.

O app abre em tela cheia com o ícone "Vegas Prospecção", e o vendedor continua conectado por 30 dias sem precisar digitar a senha.

## 8. Tema claro / escuro

Botão de sol/lua no topo alterna na hora. Em **Configurações → Aparência** é possível escolher Claro, Escuro ou Automático (segue o celular). A escolha fica salva no aparelho.

## 9. Localização automática no cadastro

Ao abrir **Novo cliente**, o sistema pede permissão de localização e preenche sozinho endereço, número, bairro, cidade, estado e CEP (via OpenStreetMap + ViaCEP). As coordenadas GPS ficam salvas no cliente e a ficha ganha o botão **Mapa** (abre no Google Maps).

- Só campos vazios são preenchidos; nada que o vendedor digitou é apagado.
- O botão **Usar localização atual** refaz a busca a qualquer momento (útil ao editar).
- Se aparecer "Permissão negada", libere a localização para o site nas configurações do navegador.
- Confira sempre o número: o GPS pode indicar o imóvel vizinho.

## 10. Cadastrar e importar produtos

- **Um a um:** menu **Produtos → Novo produto**. Marque o tipo como **Serviço** para itens como instalação: eles saem na seção "SERVIÇO" do orçamento.
- **Por CSV:** menu **Importar CSV**. Clique em **Baixar modelo de CSV** para ver o formato. O sistema aceita vírgula ou ponto e vírgula, arquivos do Excel (UTF-8 ou ANSI), identifica as colunas, mostra a prévia e os erros antes de salvar. Produtos com o mesmo código podem ser atualizados.
- **Exportar:** botão **Exportar produtos CSV** (abre direto no Excel).

## 11. Gerar orçamentos em PDF (Venda ou Locação)

**Fluxo:** cadastre o cliente → abra a ficha (ou use o ícone de orçamento na lista de clientes) → **Fazer orçamento** → escolha:

- **Venda:** o cliente compra os equipamentos. Todos os valores de produtos e serviços aparecem no PDF. A cobrança mensal é opcional (ex.: monitoramento após a venda).
- **Locação (comodato):** os equipamentos saem no PDF como **"Locado"**, sem valor. É obrigatório informar o **valor do aluguel mensal** que o cliente vai pagar, que sai no bloco "Cobrança mensal". Se algum item for cobrado à parte (cabos, instalação), desmarque "Comodato" nesse item; ele aparece com valor e entra em "Valores cobrados à parte".

Dá para trocar entre Venda e Locação dentro do editor a qualquer momento. O botão **Mensalidade**, em Condições de pagamento, preenche a linha "ALUGUEL MENSAL (COMODATO)".

Depois:
1. Adicione os produtos (os produtos de interesse do cliente já entram sozinhos), o desconto (R$ ou %) e as condições de pagamento.
2. O campo **Observações para o cliente** sai no PDF, no campo OBS. As **Observações internas** nunca aparecem.
3. **Salvar e gerar PDF** cria o número do orçamento (sequência a partir de 12987) e abre as opções: Baixar, Abrir, Compartilhar (no celular envia o arquivo direto pelo WhatsApp) ou mensagem no WhatsApp.

Assinatura e contato do PDF usam o **Meu perfil no orçamento** (Configurações): nome completo, código, CPF e e-mail de cada vendedor. O perfil do André já vem igual ao modelo (11529 — ANDRE LUIZ LEAL DA CRUZ).

**Cadastro de cliente:** o campo principal é **Nome do cliente** (pessoa ou empresa). Razão social e pessoa de contato são opcionais.

## 12.1. Contratos em PDF

**Onde:** depois de gerar o PDF do orçamento, a janela mostra, logo abaixo dos botões, a seção **Contrato → Gerar contrato**. Também há o ícone de contrato em cada proposta (lista de propostas e aba Propostas da ficha do cliente).

**Como funciona:**
1. Escolha o contrato: Câmeras (CFTV) em comodato, Alarme monitorado em comodato, Somente monitoramento, Rastreamento veicular, Manutenção de CFTV ou **Aditivo de equipamentos**. Cada um tem versão de pessoa física ou jurídica. O sistema já sugere o tipo pelo CPF/CNPJ do cliente.
2. Informe os dados do contrato: local de assinatura (Volta Redonda ou Niterói), data, prazo em meses e, quando o modelo pedir, dias de retenção das imagens, modalidade com/sem instalação e os veículos do rastreamento.
3. A **conferência** lista tudo o que o contrato exige, com ✓ ou ✗. **O botão "Baixar contrato em PDF" só é liberado quando todos os campos estiverem preenchidos.** O botão "Completar cadastro do cliente" abre o cadastro já destacando em vermelho o que falta.
4. O contrato é gerado no papel timbrado Vegas, com o texto integral do modelo. Os equipamentos da proposta entram automaticamente nas tabelas (lista de comodato e valores de reposição), e o valor mensal sai por extenso. A geração fica registrada no histórico do cliente.

**Novos campos no cadastro do cliente** (seção "Dados para contrato"): inscrição municipal, representante legal, CPF, RG, cargo, nacionalidade, estado civil e profissão do representante. O campo RG / Inscrição estadual serve para os dois tipos de cliente.

**Editar o texto dos contratos:** os modelos são arquivos Word em `assets/contratos/`. Abra no Word, altere o texto à vontade, mantenha os campos (ex.: `CLI.NOME`, `Cli.CGCCPF`, `Cli.ValorME`, `CONTR.Prazo`) e substitua o arquivo com o mesmo nome. A lista completa de campos está no topo do arquivo `contratos.js`.

Recursos extras que podem ser usados no Word:
- `[[PJ|texto]]` aparece só para pessoa jurídica.
- `[[PF|texto]]` aparece só para pessoa física.
- `[[OPC|texto]]` aparece só se os campos dentro dele estiverem preenchidos.
- Se o modelo tiver um campo que o sistema não conhece, a conferência avisa e bloqueia o download.

**Ajustes feitos nos modelos enviados:**
- As lacunas "____" (valor, prazo, inscrição municipal, representante e data/local) viraram campos preenchidos automaticamente.
- No contrato de Manutenção de CFTV, os dados da Distribuidora Ligeirinho foram trocados por campos. O endereço residencial do representante saiu do texto.
- No Alarme PJ, foi corrigido o "CONTRATANTE: CONTRATANTE:" duplicado.
- **Aditivo:** o número do aditivo (1º, 2º...) é informado na hora de gerar. A tabela recebe os equipamentos da proposta, com o nº de itens e o total de comodato calculados automaticamente. O acréscimo mensal vem do valor mensal da proposta, por extenso. Os dados da Rede Premium do exemplo viraram campos. Serve para cliente pessoa física ou jurídica.
- Nome, CPF das testemunhas e linhas de assinatura continuam em branco, para preenchimento à mão.

**Depois de atualizar o sistema, rode `setupDatabase()` de novo** no Apps Script para criar as colunas novas na aba CLIENTES. Nenhum dado é apagado.

## 12. Padrão do PDF de referência

O PDF enviado (Orçamento Nº 12986) já está incorporado:

- O papel timbrado (faixas, logo, marca d'água e rodapé com Volta Redonda / Niterói / 0800) foi extraído do próprio arquivo e está em `assets/pdf-fundo.jpg`.
- Posições, tamanhos de fonte, faixas cinza e a ordem dos blocos foram medidos no modelo e reproduzidos em `pdf.js`.
- Foi acrescentado o bloco **Resumo do orçamento** (subtotal, desconto e valor final) no mesmo estilo visual do bloco "Cobrança mensal".

Para trocar o timbrado no futuro, substitua `assets/pdf-fundo.jpg` por uma imagem A4 retrato (1240 × 1754 px) com o mesmo nome. Textos fixos (dados bancários, aviso de preços, impostos, autorização, condições comerciais e validade) são editáveis pelo administrador em **Configurações → Dados do orçamento**.

## 13. Controle por vendedor e administrador

- Cada vendedor vê apenas a própria carteira e não consegue editar ou excluir clientes de outro vendedor (a regra é verificada no servidor).
- CPF/CNPJ repetido é bloqueado; telefone ou nome/cidade repetidos geram aviso de possível duplicidade.
- Toda alteração importante fica registrada na aba HISTORICO (data, usuário e o que mudou) e aparece na aba **Alterações** da ficha.
- O administrador vê toda a equipe, filtra por vendedor pelo seletor no topo e gerencia usuários em **Administração**.

## Tela de login

A arte oficial "Vegas — Prospecção de Clientes" (`assets/login-fundo.jpg`) aparece no fundo da tela de login: ao lado do formulário no computador e no topo no celular. Para trocar a arte, substitua o arquivo mantendo o mesmo nome.

**Importante:** ao publicar no GitHub Pages ou no Netlify, envie as pastas `assets` e `icons` junto com os arquivos. Sem elas, o login fica sem imagem e o PDF fica sem timbrado.

## Atualizações futuras

Ao alterar arquivos da interface, mude a versão na primeira linha útil do `sw.js` (`vegas-prospeccao-v1.0.1`, por exemplo) para que os celulares baixem a nova versão.

---

**Vegas Vigilância e Segurança**
