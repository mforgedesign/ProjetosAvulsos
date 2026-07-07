/**
 * ==========================================================================
 * GOOGLE APPS SCRIPT - API PLAYLIST DE CONVIDADOS
 * ==========================================================================
 * 
 * Instruções para implantação:
 * 1. Crie uma Planilha Google.
 * 2. Na primeira linha, defina três colunas:
 *    A1: ID | B1: Musica | C1: Likes
 * 3. Vá em "Extensões" > "Apps Script".
 * 4. Apague todo o código existente no editor e cole este script.
 * 5. Clique em "Implantar" > "Nova implantação".
 * 6. Selecione o tipo de implantação: "App da Web" (clicando no ícone de engrenagem).
 * 7. Configure:
 *    - Executar como: "Você (seu e-mail)"
 *    - Quem tem acesso: "Qualquer pessoa" (fundamental para que os convidados acessem).
 * 8. Clique em "Implantar" e conceda as permissões necessárias à sua conta Google.
 * 9. Copie o URL gerado (URL do app da Web) e cole no seu gerador local ou arquivo config.js.
 */

function doGet(e) {
  var action = e.parameter.action;
  
  // Abrir a planilha ativa
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Garantir cabeçalhos se a planilha estiver vazia
  ensureHeaders(sheet);
  
  if (!action) {
    return createJsonResponse({ error: "Nenhuma acao foi fornecida. Use ?action=list, ?action=like&id=... ou ?action=add&song=..." });
  }
  
  // 1. LISTAR MÚSICAS
  if (action === "list") {
    var songs = getSongsList(sheet);
    return createJsonResponse(songs);
  }
  
  // 2. DAR LIKE EM UMA MÚSICA
  if (action === "like") {
    var id = e.parameter.id;
    if (!id) {
      return createJsonResponse({ error: "ID da musica e obrigatorio para registrar like." });
    }
    
    var newLikes = incrementLike(sheet, id);
    if (newLikes === null) {
      return createJsonResponse({ error: "Musica nao encontrada com a ID informada." });
    }
    return createJsonResponse({ success: true, id: id, likes: newLikes });
  }
  
  // 3. ADICIONAR NOVA SUGESTÃO DE MÚSICA
  if (action === "add") {
    var songName = e.parameter.song;
    if (!songName || songName.trim() === "") {
      return createJsonResponse({ error: "O nome da musica nao pode ser vazio." });
    }
    
    var result = addNewSong(sheet, songName);
    return createJsonResponse(result);
  }
  
  return createJsonResponse({ error: "Acao invalida." });
}

/**
 * Garante que as colunas A, B e C estão com os cabeçalhos apropriados
 */
function ensureHeaders(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(["ID", "Musica", "Likes"]);
    // Formatar cabeçalhos em negrito
    sheet.getRange("A1:C1").setFontWeight("bold");
  }
}

/**
 * Lê todas as músicas cadastradas
 */
function getSongsList(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return []; // Somente cabeçalho
  
  var songs = [];
  for (var i = 1; i < rows.length; i++) {
    songs.push({
      id: rows[i][0].toString(),
      title: rows[i][1].toString(),
      likes: parseInt(rows[i][2]) || 0
    });
  }
  return songs;
}

/**
 * Incrementa a contagem de likes de uma música pelo ID
 */
function incrementLike(sheet, id) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === id) {
      var currentLikes = parseInt(rows[i][2]) || 0;
      var newLikes = currentLikes + 1;
      
      // Coluna C é a 3ª coluna
      sheet.getRange(i + 1, 3).setValue(newLikes);
      return newLikes;
    }
  }
  return null; // Não encontrada
}

/**
 * Adiciona uma nova música na planilha após verificar duplicidade
 */
function addNewSong(sheet, songName) {
  var cleanName = songName.trim();
  var normalizedNew = normalizeString(cleanName);
  var rows = sheet.getDataRange().getValues();
  
  // Verificar duplicidades na planilha
  for (var i = 1; i < rows.length; i++) {
    var existingSong = rows[i][1].toString();
    if (normalizeString(existingSong) === normalizedNew) {
      return { 
        error: "Esta musica ja esta na lista! Vote nela para subir de posicao.", 
        id: rows[i][0].toString() 
      };
    }
  }
  
  // Criar UUID e adicionar música com 0 likes
  var newId = Utilities.getUuid();
  var initialLikes = 0;
  sheet.appendRow([newId, cleanName, initialLikes]);
  
  return { 
    success: true, 
    id: newId, 
    title: cleanName, 
    likes: initialLikes 
  };
}

/**
 * Função utilitária de normalização de strings para evitar duplicados com diferenças simples
 */
function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "") // Remove tudo que não for alfanumérico
    .trim();
}

/**
 * Helper para estruturar a resposta JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
