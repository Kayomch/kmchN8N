# Estrutura da planilha

## Princípio: nada do que você já tem é alterado

A `Kay_2026` continua exatamente como está. A automação **só adiciona 3 abas novas** e nunca escreve
dentro dos seus blocos existentes.

Motivo técnico: seus blocos mensais usam células mescladas, contas lado a lado e fórmulas
encadeadas entre meses. Escrever automaticamente ali quebraria os encadeamentos de saldo
(e já existem `#REF!` em Fevereiro, Março, Setembro, Novembro e Dezembro). Um robô escrevendo
em célula mesclada é receita de perda de dado.

Motivo de método: **projeção é decisão sua, realizado é fato.** A automação registra fato.
O plano continua seu.

---

## O que você tem hoje

| Região | O que é | Quem mantém depois |
|---|---|---|
| Bloco superior (linhas ~3-37) | **Projeção anual** — 17 rubricas × 12 meses | Você, manual |
| Segundo bloco (~42-72) | Cenário alternativo de projeção | Você, manual |
| Blocos `JANEIRO`…`Dezembro` | **Livro de lançamentos** por conta (Bradesco, Inter, Mercado Pago, Itaú, Rico) | Vira conferência de saldo |
| Rodapé de cada bloco | `Saldo Atual` / `Projetado` / `Saldo diferença` | Passa a puxar do Realizado |

### Estado atual dos blocos mensais

| Bloco | Situação |
|---|---|
| Janeiro – Agosto/26 | Preenchidos e válidos |
| Setembro – Dezembro | **Resíduo de 2025** — sobraram da cópia da `Kay_2025` |
| Fev, Mar, Set, Nov, Dez | `#REF!` em `Projetado` / `Saldo diferença` |

Antes de ligar a automação, limpe setembro→dezembro (ver `docs/04-migracao-planilha.md`).
Se não limpar, o comparativo projetado × realizado do 2º semestre vai comparar contra número de 2025.

---

## Aba nova 1 — `Lancamentos`

Append-only. É aqui que a automação escreve, e **só aqui**. Uma linha = uma transação.

| # | Coluna | Tipo | Descrição |
|---|---|---|---|
| A | `id` | texto | `LCT-<base36>` gerado pelo sistema |
| B | `data` | data | Data do fato gerador (`AAAA-MM-DD`) |
| C | `data_registro` | data-hora | Quando entrou no sistema |
| D | `descricao` | texto | Texto original, como veio |
| E | `estabelecimento` | texto | Nome limpo do comerciante |
| F | `valor` | número | Sempre **positivo**. O sinal vem de `tipo` |
| G | `tipo` | lista | `despesa` \| `receita` \| `transferencia` |
| H | `categoria` | lista | Natureza do gasto — **eixo novo** |
| I | `subcategoria` | lista | Detalhe da natureza |
| J | `rubrica` | lista | Linha da **sua** projeção — eixo de compatibilidade |
| K | `metodo` | lista | `credito` \| `debito` \| `pix` \| `dinheiro` \| `boleto` \| `transferencia` |
| L | `conta_cartao` | lista | `Bradesco ELO 20`, `Nubank 04`, `Itaú`, `Rico`… |
| M | `parcela_atual` | inteiro | `3` em "3/10". `0` se à vista |
| N | `parcelas_total` | inteiro | `10` em "3/10". `0` se à vista |
| O | `pessoa` | lista | `Kayo` \| `Renata` \| `Karen` \| `Compartilhado` |
| P | `origem` | lista | `telegram_foto`, `telegram_texto`, `pdf_fatura`, `email`, `ios_atalho`, `manual` |
| Q | `confianca` | número | 0 a 1. Abaixo de 0,7 entra como `pendente` |
| R | `status` | lista | `confirmado` \| `pendente` \| `revisar` \| `excluido` |
| S | `hash_dedup` | texto | Chave de deduplicação. **Não editar** |
| T | `observacao` | texto | Livre |
| U | `anexo` | URL | Link do comprovante, quando houver |

**Os cabeçalhos precisam bater exatamente com esses nomes** — o n8n mapeia por nome de coluna.

### Por que dois eixos (`categoria` + `rubrica`)

Sua projeção agrupa por **instrumento de pagamento**: `Bradesco ELO 20`, `Nubank 04`,
`Itau Azul`, `Cartão P.A`. Isso responde *"quanto vai sair de cada cartão"* — que é o que
você precisa para não estourar o saldo.

O que ela não responde é *"no que eu gastei"*. Uma fatura de R$ 5.355 do ELO é uma linha só;
não dá para saber se foi mercado, escola ou viagem.

Então cada lançamento carrega os dois:
- `rubrica` mantém o seu fluxo de caixa funcionando igual;
- `categoria` te dá, pela primeira vez, o corte por natureza de gasto.

Uma compra de R$ 320 no Pão de Açúcar no ELO vira:
`categoria = Alimentação/Supermercado` **e** `rubrica = Bradesco ELO 20 (Mensal`.

### Regra do pagamento de fatura

Pagamento de fatura de cartão entra como `tipo = transferencia`, **nunca** `despesa`.
As compras individuais do cartão já foram lançadas. Contar as duas coisas dobraria a despesa.

O mesmo vale para: aporte entre contas próprias, resgate de investimento, repasse interno.

---

## Aba nova 2 — `Realizado`

Espelha o **layout exato** do seu bloco de projeção: rubricas nas linhas, meses nas colunas.
Só que os números vêm por `SUMIFS` da aba `Lancamentos`, não de digitação.

Colunas: `A` = rubrica, `B:M` = janeiro a dezembro.

Fórmula em `B2` (arrastar para todo o intervalo `B2:M18`):

```
=-SUMIFS(
   Lancamentos!$F:$F;
   Lancamentos!$J:$J; $A2;
   Lancamentos!$G:$G; "despesa";
   Lancamentos!$B:$B; ">="&DATE(2026;COLUMN()-1;1);
   Lancamentos!$B:$B; "<="&EOMONTH(DATE(2026;COLUMN()-1;1);0);
   Lancamentos!$R:$R; "<>excluido"
 )
```

O sinal negativo na frente mantém a convenção da sua projeção (despesa aparece negativa).

Para as linhas de receita, troque `"despesa"` por `"receita"` e remova o `-` inicial.

### Aba `Comparativo` (opcional, mas é o ponto todo)

Três colunas por mês: `Projetado` | `Realizado` | `Δ`.
`Projetado` referencia direto as células do seu bloco do topo; `Realizado` referencia a aba
`Realizado`. Nada é recalculado — é só justaposição.

É esse quadro que responde "onde eu furei o orçamento este mês" sem você abrir nada.

---

## Aba nova 3 — `Regras`

Espelho editável do `config/regras-merchant.json`. Serve para você corrigir classificação
direto na planilha, sem mexer em código.

| Coluna | Descrição |
|---|---|
| `padrao` | Trecho a procurar no estabelecimento/descrição (sem acento, minúsculo) |
| `categoria` | Categoria a aplicar |
| `subcategoria` | Subcategoria a aplicar |
| `rubrica` | Rubrica da projeção |
| `tipo` | `despesa` / `receita` / `transferencia` |
| `ativo` | `SIM` / `NAO` |

Primeira regra que casa vence — coloque os padrões mais específicos em cima.

---

## Ordem de precedência da classificação

1. **Regra de merchant** (`Regras` / `regras-merchant.json`) — determinística, sempre vence.
2. **Sugestão do Claude** — usada quando nenhuma regra casa.
3. **`Outros` / `Não classificado`** — quando nem o Claude tem confiança.

Casos 2 e 3 entram como `pendente` e chegam no Telegram com botão de correção.
Corrigiu uma vez → você adiciona a regra → nunca mais erra naquele estabelecimento.

É intencional que o aprendizado seja explícito. Um classificador que se ajusta sozinho
fica impossível de auditar, e num controle financeiro auditabilidade vale mais que autonomia.
