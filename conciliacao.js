// ============================================================
// Procura lançamentos possivelmente duplicados.
// Node: Code (modo: Run Once for All Items)
//
// O hash_dedup pega duplicata exata. Este nó pega o caso real:
// a notificação do cartão chega na hora da compra, e a mesma compra
// aparece de novo quando você manda o PDF da fatura no fim do mês.
// Mesmo valor, mesmo estabelecimento, datas próximas, origens diferentes.
// ============================================================

const JANELA_DIAS = 4;
const TOLERANCIA_VALOR = 0.02; // centavos de arredondamento entre fontes

function semAcento(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function num(v) {
  if (typeof v === 'number') return v;
  const s = String(v || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function dias(a, b) {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  if (!isFinite(da) || !isFinite(db)) return 999;
  return Math.abs(da - db) / 86400000;
}

const linhas = $input.all()
  .map((i, idx) => ({ ...i.json, _linha: idx + 2 })) // +2: cabeçalho + índice base 1
  .filter(l => l.status !== 'excluido' && l.status !== 'revisar' && l.valor);

const suspeitas = [];
const jaMarcado = new Set();

for (let i = 0; i < linhas.length; i++) {
  for (let j = i + 1; j < linhas.length; j++) {
    const a = linhas[i];
    const b = linhas[j];

    if (jaMarcado.has(a.id) || jaMarcado.has(b.id)) continue;
    if (a.tipo !== b.tipo) continue;

    const va = num(a.valor);
    const vb = num(b.valor);
    if (Math.abs(va - vb) > TOLERANCIA_VALOR) continue;

    const d = dias(a.data, b.data);
    if (d > JANELA_DIAS) continue;

    const ea = semAcento(a.estabelecimento);
    const eb = semAcento(b.estabelecimento);
    if (!ea || !eb) continue;

    // Um nome contido no outro cobre "IFOOD" vs "IFOODSAOPAULO".
    const parecido = ea === eb || ea.includes(eb) || eb.includes(ea);
    if (!parecido) continue;

    // Origens iguais e mesma data provavelmente são duas compras reais
    // (dois cafés no mesmo lugar no mesmo dia acontece).
    // O sinal forte é a mesma compra vindo por caminhos diferentes.
    const origensDiferentes = a.origem !== b.origem;
    const confianca = origensDiferentes ? 'alta' : 'media';

    jaMarcado.add(b.id);
    suspeitas.push({
      confianca,
      manter_id: a.id,
      manter_origem: a.origem,
      manter_data: a.data,
      revisar_id: b.id,
      revisar_origem: b.origem,
      revisar_data: b.data,
      revisar_linha: b._linha,
      estabelecimento: b.estabelecimento,
      valor: vb,
      distancia_dias: d
    });
  }
}

if (!suspeitas.length) {
  return [{ json: { _sem_suspeitas: true, texto: '' } }];
}

function moeda(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const altas = suspeitas.filter(s => s.confianca === 'alta');
const medias = suspeitas.filter(s => s.confianca === 'media');

const L = [];
L.push(`🔍 <b>${suspeitas.length} possível(is) duplicata(s)</b>`);
L.push('');

if (altas.length) {
  L.push('<b>Provável (origens diferentes)</b>');
  for (const s of altas.slice(0, 10)) {
    L.push(`  • R$ ${moeda(s.valor)} — ${s.estabelecimento}`);
    L.push(`    ${s.manter_origem} (${s.manter_data}) × ${s.revisar_origem} (${s.revisar_data})`);
    L.push(`    → linha ${s.revisar_linha} marcada como <code>revisar</code>`);
  }
  L.push('');
}

if (medias.length) {
  L.push('<b>Talvez (mesma origem — pode ser compra real repetida)</b>');
  for (const s of medias.slice(0, 6)) {
    L.push(`  • R$ ${moeda(s.valor)} — ${s.estabelecimento} (${s.revisar_data})`);
  }
  L.push('');
}

L.push('<i>Nada foi apagado. Confira na aba Lancamentos e ajuste o status.</i>');

// Um item por suspeita para o nó seguinte marcar status=revisar,
// mais o texto do alerta no primeiro item.
return suspeitas.map((s, idx) => ({
  json: {
    ...s,
    id: s.revisar_id,
    status: 'revisar',
    observacao: `Possível duplicata de ${s.manter_id} (${s.manter_origem}, ${s.manter_data})`,
    texto: idx === 0 ? L.join('\n') : '',
    _primeiro: idx === 0
  }
}));
