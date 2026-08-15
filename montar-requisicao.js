// ============================================================
// Monta a requisição para a API da Anthropic.
// Node: Code (modo: Run Once for Each Item)
// Espelha config/plano-de-contas.json — mantenha os dois em sincronia.
// ============================================================

const p = $json;
const HOJE = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

// ---------- Plano de contas ----------
const CATEGORIAS = {
  'Moradia': ['Aluguel', 'Condomínio', 'IPTU', 'Energia', 'Gás', 'Água', 'Internet/TV', 'Manutenção', 'Mobiliário'],
  'Alimentação': ['Supermercado', 'Feira/Hortifruti', 'Restaurante', 'Delivery', 'Padaria', 'Café/Lanche'],
  'Transporte': ['Combustível', 'Pedágio/Sem Parar', 'App de transporte', 'Estacionamento', 'Manutenção veicular', 'IPVA/Licenciamento', 'Seguro auto', 'Financiamento veículo'],
  'Saúde': ['Plano de saúde', 'Farmácia', 'Consulta/Exame', 'Terapia', 'Academia/Esporte'],
  'Educação': ['Escola', 'Curso', 'Material escolar', 'Livros'],
  'Filhos': ['Mensalidade escolar', 'Vestuário infantil', 'Atividades', 'Brinquedos', 'Saúde infantil'],
  'Serviços Domésticos': ['Diarista', 'Mensalista', 'Babá', '13º/Encargos'],
  'Pessoal': ['Vestuário', 'Beleza/Barbearia', 'Presentes', 'Assinaturas', 'Hobbies', 'Celular'],
  'Lazer': ['Streaming', 'Viagem', 'Passeios', 'Bar/Restaurante social', 'Eventos'],
  'Doações': ['Igreja/Oferta', 'Doação', 'Ação social'],
  'Impostos e Tarifas': ['Tarifa bancária', 'Juros/Encargos', 'IOF', 'Simples Nacional', 'DARF/DAS', 'Multas', 'Outros impostos'],
  'Dívidas': ['Empréstimo', 'Parcelamento', 'Cheque especial'],
  'Investimentos': ['Aporte', 'Cripto', 'Previdência', 'Reserva'],
  'Família/Karen': ['Aluguel Karen', 'Espólio', 'Repasse', 'Aporte recebido'],
  'Receitas': ['Salário', 'Pró-labore', 'Comissão', 'Aluguel recebido', 'Rendimentos', 'Reembolso', '13º/Férias', 'Outras receitas'],
  'Transferências': ['Entre contas próprias', 'Pagamento de fatura', 'Aporte para terceiros'],
  'Outros': ['Não classificado']
};

const RUBRICAS = [
  'AluguelCondomín.', 'Escola Malu', 'Merc.Pg.Aliment.Tr', 'Bradesco ELO 20 (Mensal',
  'Bradesco 05 (mensal)', 'Nubank 04 (assinaturas)', 'Itau Azul (zerar)',
  'Cartão P.A (parcelados)', 'Sem Parar', 'Selma/Gloria', 'Natiane', 'Luz Enel',
  'Comgás', 'Tarifas.Tx;Impostos', 'Empréstimo Itaú', 'Impostos Incyclus', 'Extras',
  'Bolt', 'Incyclus', 'Migratio', 'Karen', 'Aporte / 13º / Férias'
];

const CONTAS_CARTOES = [
  'Bradesco', 'Banco Inter - Incyclus', 'Mercado Pago - DevHouse', 'Itaú', 'Rico',
  'Bradesco ELO 20', 'Bradesco 05', 'Nubank 04', 'Itaú Azul',
  'Cartão Pão de Açúcar', 'Cartão Mercado Pago', 'Dinheiro', 'Desconhecido'
];

const listaCategorias = Object.keys(CATEGORIAS);
const textoCategorias = Object.entries(CATEGORIAS)
  .map(([c, subs]) => `- ${c}: ${subs.join(' | ')}`)
  .join('\n');

// ---------- Schema de saída estruturada ----------
const schema = {
  type: 'object',
  properties: {
    lancamentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'AAAA-MM-DD' },
          descricao: { type: 'string', description: 'Texto original do lançamento' },
          estabelecimento: { type: 'string', description: 'Nome limpo do comerciante' },
          valor: { type: 'number', description: 'Sempre positivo, em reais' },
          tipo: { type: 'string', enum: ['despesa', 'receita', 'transferencia'] },
          metodo: { type: 'string', enum: ['credito', 'debito', 'pix', 'dinheiro', 'boleto', 'transferencia', 'desconhecido'] },
          conta_cartao: { type: 'string', enum: CONTAS_CARTOES },
          parcela_atual: { type: 'integer' },
          parcelas_total: { type: 'integer' },
          categoria: { type: 'string', enum: listaCategorias },
          subcategoria: { type: 'string' },
          rubrica: { type: 'string', enum: RUBRICAS },
          confianca: { type: 'number', description: '0 a 1' },
          observacao: { type: 'string' }
        },
        required: ['data', 'descricao', 'estabelecimento', 'valor', 'tipo', 'metodo',
                   'conta_cartao', 'parcela_atual', 'parcelas_total', 'categoria',
                   'subcategoria', 'rubrica', 'confianca', 'observacao'],
        additionalProperties: false
      }
    },
    resumo: { type: 'string', description: 'Uma frase sobre o que foi lido' }
  },
  required: ['lancamentos', 'resumo'],
  additionalProperties: false
};

// ---------- System prompt ----------
const system = `Você é o assistente de controle financeiro da família Chegancas. Lê comprovantes, notificações de cartão, faturas, prints e descrições em texto livre, e devolve lançamentos estruturados.

REGRAS

1. ESCOPO
Extraia TODOS os lançamentos presentes no conteúdo.
- Cupom fiscal ou notificação de compra = 1 lançamento.
- Fatura de cartão = 1 lançamento por linha de compra. NÃO inclua a linha de "pagamento recebido", nem o total da fatura, nem saldo anterior, nem encargos já detalhados como linha própria.
- Extrato bancário = 1 lançamento por movimento.
Se não houver nenhum lançamento financeiro no conteúdo, devolva a lista vazia.

2. VALORES
Reais (BRL). Ponto como separador decimal, sem símbolo de moeda. SEMPRE positivo — o sinal é dado pelo campo tipo. "R$ 1.234,56" vira 1234.56.

3. DATAS
Formato AAAA-MM-DD. Sem ano no documento, use o ano corrente de ${HOJE}. Sem data alguma, use ${HOJE}.

4. TIPO
- "despesa": saída por consumo.
- "receita": entrada de dinheiro.
- "transferencia": movimento entre contas próprias, pagamento de fatura de cartão, aporte entre contas, resgate ou aplicação.
NUNCA classifique pagamento de fatura de cartão como despesa. As compras do cartão já entram individualmente; contar as duas coisas dobraria a despesa. Mesma regra para "Aporte Itau", "Aporte Bradesco", "Aporte ML".

5. PARCELAMENTO
Quando a descrição indicar "3/10", "PARC 03/10", "3 de 10" ou similar, preencha parcela_atual e parcelas_total, e registre em valor o valor DA PARCELA — não o total da compra. À vista: ambos 0.

6. ESTABELECIMENTO
Nome limpo, sem código de maquininha, sem cidade, sem asterisco.
"PAG*IFOOD SAO PAULO" -> "iFood". "MP *PAODEACUCAR" -> "Pão de Açúcar".

7. CATEGORIA (natureza do gasto)
Escolha estritamente da lista. Nada serve? "Outros" / "Não classificado".

8. RUBRICA (linha do orçamento da família)
A rubrica segue o INSTRUMENTO DE PAGAMENTO quando a compra é de cartão de crédito:
- compra no Bradesco ELO 20 -> "Bradesco ELO 20 (Mensal"
- compra no Bradesco 05 -> "Bradesco 05 (mensal)"
- compra no Nubank 04 -> "Nubank 04 (assinaturas)"
- compra no Itaú Azul -> "Itau Azul (zerar)"
- compra no Cartão Pão de Açúcar -> "Cartão P.A (parcelados)"
- compra no Cartão Mercado Pago -> "Merc.Pg.Aliment.Tr"
Para débito, pix, boleto ou dinheiro, use a rubrica de natureza correspondente (Luz Enel, Comgás, Natiane, Selma/Gloria, Sem Parar, AluguelCondomín., Escola Malu, Empréstimo Itaú, Impostos Incyclus, Tarifas.Tx;Impostos). Sem correspondência: "Extras".

9. CONFIANÇA
0 a 1. Use abaixo de 0.7 quando valor, data ou estabelecimento tiverem sido inferidos, estiverem ilegíveis ou ambíguos. Seja honesto — um lançamento marcado como incerto é revisado; um lançamento errado com confiança alta entra silenciosamente na contabilidade.

10. NÃO INVENTE
Campo desconhecido: string vazia "" ou número 0. Não preencha por plausibilidade.

CATEGORIAS PERMITIDAS
${textoCategorias}

RUBRICAS PERMITIDAS
${RUBRICAS.map(r => '- ' + r).join('\n')}`;

// ---------- Conteúdo do usuário ----------
const content = [];
const mime = (p.mime || '').toLowerCase();

if (p.base64 && mime.includes('pdf')) {
  content.push({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: p.base64 }
  });
} else if (p.base64) {
  const mt = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime) ? mime : 'image/jpeg';
  content.push({
    type: 'image',
    source: { type: 'base64', media_type: mt, data: p.base64 }
  });
}

const partes = [];
partes.push(`Origem: ${p.origem || 'desconhecida'}`);
partes.push(`Pessoa responsável: ${p.pessoa || 'Kayo'}`);
partes.push(`Data de hoje: ${HOJE}`);
if (p.nome_arquivo) partes.push(`Arquivo: ${p.nome_arquivo}`);
if (p.contexto) partes.push(`Contexto: ${p.contexto}`);
if (p.texto) partes.push(`\nConteúdo informado:\n${p.texto}`);
if (p.base64) partes.push('\nExtraia os lançamentos do arquivo anexo.');

content.push({ type: 'text', text: partes.join('\n') });

// ---------- Corpo da requisição ----------
const anthropic_body = {
  model: p.MODEL || 'claude-opus-5',
  max_tokens: 16000,
  system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
  output_config: {
    effort: p.EFFORT || 'medium',
    format: { type: 'json_schema', schema: schema }
  },
  messages: [{ role: 'user', content: content }]
};

return {
  json: {
    anthropic_body,
    meta: {
      origem: p.origem || 'desconhecida',
      pessoa: p.pessoa || 'Kayo',
      texto: p.texto || '',
      anexo: p.anexo || '',
      chat_id: p.chat_id || '',
      SHEETS_DOC_ID: p.SHEETS_DOC_ID,
      ABA_LANCAMENTOS: p.ABA_LANCAMENTOS
    }
  }
};
