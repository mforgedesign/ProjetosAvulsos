const CONFIG = {
  // Deixe vazio quando o Apps Script estiver vinculado à própria planilha.
  // Em projeto independente, cole aqui o ID da planilha.
  SPREADSHEET_ID: '',
  SONGS_SHEET: 'Musicas',
  LIKES_SHEET: 'Curtidas',
  MAX_SONG_LENGTH: 120
};

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'list').toLowerCase();

    ensureSheets_();

    // 1. Listagem de músicas
    if (action === 'list') {
      return jsonResponse_({ ok: true, songs: listSongs_() });
    }

    // 2. Sugestão de música (com suporte a GET para evitar CORS)
    if (action === 'suggest') {
      return jsonResponse_(suggestSong_(e.parameter.song));
    }

    // 3. Curtida de música (com suporte a GET para evitar CORS)
    if (action === 'like') {
      const songId = e.parameter.songId || e.parameter.id;
      const browserId = e.parameter.browserId;
      return jsonResponse_(likeSong_(songId, browserId));
    }

    return jsonResponse_({ ok: false, error: 'Ação GET inválida.' });
  } catch (error) {
    return jsonResponse_({ ok: false, error: friendlyError_(error) });
  }
}

function doPost(e) {
  try {
    ensureSheets_();

    const payload = parseBody_(e);
    const action = String(payload.action || '').toLowerCase();

    if (action === 'suggest') {
      return jsonResponse_(suggestSong_(payload.song));
    }

    if (action === 'like') {
      return jsonResponse_(likeSong_(payload.songId, payload.browserId));
    }

    return jsonResponse_({ ok: false, error: 'Ação POST inválida.' });
  } catch (error) {
    return jsonResponse_({ ok: false, error: friendlyError_(error) });
  }
}

/**
 * Execute uma vez no editor do Apps Script.
 * Cria as abas e aplica a formatação básica.
 */
function setup() {
  ensureSheets_();
  return 'Configuração concluída.';
}

function suggestSong_(rawSong) {
  const song = cleanSong_(rawSong);

  if (!song) {
    return { ok: false, error: 'Digite o nome da música e, de preferência, o artista.' };
  }

  if (song.length > CONFIG.MAX_SONG_LENGTH) {
    return {
      ok: false,
      error: `A sugestão deve ter no máximo ${CONFIG.MAX_SONG_LENGTH} caracteres.`
    };
  }

  const normalized = normalizeText_(song);
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(15000)) {
    return { ok: false, error: 'Muitas pessoas estão enviando ao mesmo tempo. Tente novamente.' };
  }

  try {
    // Esta verificação ocorre dentro do bloqueio. Assim, duas pessoas que
    // confirmem simultaneamente não conseguem criar músicas duplicadas.
    const sheet = getSpreadsheet_().getSheetByName(CONFIG.SONGS_SHEET);
    const rows = readSongRows_(sheet);
    const duplicate = rows.find(row => row.normalized === normalized);

    if (duplicate) {
      return {
        ok: true,
        duplicate: true,
        message: 'Essa música já foi sugerida.',
        song: publicSong_(duplicate)
      };
    }

    const id = Utilities.getUuid();
    const createdAt = new Date();
    const targetRow = sheet.getLastRow() + 1;
    const range = sheet.getRange(targetRow, 1, 1, 5);

    range.setNumberFormats([['@', '@', '@', '0', 'dd/MM/yyyy HH:mm:ss']]);
    range.setValues([[id, song, normalized, 0, createdAt]]);

    return {
      ok: true,
      duplicate: false,
      message: 'Música adicionada com sucesso!',
      song: publicSong_({ id, song, normalized, likes: 0, createdAt })
    };
  } finally {
    lock.releaseLock();
  }
}

function likeSong_(rawSongId, rawBrowserId) {
  const songId = cleanId_(rawSongId);
  const browserId = cleanId_(rawBrowserId);

  if (!songId || !browserId) {
    return { ok: false, error: 'Não foi possível identificar a música ou o navegador.' };
  }

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(15000)) {
    return { ok: false, error: 'Muitas curtidas ao mesmo tempo. Tente novamente.' };
  }

  try {
    const ss = getSpreadsheet_();
    const songsSheet = ss.getSheetByName(CONFIG.SONGS_SHEET);
    const likesSheet = ss.getSheetByName(CONFIG.LIKES_SHEET);

    const songRows = readSongRows_(songsSheet);
    const song = songRows.find(row => row.id === songId);

    if (!song) {
      return { ok: false, error: 'Essa música não foi encontrada.' };
    }

    const lastLikeRow = likesSheet.getLastRow();
    if (lastLikeRow >= 2) {
      const existingLikes = likesSheet.getRange(2, 1, lastLikeRow - 1, 2).getDisplayValues();
      const alreadyLiked = existingLikes.some(row => row[0] === browserId && row[1] === songId);

      if (alreadyLiked) {
        // Se já curtiu, não adiciona de novo e retorna o estado atualizado
        return {
          ok: true,
          alreadyLiked: true,
          message: 'Este navegador já curtiu essa música.',
          song: publicSong_(song)
        };
      }
    }

    const likesRow = likesSheet.getLastRow() + 1;
    const likesRange = likesSheet.getRange(likesRow, 1, 1, 3);
    likesRange.setNumberFormats([['@', '@', 'dd/MM/yyyy HH:mm:ss']]);
    likesRange.setValues([[browserId, songId, new Date()]]);

    const newLikes = Number(song.likes || 0) + 1;
    songsSheet.getRange(song.rowNumber, 4).setValue(newLikes);
    song.likes = newLikes;

    return {
      ok: true,
      alreadyLiked: false,
      message: 'Curtida registrada!',
      song: publicSong_(song)
    };
  } finally {
    lock.releaseLock();
  }
}

function listSongs_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SONGS_SHEET);

  return readSongRows_(sheet)
    .sort((a, b) => {
      const likesDifference = Number(b.likes) - Number(a.likes);
      if (likesDifference !== 0) return likesDifference;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map(publicSong_);
}

function readSongRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, 5).getValues()
    .map((row, index) => ({
      rowNumber: index + 2,
      id: String(row[0] || ''),
      song: String(row[1] || ''),
      normalized: String(row[2] || ''),
      likes: Number(row[3] || 0),
      createdAt: row[4] instanceof Date ? row[4] : new Date(row[4])
    }))
    .filter(row => row.id && row.song);
}

function publicSong_(row) {
  return {
    id: row.id,
    name: row.song,
    likes: Number(row.likes || 0),
    createdAt: row.createdAt instanceof Date && !isNaN(row.createdAt)
      ? row.createdAt.toISOString()
      : null
  };
}

function ensureSheets_() {
  const ss = getSpreadsheet_();

  let songsSheet = ss.getSheetByName(CONFIG.SONGS_SHEET);
  if (!songsSheet) songsSheet = ss.insertSheet(CONFIG.SONGS_SHEET);

  if (songsSheet.getLastRow() === 0) {
    songsSheet.getRange(1, 1, 1, 5).setValues([[
      'ID', 'Música', 'Normalizada', 'Likes', 'Criado em'
    ]]);
    songsSheet.setFrozenRows(1);
    songsSheet.getRange('A:C').setNumberFormat('@');
    songsSheet.getRange('D:D').setNumberFormat('0');
    songsSheet.getRange('E:E').setNumberFormat('dd/MM/yyyy HH:mm:ss');
    songsSheet.setColumnWidths(1, 1, 250);
    songsSheet.setColumnWidth(2, 360);
    songsSheet.setColumnWidth(3, 360);
    songsSheet.setColumnWidth(4, 90);
    songsSheet.setColumnWidth(5, 170);
  }

  let likesSheet = ss.getSheetByName(CONFIG.LIKES_SHEET);
  if (!likesSheet) likesSheet = ss.insertSheet(CONFIG.LIKES_SHEET);

  if (likesSheet.getLastRow() === 0) {
    likesSheet.getRange(1, 1, 1, 3).setValues([[
      'Browser ID', 'Música ID', 'Criado em'
    ]]);
    likesSheet.setFrozenRows(1);
    likesSheet.getRange('A:B').setNumberFormat('@');
    likesSheet.getRange('C:C').setNumberFormat('dd/MM/yyyy HH:mm:ss');
    likesSheet.setColumnWidths(1, 2, 300);
    likesSheet.setColumnWidth(3, 170);
  }
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Vincule o projeto a uma planilha ou informe CONFIG.SPREADSHEET_ID.');
  }

  return active;
}

function cleanSong_(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanId_(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100);
}

function normalizeText_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('O corpo da requisição não contém um JSON válido.');
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function friendlyError_(error) {
  console.error(error);
  return error && error.message ? error.message : 'Ocorreu um erro inesperado.';
}
