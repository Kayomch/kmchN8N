# Gestão Financeira Familiar — captura automática de despesas

Sistema para alimentar a planilha `Kay_2026` sem digitação manual: você fotografa o cupom,
compartilha o print da notificação ou manda o PDF da fatura, e o lançamento aparece
classificado na planilha.

Roda no n8n que já existe neste repositório.

---

## O diagnóstico

Antes da solução, o que a planilha atual mostra:

**O que está bem feito.** A `Kay_2026` faz projeção × realizado com 17 rubricas, controla
5 contas (Bradesco, Inter, Mercado Pago, Itaú, Rico) e 6 cartões, e encadeia saldo mês a mês.
É um controle sério — a maioria das famílias não tem nada parecido.

**Onde ela trava.** Todo lançamento passa pela sua mão. Os blocos mensais estão preenchidos
até **agosto/26**; de setembro a dezembro ainda é resíduo copiado da `Kay_2025`. Fevereiro,
março, setembro, novembro e dezembro têm `#REF!` nas fórmulas de `Projetado` e
`Saldo diferença`.

Isso não é descuido — é o resultado previsível de um sistema que exige digitação diária
de alguém que não tem tempo para digitar diariamente.

**O ponto cego.** Suas rubricas agrupam por **instrumento de pagamento**:
`Bradesco ELO 20`, `Nubank 04`, `Itau Azul`, `Cartão P.A`. Isso responde *"quanto vai sair
de cada cartão este mês"* — que é o que você precisa para não estourar o saldo.

O que não responde é *"no que eu gastei"*. Uma fatura de R$ 5.355 do ELO é uma linha só.
Mercado, escola, viagem e farmácia entram no mesmo balde.

---

## A solução

**Automatizar o realizado. Não tocar na projeção.**

```
   iPhone                     n8n                    Google Sheets
┌────────────┐         ┌──────────────────┐      ┌──────────────────┐
│ Telegram   │────┐    │                  │      │ Kay_2026         │
│ foto/PDF   │    │    │  extrai (Claude) │      │                  │
├────────────┤    ├───▶│  classifica      │─────▶│ + Lancamentos ◀──┼── só escreve aqui
│ Atalho     │    │    │  deduplica       │      │ + Realizado      │
│ compartilhar│   │    │                  │      │ + Comparativo    │
├────────────┤    │    └──────────────────┘      │                  │
│ E-mail do  │────┘             │                │   Projeção   ────┼── continua sua
│ banco      │                  ▼                │   Blocos mensais │
└────────────┘           confirmação no          └──────────────────┘
                             Telegram
```

Três decisões que sustentam o desenho:

**1. A automação nunca escreve nos seus blocos.** Eles usam células mescladas, contas lado
a lado e fórmulas encadeadas entre meses. Um robô escrevendo em célula mesclada é perda de
dado garantida. A automação escreve só na aba nova `Lancamentos`, que é append-only.

**2. Cada lançamento carrega dois eixos.** `rubrica` mantém seu fluxo de caixa funcionando
igual ao de hoje. `categoria` é o eixo novo — natureza do gasto. Uma compra de R$ 320 no
Pão de Açúcar no ELO vira `Alimentação › Supermercado` **e** `Bradesco ELO 20 (Mensal`.
Você não perde o que tem e ganha o que falta.

**3. Projeção continua manual.** Planejar é decisão sua. O sistema registra fato.

---

## O que você ganha

| Antes | Depois |
|---|---|
| Digitar cada lançamento | Fotografar / compartilhar |
| Planilha atualizada até agosto | Atualizada no dia |
| Gasto por cartão | Gasto por cartão **e** por natureza |
| Descobrir estouro no fim do mês | Aviso semanal com ritmo projetado |
| Fatura = 1 linha | Fatura = 1 linha por compra |
| Duplicata só se você notar | Conciliação automática aos domingos |

---

## Formas de lançar

| Canal | Como | Automático? |
|---|---|---|
| **E-mail do banco** | Aviso de compra cai no Gmail → n8n lê | ✅ Total |
| **Telegram** | Foto do cupom, print, PDF ou texto | 2 toques |
| **Atalho iOS** | Compartilhar de qualquer app | 2 toques |
| **Voz** | Ditado no Atalho: *"almoço 52 no débito"* | 2 toques |

### Sobre notificação de cartão no iPhone

**O iOS não permite que nenhum app leia notificações de outro app.** Não há API para isso.
Quem promete isso no iPhone está lendo seu e-mail ou pedindo sua senha bancária.

O caminho equivalente — e que funciona de verdade — é o **e-mail de aviso de compra**:
você liga no app do banco, cria um filtro no Gmail, e a compra vira linha sozinha.
Passo a passo em [`docs/01-iphone.md`](docs/01-iphone.md).

---

## Estrutura

```
gestao-financeira/
├── README.md                      você está aqui
├── docs/
│   ├── 01-iphone.md               captura no iPhone (e a limitação do iOS)
│   ├── 02-instalacao.md           passo a passo, ~90 min
│   └── 03-operacao.md             a rotina de 15 min/mês
├── planilha/
│   └── schema.md                  abas novas, colunas, fórmulas
├── config/
│   ├── plano-de-contas.json       categorias, rubricas, contas, cartões
│   └── regras-merchant.json       classificação determinística
└── n8n/
    ├── build.py                   gera os workflows a partir de src/
    ├── src/*.js                   código dos nós, legível e versionado
    ├── 10-core-lancamento.json    motor: extrai → classifica → grava
    ├── 20-entrada-telegram.json   entrada pelo Telegram
    ├── 30-relatorio-semanal.json  consolidado, segunda 8h
    └── 40-conciliacao.json        caça duplicatas, domingo 20h
```

Os workflows são **gerados**, não escritos à mão. Para alterar a lógica, edite os `.js` em
`n8n/src/` e rode:

```bash
cd gestao-financeira/n8n && python3 build.py
```

Motivo: o código dos Code nodes vive escapado dentro de string JSON. Escrever à mão quebra
em silêncio e só aparece no import.

---

## Como funciona a classificação

Três camadas, em ordem de precedência:

1. **Regra determinística** — `regras-merchant.json`. "Natiane" sempre vira
   `Serviços Domésticos › Diarista`, rubrica `Natiane`. Confiança 1. Sempre vence.
2. **Claude** — quando nenhuma regra casa. Lê o comprovante, extrai valor/data/estabelecimento
   e sugere a classificação, com um grau de confiança.
3. **`Outros`** — quando nem o modelo tem confiança. Entra como `pendente`.

Casos 2 e 3 chegam no Telegram marcados. Você corrige uma vez, adiciona a regra,
e aquele estabelecimento nunca mais erra.

O aprendizado é **explícito de propósito**. Um classificador que se reajusta sozinho fica
impossível de auditar, e em controle financeiro auditabilidade vale mais que autonomia.

As regras já vêm carregadas com o que apareceu na sua planilha: Selma, Natiane, Enel,
Comgás, Sem Parar, Cond. St Germain, Escola Malu, Parcela Kicks, Salário Bolt, Incyclus,
Migratio, Espólio/Repasse Karen, ofertas Zion e IBP, Simples Nacional, DARF — 70+ padrões.

---

## Deduplicação

Dois níveis, porque o problema tem duas formas:

**Idêntica** — você manda a mesma foto duas vezes. Um hash de
`data + estabelecimento + valor + método + parcela` faz a gravação virar update em vez de
insert. Não duplica.

**Aproximada** — a notificação chega na hora da compra, e a mesma compra volta no PDF da
fatura no fim do mês. Valores idênticos, datas próximas, origens diferentes. A rotina de
domingo detecta e marca `revisar`.

**Nada é apagado automaticamente.** Apagar dado financeiro sem confirmação humana é risco
sem retorno — o sistema marca, você decide.

---

## Regra do pagamento de fatura

Pagamento de fatura de cartão entra como `transferencia`, **nunca** `despesa`. As compras
do cartão já foram lançadas individualmente; contar as duas coisas dobraria a despesa do mês.

Mesma regra para aporte entre contas próprias, resgate de investimento e repasse interno.
Está no prompt e nas regras — mas confira nos primeiros lançamentos, porque é o erro que
mais distorce o resultado.

---

## Por onde começar

1. **[`docs/02-instalacao.md`](docs/02-instalacao.md)** — instalar (~90 min)
2. **[`docs/01-iphone.md`](docs/01-iphone.md)** — configurar o iPhone
3. **[`docs/03-operacao.md`](docs/03-operacao.md)** — a rotina depois

Se quiser fatiar: instale o mínimo (planilha + workflows 10 e 20 + Telegram), use por uma
semana lançando por foto e texto. Só depois ligue o e-mail automático e os relatórios.
Automatizar tudo de uma vez costuma terminar em nada rodando.

---

## Limites conhecidos

- **Áudio não é transcrito.** Mensagem de voz no Telegram não é processada. O ditado do
  iPhone resolve — ele transcreve antes de enviar.
- **PDF escaneado como imagem** extrai pior que PDF com texto. Prefira o original do banco.
- **A pessoa é inferida pelo remetente do Telegram.** Preencha `MAPA_PESSOAS` no nó
  `Roteador` para separar seus gastos dos da Renata.
- **Sem integração bancária direta.** Exigiria entregar credencial de banco a terceiro.
  Se um dia fizer sentido, o caminho é Open Finance via agregador regulado (Pluggy, Belvo)
  — não scraping.
- **Blocos de setembro a dezembro precisam ser limpos manualmente** antes de ligar os
  relatórios, senão o comparativo do 2º semestre confronta 2026 contra dados de 2025.
