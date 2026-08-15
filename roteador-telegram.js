// ============================================================
// Identifica o que chegou pelo Telegram e prepara o payload.
// Node: Code (modo: Run Once for Each Item)
// ============================================================

const upd = $json;
const msg = upd.message || upd.channel_post || upd.edited_message || {};
const chat = msg.chat || {};
const from = msg.from || {};

let tipo = 'texto';
let file_id = '';
let mime = '';
let nome_arquivo = '';

if (Array.isArray(msg.photo) && msg.photo.length) {
  // O Telegram manda várias resoluções; a última é a maior.
  tipo = 'foto';
  file_id = msg.photo[msg.photo.length - 1].file_id;
  mime = 'image/jpeg';
} else if (msg.document) {
  tipo = 'documento';
  file_id = msg.document.file_id;
  mime = (msg.document.mime_type || 'application/pdf').toLowerCase();
  nome_arquivo = msg.document.file_name || '';
} else if (msg.voice || msg.audio) {
  tipo = 'audio';
}

const texto = msg.text || msg.caption || '';

// Mapeia quem mandou. Ajuste os IDs em MAPA_PESSOAS depois do primeiro teste:
// mande qualquer mensagem para o bot e leia o from.id no log de execução.
const MAPA_PESSOAS = {
  // 123456789: 'Kayo',
  // 987654321: 'Renata'
};
const pessoa = MAPA_PESSOAS[from.id] || 'Kayo';

// Origem granular ajuda a rastrear de onde veio cada linha da planilha.
let origem = 'telegram_texto';
if (tipo === 'foto') origem = 'telegram_foto';
else if (tipo === 'documento') origem = mime.includes('pdf') ? 'pdf_fatura' : 'telegram_foto';

return {
  json: {
    tipo,
    file_id,
    mime,
    nome_arquivo,
    texto,
    pessoa,
    origem,
    chat_id: chat.id,
    message_id: msg.message_id,
    tem_midia: tipo === 'foto' || tipo === 'documento',
    audio_nao_suportado: tipo === 'audio'
  }
};
