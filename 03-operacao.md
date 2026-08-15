# Operação — a rotina depois de instalado

O objetivo do sistema é reduzir a manutenção a **~15 minutos por mês**. Não a zero:
classificação financeira tem julgamento, e julgamento é seu.

---

## Diário — 0 minuto

Nada. As compras entram sozinhas pelo e-mail. O que não entrar, você compartilha
pelo Atalho B quando lembrar.

Se o bot responder com ⚠️ *classificação incerta*, ignore no momento. Você resolve
tudo de uma vez na revisão semanal.

---

## Semanal — 5 minutos (segunda de manhã)

O relatório chega às 8h no Telegram. Leia e responda três perguntas:

1. **Alguma rubrica estourou?** O relatório lista em 🔴.
2. **O ritmo fecha dentro do orçado?** Vem calculado.
3. **Quantos pendentes?** Se tiver, abra a planilha.

Para resolver pendentes: aba `Lancamentos` → filtro na coluna `status` → `pendente`.
Corrija `categoria`, `subcategoria` e `rubrica` na mão e mude o status para `confirmado`.

**Depois de corrigir, crie a regra.** Esse passo é o que faz o sistema melhorar.
Abra `config/regras-merchant.json` e adicione:

```json
{ "padrao": "nome do lugar", "categoria": "Alimentação",
  "subcategoria": "Restaurante", "rubrica": "Extras", "tipo": "despesa" }
```

Replique no Code node `Normalizar` do workflow 10 (array `REGRAS`, no topo).
Aquele estabelecimento nunca mais vai errar.

Padrões mais específicos primeiro — a primeira regra que casa vence.

---

## No fechamento de cada cartão

Quando a fatura fechar, mande o **PDF** pelo Atalho B. O sistema lança cada compra
individualmente e todas herdam a rubrica do cartão.

Não mande print da fatura na tela — o PDF original tem texto selecionável e a extração
sai muito mais precisa.

Se você já vinha recebendo os e-mails de compra durante o mês, as compras da fatura vão
colidir com as notificações já lançadas. É esperado: a conciliação de domingo detecta e
marca `revisar`. Confira e apague as repetidas.

**Quando pagar a fatura,** o pagamento entra como `transferencia` — não como despesa.
As compras já foram contadas. Se aparecer como `despesa`, corrija: contar as duas coisas
dobra o gasto do mês.

---

## Mensal — 10 minutos (primeiro dia útil)

1. Abra a aba `Comparativo`. Projetado × Realizado × Δ, por rubrica.
2. Onde o Δ passou de 10%, decida: **foi evento isolado ou a projeção está errada?**
   Se a projeção estiver errada, corrija no bloco do topo — é planejamento, é seu.
3. Preencha a coluna do mês seguinte na projeção.
4. Olhe a aba `Realizado` pelo eixo **categoria**. Essa é a visão que você não tinha:
   quanto foi para Alimentação, Transporte, Filhos — independente de qual cartão pagou.

Sobre o item 4: seu orçamento hoje agrupa por cartão (`Bradesco ELO 20`, `Nubank 04`…),
o que responde *"quanto sai de cada cartão"* mas não *"no que gastei"*. Depois de dois ou
três meses de dados, o corte por categoria costuma mostrar coisas que o corte por cartão
escondia.

---

## O que o sistema não faz (de propósito)

| Não faz | Por quê |
|---|---|
| Apagar lançamentos sozinho | Duplicata suspeita é marcada `revisar`, nunca removida. Apagar dado financeiro automaticamente é risco sem retorno. |
| Editar sua projeção | Planejamento é decisão sua. O robô registra fato. |
| Escrever nos blocos mensais existentes | Células mescladas + fórmulas encadeadas. Escrever ali quebraria os saldos. |
| Aprender sozinho com correções | Você adiciona a regra explicitamente. Um classificador que se reajusta sozinho fica impossível de auditar — e num controle financeiro, auditabilidade vale mais que autonomia. |
| Conectar direto na conta do banco | Exigiria entregar credencial bancária a um serviço terceiro. Se um dia quiser, o caminho é Open Finance via agregador regulado (Pluggy, Belvo), não scraping. |

---

## Quando algo dá errado

**Lançamento com valor errado** → corrija na planilha. Se foi foto ruim, mande de novo
com mais luz. Se foi PDF, veja se não era print.

**Categoria errada de novo** → você corrigiu mas não criou a regra. Crie.

**Bot mudo** → n8n → Executions. Se não há execução, o problema é o workflow 20 (inativo
ou credencial do Telegram). Se há execução com erro, o log diz qual nó falhou.

**Muitos `pendente`** → normal no primeiro mês. Cada regra criada reduz o próximo. Se
depois de 60 dias ainda houver muitos, provavelmente falta cobrir estabelecimentos
recorrentes — filtre por `pendente`, ordene por estabelecimento e ataque os repetidos.

**Fatura extraída pela metade** → PDF protegido por senha ou escaneado como imagem.
Remova a senha e reenvie.

---

## Calendário

| Quando | O quê | Tempo |
|---|---|---|
| Todo dia | Nada | — |
| Segunda 8h | Ler relatório, resolver pendentes, criar regras | 5 min |
| Domingo 20h | Ver alerta de duplicatas (se houver) | 2 min |
| Fechamento de cada cartão | Mandar PDF da fatura | 1 min |
| 1º dia útil do mês | Comparativo + projeção do mês seguinte | 10 min |

Total: **cerca de 15 minutos por mês**, contra as horas de digitação que hoje fazem a
planilha ficar desatualizada.
