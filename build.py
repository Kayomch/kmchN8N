#!/usr/bin/env python3
"""
Gera os arquivos .json de workflow do n8n a partir dos scripts em src/.

Escrever o JSON à mão é frágil: o código dos Code nodes precisa ir escapado
dentro de uma string JSON, e um escape errado só aparece na hora do import.
Este builder resolve isso — edite os .js em src/, rode `python3 build.py`,
e reimporte no n8n.

    cd gestao-financeira/n8n && python3 build.py
"""

import json
import pathlib

RAIZ = pathlib.Path(__file__).parent
SRC = RAIZ / "src"

# Placeholders que você preenche na aba Config de cada workflow, dentro do n8n.
DOC_ID = "COLE_AQUI_O_ID_DA_PLANILHA"
ABA_LANC = "Lancamentos"
ABA_PROJ = "Projecao"
CHAT_ID = "COLE_AQUI_SEU_CHAT_ID"
URL_CORE = "http://localhost:5678/webhook/lancamento"


def js(nome: str) -> str:
    return (SRC / nome).read_text(encoding="utf-8")


def code(nome, script, pos, modo="runOnceForAllItems", notes=None):
    n = {
        "parameters": {"mode": modo, "jsCode": js(script)},
        "id": nome.lower().replace(" ", "-"),
        "name": nome,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
    }
    if notes:
        n["notes"] = notes
        n["notesInFlow"] = True
    return n


def sheets_rl(doc=DOC_ID, aba=ABA_LANC):
    return {
        "documentId": {"__rl": True, "value": doc, "mode": "id"},
        "sheetName": {"__rl": True, "value": aba, "mode": "name"},
    }


def conectar(*pares):
    """conectar(('A','B'), ('B','C')) -> dict de connections do n8n."""
    conns = {}
    for origem, destino in pares:
        saida = 0
        if isinstance(origem, tuple):
            origem, saida = origem
        conns.setdefault(origem, {"main": []})
        while len(conns[origem]["main"]) <= saida:
            conns[origem]["main"].append([])
        conns[origem]["main"][saida].append(
            {"node": destino, "type": "main", "index": 0}
        )
    return conns


def wf(nome, nodes, connections, tags=None):
    return {
        "name": nome,
        "nodes": nodes,
        "connections": connections,
        "settings": {
            "executionOrder": "v1",
            "timezone": "America/Sao_Paulo",
            "saveDataErrorExecution": "all",
            "saveDataSuccessExecution": "all",
        },
        "pinData": {},
        "tags": tags or [{"name": "gestao-financeira"}],
    }


def salvar(arquivo, dados):
    caminho = RAIZ / arquivo
    caminho.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"  gerado  {arquivo}  ({len(json.dumps(dados))} bytes)")


# =====================================================================
# 10 — CORE: recebe um payload, extrai lançamentos, grava na planilha
# =====================================================================
def build_core():
    nodes = [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "lancamento",
                "authentication": "headerAuth",
                "responseMode": "lastNode",
                "options": {},
            },
            "id": "webhook-core",
            "name": "Entrada",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [-200, 300],
            "webhookId": "gestao-financeira-lancamento",
            "notes": "POST /webhook/lancamento\nCorpo: { origem, pessoa, texto?, base64?, mime?, nome_arquivo?, chat_id? }",
            "notesInFlow": True,
        },
        {
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "a1", "name": "SHEETS_DOC_ID", "value": DOC_ID, "type": "string"},
                        {"id": "a2", "name": "ABA_LANCAMENTOS", "value": ABA_LANC, "type": "string"},
                        {"id": "a3", "name": "MODEL", "value": "claude-opus-5", "type": "string"},
                        {"id": "a4", "name": "EFFORT", "value": "medium", "type": "string"},
                    ]
                },
                "includeOtherFields": True,
                "options": {},
            },
            "id": "config-core",
            "name": "Config",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [20, 300],
            "notes": "Preencha SHEETS_DOC_ID.\nEFFORT: low | medium | high | xhigh | max",
            "notesInFlow": True,
        },
        {
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "b1", "name": "origem", "value": "={{ $json.body.origem || $json.origem || 'api' }}", "type": "string"},
                        {"id": "b2", "name": "pessoa", "value": "={{ $json.body.pessoa || $json.pessoa || 'Kayo' }}", "type": "string"},
                        {"id": "b3", "name": "texto", "value": "={{ $json.body.texto || $json.texto || '' }}", "type": "string"},
                        {"id": "b4", "name": "base64", "value": "={{ $json.body.base64 || $json.base64 || '' }}", "type": "string"},
                        {"id": "b5", "name": "mime", "value": "={{ $json.body.mime || $json.mime || '' }}", "type": "string"},
                        {"id": "b6", "name": "nome_arquivo", "value": "={{ $json.body.nome_arquivo || $json.nome_arquivo || '' }}", "type": "string"},
                        {"id": "b7", "name": "chat_id", "value": "={{ $json.body.chat_id || $json.chat_id || '' }}", "type": "string"},
                        {"id": "b8", "name": "contexto", "value": "={{ $json.body.contexto || $json.contexto || '' }}", "type": "string"},
                        {"id": "b9", "name": "anexo", "value": "={{ $json.body.anexo || $json.anexo || '' }}", "type": "string"},
                    ]
                },
                "includeOtherFields": True,
                "options": {},
            },
            "id": "payload-core",
            "name": "Payload",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [240, 300],
            "notes": "Aceita o corpo tanto em $json.body (webhook)\nquanto na raiz (chamada interna).",
            "notesInFlow": True,
        },
        code("Montar Requisição", "montar-requisicao.js", [460, 300],
             modo="runOnceForEachItem",
             notes="Prompt + schema de saída estruturada.\nEspelha config/plano-de-contas.json"),
        {
            "parameters": {
                "method": "POST",
                "url": "https://api.anthropic.com/v1/messages",
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {"name": "anthropic-version", "value": "2023-06-01"},
                        {"name": "content-type", "value": "application/json"},
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify($json.anthropic_body) }}",
                "options": {"timeout": 300000},
            },
            "id": "claude-core",
            "name": "Claude",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [680, 300],
            "notes": "Credencial: Header Auth\nNome do header: x-api-key\nValor: sua chave da Anthropic",
            "notesInFlow": True,
        },
        code("Normalizar", "normalizar.js", [900, 300],
             notes="Regras determinísticas + hash de deduplicação.\nEspelha config/regras-merchant.json"),
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                    "conditions": [
                        {
                            "id": "c1",
                            "leftValue": "={{ $json._vazio }}",
                            "rightValue": "",
                            "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                        }
                    ],
                    "combinator": "and",
                },
                "looseTypeValidation": True,
                "options": {},
            },
            "id": "if-vazio",
            "name": "Achou algo?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [1120, 300],
            "notes": "true = nada encontrado (pula a gravação)",
            "notesInFlow": True,
        },
        {
            "parameters": {
                "operation": "appendOrUpdate",
                **sheets_rl(),
                "columns": {
                    "mappingMode": "autoMapInputData",
                    "matchingColumns": ["hash_dedup"],
                    "value": {},
                    "schema": [],
                    "attemptToConvertTypes": False,
                    "convertFieldsToString": True,
                },
                "options": {"cellFormat": "USER_ENTERED"},
            },
            "id": "gravar-core",
            "name": "Gravar na Planilha",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [1340, 400],
            "notes": "appendOrUpdate com chave hash_dedup:\nreenviar o mesmo comprovante atualiza a linha\nem vez de duplicar.",
            "notesInFlow": True,
        },
        {
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "s1", "name": "ok", "value": "={{ true }}", "type": "boolean"}
                    ]
                },
                "includeOtherFields": True,
                "options": {},
            },
            "id": "saida-core",
            "name": "Resposta",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [1560, 400],
            "notes": "O que sai daqui é o corpo da resposta do webhook.",
            "notesInFlow": True,
        },
    ]

    conns = conectar(
        ("Entrada", "Config"),
        ("Config", "Payload"),
        ("Payload", "Montar Requisição"),
        ("Montar Requisição", "Claude"),
        ("Claude", "Normalizar"),
        ("Normalizar", "Achou algo?"),
        (("Achou algo?", 0), "Resposta"),
        (("Achou algo?", 1), "Gravar na Planilha"),
        ("Gravar na Planilha", "Resposta"),
    )
    salvar("10-core-lancamento.json", wf("Financeiro · 10 · Core (lançamento)", nodes, conns))


# =====================================================================
# 20 — Entrada pelo Telegram
# =====================================================================
def build_telegram():
    nodes = [
        {
            "parameters": {"updates": ["message"], "additionalFields": {}},
            "id": "tg-trigger",
            "name": "Telegram",
            "type": "n8n-nodes-base.telegramTrigger",
            "typeVersion": 1.2,
            "position": [-200, 300],
        },
        code("Roteador", "roteador-telegram.js", [20, 300], modo="runOnceForEachItem",
             notes="Detecta foto / PDF / texto e define a pessoa."),
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                    "conditions": [
                        {
                            "id": "m1",
                            "leftValue": "={{ $json.tem_midia }}",
                            "rightValue": "",
                            "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                        }
                    ],
                    "combinator": "and",
                },
                "looseTypeValidation": True,
                "options": {},
            },
            "id": "if-midia",
            "name": "Tem arquivo?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [240, 300],
        },
        {
            "parameters": {"resource": "file", "fileId": "={{ $json.file_id }}"},
            "id": "tg-getfile",
            "name": "Baixar Arquivo",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [460, 200],
        },
        {
            "parameters": {
                "operation": "binaryToPropery",
                "binaryPropertyName": "data",
                "destinationKey": "base64",
                "options": {},
            },
            "id": "to-base64",
            "name": "Converter p/ Base64",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1,
            "position": [680, 200],
        },
        {
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "p1", "name": "origem", "value": "={{ $('Roteador').item.json.origem }}", "type": "string"},
                        {"id": "p2", "name": "pessoa", "value": "={{ $('Roteador').item.json.pessoa }}", "type": "string"},
                        {"id": "p3", "name": "texto", "value": "={{ $('Roteador').item.json.texto }}", "type": "string"},
                        {"id": "p4", "name": "mime", "value": "={{ $('Roteador').item.json.mime }}", "type": "string"},
                        {"id": "p5", "name": "nome_arquivo", "value": "={{ $('Roteador').item.json.nome_arquivo }}", "type": "string"},
                        {"id": "p6", "name": "chat_id", "value": "={{ $('Roteador').item.json.chat_id }}", "type": "string"},
                        {"id": "p7", "name": "base64", "value": "={{ $json.base64 }}", "type": "string"},
                    ]
                },
                "options": {},
            },
            "id": "payload-midia",
            "name": "Payload (arquivo)",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [900, 200],
        },
        {
            "parameters": {
                "assignments": {
                    "assignments": [
                        {"id": "t1", "name": "origem", "value": "={{ $json.origem }}", "type": "string"},
                        {"id": "t2", "name": "pessoa", "value": "={{ $json.pessoa }}", "type": "string"},
                        {"id": "t3", "name": "texto", "value": "={{ $json.texto }}", "type": "string"},
                        {"id": "t4", "name": "chat_id", "value": "={{ $json.chat_id }}", "type": "string"},
                        {"id": "t5", "name": "base64", "value": "", "type": "string"},
                        {"id": "t6", "name": "mime", "value": "", "type": "string"},
                    ]
                },
                "options": {},
            },
            "id": "payload-texto",
            "name": "Payload (texto)",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [680, 420],
        },
        {
            "parameters": {
                "method": "POST",
                "url": URL_CORE,
                "authentication": "genericCredentialType",
                "genericAuthType": "httpHeaderAuth",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify($json) }}",
                "options": {"timeout": 300000},
            },
            "id": "chamar-core",
            "name": "Processar",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [1120, 300],
            "notes": "Chama o workflow 10-core.\nUse a mesma credencial Header Auth do webhook.",
            "notesInFlow": True,
        },
        code("Formatar Resposta", "formatar-resposta.js", [1340, 300],
             notes="Monta a confirmação. Até 5 lançamentos = 1 msg cada;\nacima disso, um resumo agregado."),
        {
            "parameters": {
                "chatId": "={{ $json.chat_id }}",
                "text": "={{ $json.texto }}",
                "additionalFields": {"parse_mode": "HTML", "appendAttribution": False},
            },
            "id": "tg-responder",
            "name": "Responder",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [1560, 300],
        },
    ]

    conns = conectar(
        ("Telegram", "Roteador"),
        ("Roteador", "Tem arquivo?"),
        (("Tem arquivo?", 0), "Baixar Arquivo"),
        (("Tem arquivo?", 1), "Payload (texto)"),
        ("Baixar Arquivo", "Converter p/ Base64"),
        ("Converter p/ Base64", "Payload (arquivo)"),
        ("Payload (arquivo)", "Processar"),
        ("Payload (texto)", "Processar"),
        ("Processar", "Formatar Resposta"),
        ("Formatar Resposta", "Responder"),
    )
    salvar("20-entrada-telegram.json", wf("Financeiro · 20 · Entrada Telegram", nodes, conns))


# =====================================================================
# 30 — Relatório semanal
# =====================================================================
def build_relatorio():
    nodes = [
        {
            "parameters": {
                "rule": {
                    "interval": [
                        {"field": "weeks", "triggerAtDay": [1], "triggerAtHour": 8, "triggerAtMinute": 0}
                    ]
                }
            },
            "id": "cron-rel",
            "name": "Toda segunda 8h",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.2,
            "position": [-200, 300],
        },
        {
            "parameters": {**sheets_rl(), "options": {}},
            "id": "ler-lanc",
            "name": "Ler Lancamentos",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [40, 300],
        },
        {
            "parameters": {**sheets_rl(aba=ABA_PROJ), "options": {}},
            "id": "ler-proj",
            "name": "Ler Projecao",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [280, 300],
            "notes": "Aba com as rubricas na coluna A\ne os meses nas colunas seguintes.",
            "notesInFlow": True,
        },
        code("Consolidar", "relatorio.js", [520, 300],
             notes="Projetado × Realizado + ritmo de gasto do mês."),
        {
            "parameters": {
                "chatId": CHAT_ID,
                "text": "={{ $json.texto }}",
                "additionalFields": {"parse_mode": "HTML", "appendAttribution": False},
            },
            "id": "tg-rel",
            "name": "Enviar",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [760, 300],
        },
    ]
    conns = conectar(
        ("Toda segunda 8h", "Ler Lancamentos"),
        ("Ler Lancamentos", "Ler Projecao"),
        ("Ler Projecao", "Consolidar"),
        ("Consolidar", "Enviar"),
    )
    salvar("30-relatorio-semanal.json", wf("Financeiro · 30 · Relatório semanal", nodes, conns))


# =====================================================================
# 40 — Conciliação de duplicatas
# =====================================================================
def build_conciliacao():
    nodes = [
        {
            "parameters": {
                "rule": {
                    "interval": [
                        {"field": "weeks", "triggerAtDay": [0], "triggerAtHour": 20, "triggerAtMinute": 0}
                    ]
                }
            },
            "id": "cron-conc",
            "name": "Domingo 20h",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.2,
            "position": [-200, 300],
        },
        {
            "parameters": {**sheets_rl(), "options": {}},
            "id": "ler-conc",
            "name": "Ler Lancamentos",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [40, 300],
        },
        code("Detectar Duplicatas", "conciliacao.js", [280, 300],
             notes="Mesmo valor + estabelecimento parecido + até 4 dias\n+ origens diferentes = provável duplicata."),
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                    "conditions": [
                        {
                            "id": "d1",
                            "leftValue": "={{ $json._sem_suspeitas }}",
                            "rightValue": "",
                            "operator": {"type": "boolean", "operation": "false", "singleValue": True},
                        }
                    ],
                    "combinator": "and",
                },
                "looseTypeValidation": True,
                "options": {},
            },
            "id": "if-susp",
            "name": "Achou duplicata?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [520, 300],
        },
        {
            "parameters": {
                "operation": "appendOrUpdate",
                **sheets_rl(),
                "columns": {
                    "mappingMode": "defineBelow",
                    "matchingColumns": ["id"],
                    "value": {
                        "id": "={{ $json.id }}",
                        "status": "={{ $json.status }}",
                        "observacao": "={{ $json.observacao }}",
                    },
                    "schema": [],
                    "attemptToConvertTypes": False,
                    "convertFieldsToString": True,
                },
                "options": {},
            },
            "id": "marcar-revisar",
            "name": "Marcar p/ revisão",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [760, 220],
            "notes": "Só muda status e observação.\nNunca apaga linha — decisão de excluir é sua.",
            "notesInFlow": True,
        },
        {
            "parameters": {
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
                    "conditions": [
                        {
                            "id": "p1",
                            "leftValue": "={{ $json._primeiro }}",
                            "rightValue": "",
                            "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                        }
                    ],
                    "combinator": "and",
                },
                "looseTypeValidation": True,
                "options": {},
            },
            "id": "if-primeiro",
            "name": "Primeiro item",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [980, 220],
            "notes": "Um alerta só, não um por duplicata.",
            "notesInFlow": True,
        },
        {
            "parameters": {
                "chatId": CHAT_ID,
                "text": "={{ $json.texto }}",
                "additionalFields": {"parse_mode": "HTML", "appendAttribution": False},
            },
            "id": "tg-conc",
            "name": "Avisar",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [1200, 220],
        },
    ]
    conns = conectar(
        ("Domingo 20h", "Ler Lancamentos"),
        ("Ler Lancamentos", "Detectar Duplicatas"),
        ("Detectar Duplicatas", "Achou duplicata?"),
        (("Achou duplicata?", 0), "Marcar p/ revisão"),
        ("Marcar p/ revisão", "Primeiro item"),
        (("Primeiro item", 0), "Avisar"),
    )
    salvar("40-conciliacao.json", wf("Financeiro · 40 · Conciliação de duplicatas", nodes, conns))


if __name__ == "__main__":
    print("Gerando workflows n8n...")
    build_core()
    build_telegram()
    build_relatorio()
    build_conciliacao()
    print("\nPronto. Importe os .json no n8n e preencha a aba Config de cada um.")
