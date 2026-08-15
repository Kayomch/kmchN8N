// ============================================================
// Formata a confirmação enviada de volta no Telegram.
// Node: Code (modo: Run Once for All Items)
// ============================================================

const itens = $input.all().map(i => i.json);

// Achata: dependendo de como o HTTP Request devolveu, pode vir aninhado.
const lancs = [];
for (const it of itens) {
  if (Array.isArray(it)) { lancs.push(...it); continue; }
  if (Array.isArray(it.data)) { lancs.push(...it.data); continue; }
  lancs.push(it);
}

const chatId = (lancs.find(l => l._chat_id) || {})._chat_id || '';

// Nada reconhecido no conteúdo enviado.
const vazios = lancs.filter(l => l._vazio);
if (vazios.length && lancs.length === vazios.length) {
  return [{
    json: {
      chat_id: chatId,
      texto: '🤔 Não identifiquei nenhum lançamento nesse conteúdo.\n\n' +
             'Tente uma foto mais nítida, ou escreva direto — por exemplo:\n' +
             '<code>almoço 45 no débito</code>',
      tem_botoes: false,
      hash: ''
    }
  }];
}

function moeda(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dataBR(d) {
  const p = String(d).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

const SINAL = { despesa: '−', receita: '+', transferencia: '⇄' };

const validos = lancs.filter(l => !l._vazio);

// Muitos lançamentos (fatura inteira): manda um resumo, não 40 mensagens.
if (validos.length > 5) {
  const total = validos
    .filter(l => l.tipo === 'despesa')
    .reduce((s, l) => s + Number(l.valor), 0);

  const pendentes = validos.filter(l => l.status === 'pendente').length;

  const porRubrica = {};
  for (const l of validos) {
    if (l.tipo !== 'despesa') continue;
    porRubrica[l.rubrica] = (porRubrica[l.rubrica] || 0) + Number(l.valor);
  }
  const linhas = Object.entries(porRubrica)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([r, v]) => `  • ${r}: R$ ${moeda(v)}`)
    .join('\n');

  return [{
    json: {
      chat_id: chatId,
      texto: `✅ <b>${validos.length} lançamentos</b> registrados\n\n` +
             `<b>Total despesas:</b> R$ ${moeda(total)}\n\n` +
             `<b>Por rubrica:</b>\n${linhas}\n\n` +
             (pendentes ? `⚠️ <b>${pendentes}</b> precisam de revisão — filtre por <code>pendente</code> na aba Lancamentos.` : '🎯 Todos classificados com confiança.'),
      tem_botoes: false,
      hash: ''
    }
  }];
}

// Poucos lançamentos: uma mensagem por lançamento, com botões.
return validos.map(l => {
  const alerta = l.status === 'pendente' ? '\n\n⚠️ <i>Classificação incerta — confira antes de confirmar.</i>' : '';
  const parcela = l.parcelas_total > 1 ? `\n<b>Parcela:</b> ${l.parcela_atual}/${l.parcelas_total}` : '';
  const conta = l.conta_cartao && l.conta_cartao !== 'Desconhecido' ? `\n<b>Conta/Cartão:</b> ${l.conta_cartao}` : '';

  return {
    json: {
      chat_id: l._chat_id || chatId,
      hash: l.hash_dedup,
      tem_botoes: true,
      texto:
        `${SINAL[l.tipo] || '•'} <b>R$ ${moeda(l.valor)}</b> — ${l.estabelecimento || l.descricao}\n\n` +
        `<b>Data:</b> ${dataBR(l.data)}\n` +
        `<b>Categoria:</b> ${l.categoria} › ${l.subcategoria}\n` +
        `<b>Rubrica:</b> ${l.rubrica}\n` +
        `<b>Método:</b> ${l.metodo}` +
        conta + parcela +
        alerta
    }
  };
});
