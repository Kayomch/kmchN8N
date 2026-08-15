# Captura no iPhone

## A limitação, dita de frente

**O iOS não deixa nenhum app ler as notificações de outro app.** Não existe permissão para
isso, nem API, nem workaround legítimo. No Android dá (MacroDroid/Tasker leem a bandeja de
notificações); no iPhone, não.

Qualquer serviço que prometa "capturar automaticamente suas notificações de cartão no iPhone"
está fazendo outra coisa — normalmente lendo seu e-mail, ou pedindo a senha do banco via
Open Finance.

Então a captura automática no iPhone vem por **três caminhos que realmente funcionam**, em
ordem de automação:

| Caminho | Automático? | Cobre |
|---|---|---|
| 1. E-mail de aviso de compra | ✅ Total | Cartões que mandam e-mail por compra |
| 2. Automação de SMS | ✅ Total | Bancos que mandam SMS de compra |
| 3. Atalhos (Shortcuts) | Manual, 2 toques | Cupom, print, PDF, texto, ditado |

Na prática o caminho 1 + 3 cobre quase tudo. Vale configurar o 1 primeiro — é o que
elimina digitação de verdade.

---

## Caminho 1 — E-mail de aviso de compra (o mais valioso)

### 1.1 Ligar os avisos por e-mail no banco

| Banco | Onde |
|---|---|
| Nubank | App → Perfil → Notificações → ative e-mail para compras |
| Itaú | App → Menu → Configurações → Avisos → Compras no cartão |
| Bradesco | App → Configurações → Avisos → Cartões |
| Inter | App → Perfil → Notificações |
| Mercado Pago | App → Seu perfil → Notificações |

### 1.2 Criar um filtro no Gmail

No Gmail (web) → Configurações → Filtros → **Criar novo filtro**:

```
De:      todomundo@nubank.com.br OR nao-responda@itau-unibanco.com.br OR
         bradesco@bradesco.com.br OR contato@bancointer.com.br
Assunto: compra OR Compra OR transação OR aprovada
```

Ação: **Aplicar marcador** → criar marcador `Financeiro/Compras`.
Marque também "Nunca enviar para Spam".

Faça o mesmo, num segundo filtro, para as faturas fechadas:
assunto `fatura OR Fatura` → marcador `Financeiro/Faturas`.

### 1.3 Ligar o Gmail no n8n

Workflow novo com:

1. **Gmail Trigger** — `Poll Times: a cada 5 min`, filtro `labelIds: Financeiro/Compras`,
   opção `Download Attachments: true` (para pegar os PDFs das faturas).
2. **Set** montando o payload:
   - `origem` = `email`
   - `texto` = `{{ $json.snippet }}` (ou `{{ $json.text }}` para o corpo completo)
   - `pessoa` = `Kayo`
3. **HTTP Request** → `POST http://localhost:5678/webhook/lancamento`

Para o marcador `Financeiro/Faturas`, adicione um **Extract From File** convertendo o PDF
anexo para base64 e mande em `base64` + `mime: application/pdf`. O core já sabe ler fatura
inteira e devolver um lançamento por linha.

Depois disso, **compra feita = linha na planilha, sem você tocar em nada.**

---

## Caminho 2 — Automação de SMS

Funciona para os bancos que ainda mandam SMS de compra. Não é o padrão hoje, mas custa
2 minutos configurar e é 100% automático quando serve.

**Atalhos → Automação → + → Mensagem**

- **Remetente:** o número/nome curto do banco
- **Mensagem contém:** `compra` (ou `aprovada`)
- **Executar imediatamente:** ✅ ligado (essencial — sem isso ele só notifica e espera toque)
- **Perguntar antes de executar:** ❌ desligado

Ações:
1. `Obter conteúdo de URL`
   - URL: `https://SEU-N8N.up.railway.app/webhook/lancamento`
   - Método: `POST`
   - Cabeçalhos: `X-Api-Token` = seu token
   - Corpo do pedido: `JSON`
     - `origem` (Texto) → `sms`
     - `pessoa` (Texto) → `Kayo`
     - `texto` (Texto) → variável **Conteúdo da Mensagem**

---

## Caminho 3 — Atalhos (Shortcuts)

Três atalhos. O segundo é o que você mais vai usar.

### Atalho A — "Gasto rápido"

Para lançar falando ou digitando. Coloque na tela de início ou no widget.

1. **Pedir entrada de texto** → Pergunta: `O que você gastou?`
   *(no teclado, o botão de ditado transcreve por voz)*
2. **Obter conteúdo de URL**
   - URL: `https://SEU-N8N.up.railway.app/webhook/lancamento`
   - Método `POST`, Cabeçalho `X-Api-Token: <seu token>`
   - Corpo JSON:
     - `origem` → `ios_atalho`
     - `pessoa` → `Kayo`
     - `texto` → **Entrada Fornecida**
3. **Mostrar notificação** → `Lançado ✅`

Uso: *"almoço 52 no débito"*, *"mercado 340 no elo em 3x"*, *"recebi 2670 de comissão"*.

### Atalho B — "Enviar p/ Finanças" (o principal)

Roda pela **folha de compartilhamento** — de dentro de qualquer app.
Print de notificação, foto de cupom, PDF de fatura: compartilhar → pronto.

1. Novo atalho → ⓘ → **Mostrar na Folha de Compartilhamento** ✅
   Tipos aceitos: **Imagens**, **Arquivos**, **PDFs**
2. **Codificar** → `Codificar Entrada do Atalho em Base64`
   *(desmarque "Quebras de linha" nas opções)*
3. **Obter conteúdo de URL**
   - URL: `https://SEU-N8N.up.railway.app/webhook/lancamento`
   - Método `POST`, Cabeçalho `X-Api-Token: <seu token>`
   - Corpo JSON:
     - `origem` → `ios_atalho`
     - `pessoa` → `Kayo`
     - `base64` → **Texto Codificado**
     - `mime` → `image/jpeg` (ou `application/pdf` — veja a variação abaixo)
4. **Mostrar notificação** → `Enviado ✅`

**Variação para aceitar imagem e PDF no mesmo atalho:** depois do passo 1, insira
`Obter Tipo do Arquivo` e um `Se` — se contiver `pdf`, defina uma variável `mime` como
`application/pdf`; senão `image/jpeg`. Use essa variável no passo 3.

### Atalho C — "Fechar o mês"

Dispara o consolidado sob demanda, sem esperar a segunda-feira.

1. **Obter conteúdo de URL** → `POST` no webhook do relatório
2. **Mostrar resultado**

---

## Recomendação de ordem

1. **Atalho B** primeiro — 10 minutos, resolve foto/print/PDF, é o que destrava o uso diário.
2. **Caminho 1 (e-mail)** em seguida — é o que faz a captura virar automática de verdade.
3. Atalho A e Caminho 2 depois, conforme sentir falta.

Não tente configurar tudo no mesmo dia. Ligue o Atalho B, use por uma semana, veja o que
mais dá trabalho, e automatize aquilo.
