// ============================================================
// Consolida o mês corrente e compara com a projeção.
// Node: Code (modo: Run Once for All Items)
// Entradas: "Ler Lancamentos" e "Ler Projecao"
// ============================================================

const AGORA = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const ANO = Number(AGORA.slice(0, 4));
const MES = Number(AGORA.slice(5, 7));
const DIA = Number(AGORA.slice(8, 10));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
               'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function num(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  // Formato brasileiro: "-2.295,91" -> -2295.91
  const s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function moeda(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Realizado ----------
const lancs = $('Ler Lancamentos').all().map(i => i.json)
  .filter(l => {
    if (!l.data || l.status === 'excluido') return false;
    const d = String(l.data);
    return Number(d.slice(0, 4)) === ANO && Number(d.slice(5, 7)) === MES;
  });

const despesas = lancs.filter(l => l.tipo === 'despesa');
const receitas = lancs.filter(l => l.tipo === 'receita');

const totalDespesa = despesas.reduce((s, l) => s + num(l.valor), 0);
const totalReceita = receitas.reduce((s, l) => s + num(l.valor), 0);

const porRubrica = {};
for (const l of despesas) {
  const r = l.rubrica || 'Extras';
  porRubrica[r] = (porRubrica[r] || 0) + num(l.valor);
}

const porCategoria = {};
for (const l of despesas) {
  const c = l.categoria || 'Outros';
  porCategoria[c] = (porCategoria[c] || 0) + num(l.valor);
}

// ---------- Projeção ----------
// A aba de projeção tem rubricas na coluna A e meses nas colunas seguintes.
const projRows = $('Ler Projecao').all().map(i => i.json);
const colunaMes = MESES[MES - 1];
const projetado = {};
for (const row of projRows) {
  const chaves = Object.keys(row);
  const rubrica = String(row[chaves[0]] || '').trim();
  if (!rubrica) continue;
  // Procura a coluna do mês ignorando caixa e acento residual do cabeçalho.
  const colKey = chaves.find(k => k.toLowerCase().trim() === colunaMes);
  if (colKey) projetado[rubrica] = Math.abs(num(row[colKey]));
}

// ---------- Comparativo ----------
const rubricas = [...new Set([...Object.keys(porRubrica), ...Object.keys(projetado)])];
const comparativo = rubricas
  .map(r => {
    const real = porRubrica[r] || 0;
    const proj = projetado[r] || 0;
    return { rubrica: r, real, proj, delta: real - proj, temDado: real > 0 || proj > 0 };
  })
  .filter(x => x.temDado)
  .sort((a, b) => b.delta - a.delta);

const estouros = comparativo.filter(x => x.proj > 0 && x.delta > 0.01);
const naoClassificados = lancs.filter(l => l.status === 'pendente').length;

// ---------- Ritmo do mês ----------
const diasNoMes = new Date(ANO, MES, 0).getDate();
const ritmo = DIA > 0 ? (totalDespesa / DIA) * diasNoMes : 0;
const projTotal = Object.values(projetado).reduce((s, v) => s + v, 0);

// ---------- Mensagem ----------
const L = [];
L.push(`📊 <b>Prévia de ${MESES[MES - 1]}/${ANO}</b>  <i>(dia ${DIA} de ${diasNoMes})</i>`);
L.push('');
L.push(`<b>Receitas:</b>  R$ ${moeda(totalReceita)}`);
L.push(`<b>Despesas:</b>  R$ ${moeda(totalDespesa)}`);
L.push(`<b>Saldo:</b>     R$ ${moeda(totalReceita - totalDespesa)}`);
L.push('');

if (projTotal > 0) {
  L.push(`<b>Ritmo projetado p/ fechar o mês:</b> R$ ${moeda(ritmo)}`);
  L.push(`<b>Orçado no mês:</b> R$ ${moeda(projTotal)}`);
  const dif = ritmo - projTotal;
  L.push(dif > 0
    ? `⚠️ No ritmo atual, fecha <b>R$ ${moeda(dif)} acima</b> do orçado.`
    : `✅ No ritmo atual, fecha <b>R$ ${moeda(-dif)} abaixo</b> do orçado.`);
  L.push('');
}

if (estouros.length) {
  L.push('<b>🔴 Rubricas acima do orçado</b>');
  for (const e of estouros.slice(0, 8)) {
    L.push(`  ${e.rubrica}`);
    L.push(`  R$ ${moeda(e.real)} / R$ ${moeda(e.proj)}  <b>(+${moeda(e.delta)})</b>`);
  }
  L.push('');
}

const topCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 6);
if (topCat.length) {
  L.push('<b>Onde o dinheiro foi (natureza)</b>');
  for (const [c, v] of topCat) {
    const pct = totalDespesa > 0 ? Math.round((v / totalDespesa) * 100) : 0;
    L.push(`  • ${c}: R$ ${moeda(v)} <i>(${pct}%)</i>`);
  }
  L.push('');
}

L.push(`<b>Lançamentos no mês:</b> ${lancs.length}`);
if (naoClassificados) {
  L.push(`⚠️ <b>${naoClassificados}</b> pendentes de revisão.`);
}

return [{
  json: {
    texto: L.join('\n'),
    total_despesa: totalDespesa,
    total_receita: totalReceita,
    qtd_lancamentos: lancs.length,
    qtd_pendentes: naoClassificados,
    estouros: estouros.length
  }
}];
