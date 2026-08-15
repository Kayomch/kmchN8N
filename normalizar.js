// ============================================================
// Interpreta a resposta do Claude, aplica regras determinísticas,
// calcula hash de deduplicação e monta as linhas da aba Lancamentos.
// Node: Code (modo: Run Once for All Items)
// Espelha config/regras-merchant.json — mantenha os dois em sincronia.
// ============================================================

// ---------- Regras determinísticas (vencem a sugestão do Claude) ----------
const REGRAS = [
  { padrao: 'cond. st germain', categoria: 'Moradia', subcategoria: 'Condomínio', rubrica: 'AluguelCondomín.', tipo: 'despesa' },
  { padrao: 'saintgerman', categoria: 'Moradia', subcategoria: 'Condomínio', rubrica: 'AluguelCondomín.', tipo: 'despesa' },
  { padrao: 'condominio', categoria: 'Moradia', subcategoria: 'Condomínio', rubrica: 'AluguelCondomín.', tipo: 'despesa' },
  { padrao: 'terradamata', categoria: 'Moradia', subcategoria: 'Aluguel', rubrica: 'AluguelCondomín.', tipo: 'despesa' },
  { padrao: 'terra da mata', categoria: 'Moradia', subcategoria: 'Aluguel', rubrica: 'AluguelCondomín.', tipo: 'despesa' },
  { padrao: 'enel', categoria: 'Moradia', subcategoria: 'Energia', rubrica: 'Luz Enel', tipo: 'despesa' },
  { padrao: 'eletropaulo', categoria: 'Moradia', subcategoria: 'Energia', rubrica: 'Luz Enel', tipo: 'despesa' },
  { padrao: 'comgas', categoria: 'Moradia', subcategoria: 'Gás', rubrica: 'Comgás', tipo: 'despesa' },
  { padrao: 'escola malu', categoria: 'Filhos', subcategoria: 'Mensalidade escolar', rubrica: 'Escola Malu', tipo: 'despesa' },
  { padrao: 'selma', categoria: 'Serviços Domésticos', subcategoria: 'Mensalista', rubrica: 'Selma/Gloria', tipo: 'despesa' },
  { padrao: 'gloria', categoria: 'Serviços Domésticos', subcategoria: 'Mensalista', rubrica: 'Selma/Gloria', tipo: 'despesa' },
  { padrao: 'natiane', categoria: 'Serviços Domésticos', subcategoria: 'Diarista', rubrica: 'Natiane', tipo: 'despesa' },
  { padrao: 'sem parar', categoria: 'Transporte', subcategoria: 'Pedágio/Sem Parar', rubrica: 'Sem Parar', tipo: 'despesa' },
  { padrao: 'semparar', categoria: 'Transporte', subcategoria: 'Pedágio/Sem Parar', rubrica: 'Sem Parar', tipo: 'despesa' },
  { padrao: 'parcela kicks', categoria: 'Transporte', subcategoria: 'Financiamento veículo', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'kicks', categoria: 'Transporte', subcategoria: 'Financiamento veículo', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'ipva', categoria: 'Transporte', subcategoria: 'IPVA/Licenciamento', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'estacionamento', categoria: 'Transporte', subcategoria: 'Estacionamento', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'posto', categoria: 'Transporte', subcategoria: 'Combustível', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'shell', categoria: 'Transporte', subcategoria: 'Combustível', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'ipiranga', categoria: 'Transporte', subcategoria: 'Combustível', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'uber', categoria: 'Transporte', subcategoria: 'App de transporte', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'ifood', categoria: 'Alimentação', subcategoria: 'Delivery', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'rappi', categoria: 'Alimentação', subcategoria: 'Delivery', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'pao de acucar', categoria: 'Alimentação', subcategoria: 'Supermercado', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'despesa' },
  { padrao: 'paoacucar', categoria: 'Alimentação', subcategoria: 'Supermercado', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'despesa' },
  { padrao: 'carrefour', categoria: 'Alimentação', subcategoria: 'Supermercado', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'despesa' },
  { padrao: 'assai', categoria: 'Alimentação', subcategoria: 'Supermercado', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'despesa' },
  { padrao: 'st marche', categoria: 'Alimentação', subcategoria: 'Supermercado', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'despesa' },
  { padrao: 'hortifruti', categoria: 'Alimentação', subcategoria: 'Feira/Hortifruti', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'despesa' },
  { padrao: 'zion', categoria: 'Doações', subcategoria: 'Igreja/Oferta', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'oferta ibp', categoria: 'Doações', subcategoria: 'Igreja/Oferta', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'kart com cristo', categoria: 'Doações', subcategoria: 'Ação social', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'doacao', categoria: 'Doações', subcategoria: 'Doação', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'tarifa', categoria: 'Impostos e Tarifas', subcategoria: 'Tarifa bancária', rubrica: 'Tarifas.Tx;Impostos', tipo: 'despesa' },
  { padrao: 'encargos chq', categoria: 'Dívidas', subcategoria: 'Cheque especial', rubrica: 'Tarifas.Tx;Impostos', tipo: 'despesa' },
  { padrao: 'encargos juros', categoria: 'Impostos e Tarifas', subcategoria: 'Juros/Encargos', rubrica: 'Tarifas.Tx;Impostos', tipo: 'despesa' },
  { padrao: 'iof', categoria: 'Impostos e Tarifas', subcategoria: 'IOF', rubrica: 'Tarifas.Tx;Impostos', tipo: 'despesa' },
  { padrao: 'simples nacional', categoria: 'Impostos e Tarifas', subcategoria: 'Simples Nacional', rubrica: 'Impostos Incyclus', tipo: 'despesa' },
  { padrao: 'darf', categoria: 'Impostos e Tarifas', subcategoria: 'DARF/DAS', rubrica: 'Impostos Incyclus', tipo: 'despesa' },
  { padrao: 'imposto das', categoria: 'Impostos e Tarifas', subcategoria: 'DARF/DAS', rubrica: 'Impostos Incyclus', tipo: 'despesa' },
  { padrao: 'emprest', categoria: 'Dívidas', subcategoria: 'Empréstimo', rubrica: 'Empréstimo Itaú', tipo: 'despesa' },
  { padrao: 'salario bolt', categoria: 'Receitas', subcategoria: 'Salário', rubrica: 'Bolt', tipo: 'receita' },
  { padrao: 'bolt', categoria: 'Receitas', subcategoria: 'Salário', rubrica: 'Bolt', tipo: 'receita' },
  { padrao: 'incyclus', categoria: 'Receitas', subcategoria: 'Pró-labore', rubrica: 'Incyclus', tipo: 'receita' },
  { padrao: 'araplast', categoria: 'Receitas', subcategoria: 'Pró-labore', rubrica: 'Incyclus', tipo: 'receita' },
  { padrao: 'migratio', categoria: 'Receitas', subcategoria: 'Comissão', rubrica: 'Migratio', tipo: 'receita' },
  { padrao: 'pro labore', categoria: 'Receitas', subcategoria: 'Pró-labore', rubrica: 'Incyclus', tipo: 'receita' },
  { padrao: 'rendimento', categoria: 'Receitas', subcategoria: 'Rendimentos', rubrica: 'Extras', tipo: 'receita' },
  { padrao: 'reembolso', categoria: 'Receitas', subcategoria: 'Reembolso', rubrica: 'Extras', tipo: 'receita' },
  { padrao: 'aluguel karen', categoria: 'Família/Karen', subcategoria: 'Aluguel Karen', rubrica: 'Karen', tipo: 'despesa' },
  { padrao: 'espolio', categoria: 'Família/Karen', subcategoria: 'Espólio', rubrica: 'Karen', tipo: 'receita' },
  { padrao: 'repasse karen', categoria: 'Família/Karen', subcategoria: 'Repasse', rubrica: 'Karen', tipo: 'despesa' },
  { padrao: 'aporte karen', categoria: 'Família/Karen', subcategoria: 'Aporte recebido', rubrica: 'Karen', tipo: 'receita' },
  { padrao: 'mercado bitcoin', categoria: 'Investimentos', subcategoria: 'Cripto', rubrica: 'Extras', tipo: 'transferencia' },
  { padrao: 'terap', categoria: 'Saúde', subcategoria: 'Terapia', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'drogaria', categoria: 'Saúde', subcategoria: 'Farmácia', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'drogasil', categoria: 'Saúde', subcategoria: 'Farmácia', rubrica: 'Extras', tipo: 'despesa' },
  { padrao: 'claro', categoria: 'Pessoal', subcategoria: 'Celular', rubrica: 'Nubank 04 (assinaturas)', tipo: 'despesa' },
  { padrao: 'netflix', categoria: 'Lazer', subcategoria: 'Streaming', rubrica: 'Nubank 04 (assinaturas)', tipo: 'despesa' },
  { padrao: 'spotify', categoria: 'Lazer', subcategoria: 'Streaming', rubrica: 'Nubank 04 (assinaturas)', tipo: 'despesa' },
  { padrao: 'cartao elo', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Bradesco ELO 20 (Mensal', tipo: 'transferencia' },
  { padrao: 'cartao bradesco', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Bradesco 05 (mensal)', tipo: 'transferencia' },
  { padrao: 'cartao nubank', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Nubank 04 (assinaturas)', tipo: 'transferencia' },
  { padrao: 'cartao azul', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Itau Azul (zerar)', tipo: 'transferencia' },
  { padrao: 'cartao itau azul', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Itau Azul (zerar)', tipo: 'transferencia' },
  { padrao: 'cartao pao', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Cartão P.A (parcelados)', tipo: 'transferencia' },
  { padrao: 'cartao mercado p', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'transferencia' },
  { padrao: 'cartao mp', categoria: 'Transferências', subcategoria: 'Pagamento de fatura', rubrica: 'Merc.Pg.Aliment.Tr', tipo: 'transferencia' },
  { padrao: 'aporte itau', categoria: 'Transferências', subcategoria: 'Entre contas próprias', rubrica: 'Extras', tipo: 'transferencia' },
  { padrao: 'aporte bradesco', categoria: 'Transferências', subcategoria: 'Entre contas próprias', rubrica: 'Extras', tipo: 'transferencia' }
];

// ---------- Utilitários ----------
function semAcento(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

// FNV-1a 32 bits, aplicado duas vezes com sementes diferentes -> 16 chars hex.
// Sem dependência externa (o Code node do n8n bloqueia require por padrão).
function hash16(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function aplicarRegra(lanc) {
  const alvo = semAcento(lanc.estabelecimento + ' ' + lanc.descricao);
  for (const r of REGRAS) {
    if (alvo.includes(semAcento(r.padrao))) {
      return r;
    }
  }
  return null;
}

// ---------- Processamento ----------
const saida = [];
const entradas = $input.all();
const reqs = $('Montar Requisição').all();
const agora = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });

for (let i = 0; i < entradas.length; i++) {
  const resp = entradas[i].json;
  const meta = ((reqs[i] || reqs[0] || {}).json || {}).meta || {};

  // A API pode recusar a requisição por política de segurança.
  // Isso volta como HTTP 200 — precisa ser checado antes de ler o conteúdo.
  if (resp.stop_reason === 'refusal') {
    throw new Error('A API recusou processar este conteúdo. Categoria: ' +
      ((resp.stop_details || {}).category || 'não informada'));
  }

  // Com adaptive thinking ligado, o primeiro bloco pode ser 'thinking'.
  const blocoTexto = (resp.content || []).find(b => b.type === 'text');
  if (!blocoTexto) {
    throw new Error('Resposta da API sem bloco de texto. stop_reason=' + resp.stop_reason);
  }

  let dados;
  try {
    dados = JSON.parse(blocoTexto.text);
  } catch (e) {
    throw new Error('Resposta não é JSON válido: ' + String(blocoTexto.text).slice(0, 300));
  }

  const lista = Array.isArray(dados.lancamentos) ? dados.lancamentos : [];

  for (const l of lista) {
    // Guarda: valor zerado ou ausente não vira lançamento.
    const valorNum = Number(l.valor);
    if (!isFinite(valorNum) || valorNum === 0) continue;

    const regra = aplicarRegra(l);

    const categoria    = regra ? regra.categoria    : (l.categoria || 'Outros');
    const subcategoria = regra ? regra.subcategoria : (l.subcategoria || 'Não classificado');
    const tipo         = regra ? regra.tipo         : (l.tipo || 'despesa');

    // Compra em cartão de crédito: a rubrica segue o cartão, não a natureza.
    // É assim que o orçamento da Kay_2026 está montado.
    const CARTAO_RUBRICA = {
      'Bradesco ELO 20': 'Bradesco ELO 20 (Mensal',
      'Bradesco 05': 'Bradesco 05 (mensal)',
      'Nubank 04': 'Nubank 04 (assinaturas)',
      'Itaú Azul': 'Itau Azul (zerar)',
      'Cartão Pão de Açúcar': 'Cartão P.A (parcelados)',
      'Cartão Mercado Pago': 'Merc.Pg.Aliment.Tr'
    };

    let rubrica;
    if (l.metodo === 'credito' && CARTAO_RUBRICA[l.conta_cartao]) {
      rubrica = CARTAO_RUBRICA[l.conta_cartao];
    } else if (regra) {
      rubrica = regra.rubrica;
    } else {
      rubrica = l.rubrica || 'Extras';
    }

    const conf = regra ? 1 : Math.max(0, Math.min(1, Number(l.confianca) || 0));
    const valor = Math.abs(Math.round(valorNum * 100) / 100);
    const data = /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : agora.slice(0, 10);

    const chave = [
      data,
      semAcento(l.estabelecimento).replace(/[^a-z0-9]/g, ''),
      valor.toFixed(2),
      l.metodo || '',
      l.parcela_atual || 0
    ].join('|');

    const hash = hash16(chave);
    const naoClassificado = categoria === 'Outros';

    saida.push({
      json: {
        id: 'LCT-' + Date.now().toString(36).toUpperCase() + '-' + hash.slice(0, 6).toUpperCase(),
        data: data,
        data_registro: agora,
        descricao: String(l.descricao || '').slice(0, 500),
        estabelecimento: String(l.estabelecimento || '').slice(0, 200),
        valor: valor,
        tipo: tipo,
        categoria: categoria,
        subcategoria: subcategoria,
        rubrica: rubrica,
        metodo: l.metodo || 'desconhecido',
        conta_cartao: l.conta_cartao || 'Desconhecido',
        parcela_atual: Number(l.parcela_atual) || 0,
        parcelas_total: Number(l.parcelas_total) || 0,
        pessoa: meta.pessoa || 'Kayo',
        origem: meta.origem || 'desconhecida',
        confianca: conf,
        status: (conf >= 0.7 && !naoClassificado) ? 'confirmado' : 'pendente',
        hash_dedup: hash,
        observacao: String(l.observacao || ''),
        anexo: meta.anexo || '',
        _chat_id: meta.chat_id || '',
        _resumo: dados.resumo || '',
        _regra_aplicada: regra ? regra.padrao : ''
      }
    });
  }
}

// Nenhum lançamento encontrado: devolve um item sinalizando isso,
// para o chamador conseguir responder algo em vez de silêncio.
if (saida.length === 0) {
  const meta = ((reqs[0] || {}).json || {}).meta || {};
  return [{
    json: {
      _vazio: true,
      _chat_id: meta.chat_id || '',
      _resumo: 'Não identifiquei nenhum lançamento financeiro neste conteúdo.'
    }
  }];
}

return saida;
