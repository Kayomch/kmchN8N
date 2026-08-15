# Instalação

Tempo estimado: **60 a 90 minutos**. Faça na ordem — cada etapa depende da anterior.

---

## Pré-requisitos

- n8n rodando (este repositório já sobe no Railway)
- Conta Google com a planilha `Kay_2026`
- Chave de API da Anthropic — <https://console.anthropic.com> → API Keys
- Telegram instalado

---

## Etapa 1 — Preparar a planilha

**Faça uma cópia da `Kay_2026` antes de qualquer coisa.**
Arquivo → Fazer uma cópia → nomeie `Kay_2026_BACKUP_pre_automacao`.

### 1.1 Aba `Lancamentos`

Crie a aba e cole na linha 1, exatamente nesta ordem (A até U):

```
id	data	data_registro	descricao	estabelecimento	valor	tipo	categoria	subcategoria	rubrica	metodo	conta_cartao	parcela_atual	parcelas_total	pessoa	origem	confianca	status	hash_dedup	observacao	anexo
```

> Cole numa célula só usando **Colar especial → Colar somente valores** para o Sheets
> separar por tabulação. Os nomes precisam bater exatamente — o n8n mapeia por cabeçalho.

Formate: coluna `B` como Data, `C` como Data/hora, `F` como Número (2 casas), `Q` como Número.

### 1.2 Aba `Projecao`

O relatório precisa das rubricas em formato tabular. Crie a aba `Projecao` com:

- `A1` = `rubrica`, `B1:M1` = `janeiro` … `dezembro`
- `A2:A18` = as 17 rubricas de despesa, **escritas exatamente** como no seu bloco do topo
  (incluindo `Bradesco ELO 20 (Mensal` com o parêntese aberto — é assim que está hoje)
- `B2:M18` = referências às células do seu bloco de projeção, ex.: `=Página1!B9`

Assim a projeção continua sendo editada onde você já edita; esta aba só normaliza o formato.

### 1.3 Aba `Realizado`

Mesmo layout da `Projecao`. Em `B2`, cole e arraste até `M18`:

```
=-SUMIFS(Lancamentos!$F:$F; Lancamentos!$J:$J; $A2; Lancamentos!$G:$G; "despesa";
  Lancamentos!$B:$B; ">="&DATE(2026;COLUMN()-1;1);
  Lancamentos!$B:$B; "<="&EOMONTH(DATE(2026;COLUMN()-1;1);0);
  Lancamentos!$R:$R; "<>excluido")
```

### 1.4 Limpar setembro→dezembro

Esses blocos ainda têm dados de 2025. Apague o **conteúdo das tabelas de transações**
(mantenha cabeçalhos e fórmulas de saldo). Sem isso, o comparativo do 2º semestre vai
confrontar sua projeção 2026 contra realizado de 2025.

Anote o ID da planilha — está na URL, entre `/d/` e `/edit`:
```
https://docs.google.com/spreadsheets/d/1m5wZR27HgzMDZKQ4aTcHeGb7-tWgZOe0joH7sJYcPJE/edit
                                        └──────────── este trecho ────────────┘
```

---

## Etapa 2 — Bot do Telegram

1. No Telegram, procure **@BotFather** → `/newbot`
2. Nome: `Financeiro Chegancas` · Usuário: algo terminado em `bot`
3. Guarde o **token** que ele devolve
4. Mande qualquer mensagem para o seu bot
5. Abra `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` no navegador e copie o
   `chat.id` — é o seu **CHAT_ID**

---

## Etapa 3 — Credenciais no n8n

Em **Credentials → Add credential**, crie as quatro:

| Nome | Tipo | Configuração |
|---|---|---|
| `Anthropic API Key` | Header Auth | Name: `x-api-key` · Value: sua chave `sk-ant-...` |
| `Webhook Interno` | Header Auth | Name: `X-Api-Token` · Value: uma senha longa que você inventar |
| `Telegram Financeiro` | Telegram | Access Token: o token do BotFather |
| `Google Sheets` | Google Sheets OAuth2 | Siga o fluxo de autorização |

> A `Webhook Interno` protege o endpoint `/webhook/lancamento`. Ele fica exposto na internet
> pelo Railway — sem essa credencial, qualquer um poderia gravar linhas na sua planilha.
> Use algo longo e aleatório.

---

## Etapa 4 — Importar os workflows

Para cada arquivo em `n8n/`, na ordem: **Workflows → Import from File**

| Arquivo | O que faz |
|---|---|
| `10-core-lancamento.json` | Motor: recebe conteúdo, extrai, grava |
| `20-entrada-telegram.json` | Entrada pelo Telegram |
| `30-relatorio-semanal.json` | Consolidado toda segunda 8h |
| `40-conciliacao.json` | Caça duplicatas todo domingo 20h |

### Depois de importar, em cada workflow:

1. **Nós vermelhos** = credencial não selecionada. Abra cada um e escolha a credencial
   da tabela acima. É esperado — credenciais não viajam dentro do arquivo, por segurança.

2. **Nó `Config`** (workflows 10, 30, 40): troque `COLE_AQUI_O_ID_DA_PLANILHA` pelo ID real.

3. **Nós do Google Sheets**: confirme se `documentId` pegou o ID e se `sheetName`
   aponta para `Lancamentos` / `Projecao`.

4. **Workflows 30 e 40**: substitua `COLE_AQUI_SEU_CHAT_ID` pelo seu chat ID.

5. **Workflow 20**, nó `Processar`: a URL padrão é `http://localhost:5678/webhook/lancamento`.
   No Railway isso funciona (é chamada interna). Se der erro de conexão, troque pela URL
   pública do seu n8n.

6. **Workflow 20**, nó `Roteador`: para separar gastos seus e da Renata, preencha
   `MAPA_PESSOAS` com os IDs do Telegram de cada um.

---

## Etapa 5 — Ativar e testar

Ative **10** e **20** (chave no canto superior direito). Deixe 30 e 40 desativados até
os testes passarem.

Mande estas quatro mensagens ao bot, uma por vez:

| Teste | Enviar | Esperado |
|---|---|---|
| 1. Texto simples | `mercado 150 no débito` | 1 lançamento, Alimentação › Supermercado |
| 2. Regra determinística | `Natiane 840` | Serviços Domésticos › Diarista, rubrica `Natiane`, confiança 1 |
| 3. Parcelamento | `sofá 2400 no elo em 6x` | valor `400`, parcela 1/6, rubrica `Bradesco ELO 20 (Mensal` |
| 4. Foto | Foto de um cupom qualquer | Valor e estabelecimento corretos |

Confira na aba `Lancamentos` se as colunas foram preenchidas nos lugares certos.

**Teste crítico — deduplicação:** mande a mesma foto duas vezes. Deve continuar **uma
linha só**. Se duplicar, o `matchingColumns` do nó `Gravar na Planilha` não está em
`hash_dedup`.

Passando os quatro, ative 30 e 40.

---

## Problemas comuns

| Sintoma | Causa | Correção |
|---|---|---|
| `401` no nó Claude | Credencial errada | O header tem que ser `x-api-key`, não `Authorization` |
| `400 invalid_request_error` | Chave sem crédito ou modelo indisponível | Confira o saldo no console da Anthropic |
| Linhas duplicadas | Chave de match errada | `matchingColumns` = `hash_dedup` |
| Colunas embaralhadas | Cabeçalho diferente | Os nomes têm que bater exatamente com a Etapa 1.1 |
| Nada acontece no Telegram | Workflow inativo | Ative o 20 |
| `Unauthorized` no webhook | Token divergente | Mesma credencial `Webhook Interno` no nó `Entrada` e no nó `Processar` |
| Relatório vazio | Aba `Projecao` fora do formato | Rubricas em A, meses em B:M |
| Fatura vira 1 linha só | Foto ilegível | Mande o PDF original, não print da tela |

---

## Custo

O modelo usado é o `claude-opus-5`, com `effort: medium`.

Estimativa para uso familiar típico (~150 lançamentos/mês, com algumas faturas em PDF):
poucos dólares por mês. Uma foto de cupom custa uma fração de centavo; uma fatura de 40
linhas custa alguns centavos.

Se quiser reduzir: no nó `Config`, mude `EFFORT` para `low`. Se quiser mais precisão em
faturas ruins, use `high`. Trocar o modelo por um mais barato também é possível — mas
extração de comprovante ruim é justamente onde modelo bom paga por si, então eu manteria
o `opus-5` até ter volume que justifique a troca.
