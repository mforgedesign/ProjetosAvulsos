/**
 * ==========================================================================
 * LÓGICA PRINCIPAL - PLAYLIST DE CONVIDADOS
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Obter Configurações Dinâmicas da Playlist
  const config = window.PLAYLIST_CONFIG || {
    title: "Playlist dos Convidados",
    apiUrl: "",
    primaryColor: "#6366f1"
  };

  // Configurar textos dinamicamente
  document.getElementById('playlist-title').textContent = config.title;
  document.title = `${config.title} | Sugestões de Músicas`;
  
  const cleanTitle = cleanStorageKey(config.title);
  const badgeEl = document.getElementById('playlist-badge');
  if (badgeEl) badgeEl.textContent = `playlist ${cleanTitle.replace(/_/g, ' ')}`;

  // Aplicar cor predominante convertendo Hex para HSL
  if (config.primaryColor) {
    try {
      const hsl = hexToHsl(config.primaryColor);
      document.documentElement.style.setProperty('--h', hsl.h);
      document.documentElement.style.setProperty('--s', hsl.s);
      document.documentElement.style.setProperty('--l', hsl.l);
    } catch (e) {
      console.error("Erro ao converter cor hexadecimal para HSL:", e);
      // Fallback para indigo
      document.documentElement.style.setProperty('--h', '239');
      document.documentElement.style.setProperty('--s', '84%');
      document.documentElement.style.setProperty('--l', '67%');
    }
  }

  // 2. Referências dos Elementos do DOM
  const elements = {
    form: document.getElementById('suggestionForm'),
    input: document.getElementById('songInput'),
    charCount: document.getElementById('charCount'),
    matches: document.getElementById('matches'),
    submitBtn: document.getElementById('submitBtn'),
    formStatus: document.getElementById('formStatus'),
    songCount: document.getElementById('songCount'),
    refreshBtn: document.getElementById('refreshBtn'),
    songsList: document.getElementById('songsList')
  };

  // Chaves de armazenamento exclusivas para esta playlist
  const STORAGE_KEYS = {
    browserId: `playlistConvidado:browserId:${cleanTitle}`,
    likedSongs: `playlistConvidado:likedSongs:${cleanTitle}`
  };

  // 3. Estado Local da Aplicação
  let songsList = [];
  let isSubmitting = false;
  let likingIds = new Set(); // Evitar cliques concorrentes de likes
  let likedSongs = loadLikedIds(); // IDs curtidas no LocalStorage
  const browserId = getBrowserId(); // ID única do navegador para a planilha

  // ==========================================================================
  // INICIALIZAÇÃO DE EVENTOS
  // ==========================================================================
  elements.input.addEventListener('input', handleInput);
  elements.form.addEventListener('submit', handleSubmit);
  elements.refreshBtn.addEventListener('click', () => fetchPlaylist());

  // Carregar playlist inicial
  fetchPlaylist();

  // ==========================================================================
  // CHAMADAS DE API (GOOGLE APPS SCRIPT)
  // ==========================================================================

  // Buscar músicas (GET)
  async function fetchPlaylist(options = {}) {
    if (!config.apiUrl) {
      showError("URL da API do Google Apps Script não configurada.");
      return;
    }

    if (!options.silent) {
      elements.songsList.innerHTML = `
        <div class="loading-state">
          <span class="loading-spinner" aria-hidden="true"></span>
          Carregando sugestões...
        </div>`;
    }

    elements.refreshBtn.disabled = true;

    try {
      const timestamp = Date.now();
      const separator = config.apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${config.apiUrl}${separator}action=list&_=${timestamp}`, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('O servidor respondeu em um formato inesperado. Verifique o Apps Script.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível carregar a lista.');
      }

      // RETROCOMPATIBILIDADE: Tratar se data é um array direto ou objeto { ok: true, songs: [...] }
      if (Array.isArray(data)) {
        songsList = data;
      } else if (data && data.ok && Array.isArray(data.songs)) {
        songsList = data.songs;
      } else if (data && data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Não foi possível processar a lista de sugestões.');
      }

      renderSongs();
      renderMatches();

    } catch (error) {
      console.error("Erro ao buscar playlist:", error);
      if (!options.silent) {
        showError(error.message || "Não foi possível carregar a lista de músicas.");
      }
    } finally {
      elements.refreshBtn.disabled = false;
    }
  }

  // Enviar Sugestão (GET)
  async function addSong(songName) {
    isSubmitting = true;
    setSubmittingState(true);
    clearStatus();

    try {
      // 1. Sincronizar silenciosamente antes para garantir que ninguém adicionou enquanto o usuário digitava
      await fetchPlaylist({ silent: true });

      const duplicateBeforeSubmit = findExactDuplicate(songName);
      if (duplicateBeforeSubmit) {
        showStatus('Essa música acabou de aparecer na lista! Dê um like nela.', 'info');
        highlightSongElement(duplicateBeforeSubmit.id);
        return;
      }

      // 2. Enviar nova sugestão usando GET para contornar problemas de CORS no POST do Apps Script
      const encodedSong = encodeURIComponent(songName);
      const separator = config.apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${config.apiUrl}${separator}action=suggest&song=${encodedSong}`, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('O servidor respondeu em formato inválido no cadastro.');
      }

      // Tratamento de sucesso unificado (GET)
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Não foi possível enviar a sugestão.');
      }

      if (data.duplicate) {
        showStatus('Essa música já havia sido sugerida. Mantivemos a versão da lista.', 'info');
      } else {
        showStatus("Música adicionada com sucesso! Você já pode sugerir outra.", "success");
        elements.form.reset();
        elements.charCount.textContent = '0/120';
        elements.input.focus();
      }

      // 3. Recarregar lista silenciosamente e destacar a nova música
      await fetchPlaylist({ silent: true });
      const newSongId = data.song ? data.song.id : '';
      renderSongs(newSongId);
      renderMatches();

    } catch (error) {
      console.error("Erro ao adicionar música:", error);
      showStatus(error.message || "Erro ao enviar sua sugestão. Tente novamente.", "error");
    } finally {
      isSubmitting = false;
      setSubmittingState(false);
    }
  }

  // Registrar Curtida (GET)
  async function registerLike(songId) {
    if (likedSongs.has(songId) || likingIds.has(songId)) return;

    likingIds.add(songId);
    
    // Atualização otimista local
    const songIndex = songsList.findIndex(s => s.id === songId);
    let originalLikes = 0;
    if (songIndex >= 0) {
      originalLikes = songsList[songIndex].likes;
      songsList[songIndex].likes += 1;
    }
    
    likedSongs.add(songId);
    saveLikedIds();
    renderSongs();

    try {
      // Usar GET para registrar curtidas, evitando pre-flight OPTIONS e erros de CORS
      const separator = config.apiUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${config.apiUrl}${separator}action=like&songId=${songId}&browserId=${browserId}`, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Formato inválido de resposta de voto.');
      }

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Erro ao registrar voto.');
      }

      // Se o servidor retornar o registro da música atualizada, aplica os likes finais
      if (data.song && songIndex >= 0) {
        songsList[songIndex].likes = data.song.likes;
      }
      
      if (data.alreadyLiked) {
        showStatus('Você já curtiu essa música de outro dispositivo/navegador.', 'info');
      }

      renderSongs(songId);
    } catch (error) {
      console.error("Erro ao curtir música:", error);
      // Reverter otimismo se der erro
      if (songIndex >= 0) {
        songsList[songIndex].likes = originalLikes;
      }
      likedSongs.delete(songId);
      saveLikedIds();
      renderSongs();
      showStatus(error.message || "Falha ao registrar voto.", "error");
    } finally {
      likingIds.delete(songId);
    }
  }

  // ==========================================================================
  // COMPARTILHAMENTO DE ENTRADAS & BUSCAS
  // ==========================================================================

  function handleInput() {
    const value = elements.input.value;
    elements.charCount.textContent = `${value.length}/120`;
    clearStatus();
    renderMatches();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const value = elements.input.value.replace(/\s+/g, ' ').trim();

    if (value.length < 2) {
      showStatus('Digite o nome e artista da música antes de confirmar.', 'error');
      elements.input.focus();
      return;
    }

    addSong(value);
  }

  function getMatchingSongs(query) {
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery.length < 2) return [];

    return songsList
      .filter(song => normalizeText(song.name || song.title).includes(normalizedQuery))
      .slice(0, 5);
  }

  function findExactDuplicate(value) {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    return songsList.find(song => normalizeText(song.name || song.title) === normalized) || null;
  }

  // ==========================================================================
  // RENDERIZAÇÃO DOM
  // ==========================================================================

  function renderSongs(highlightId = '') {
    // No script Code.gs, a ordenação decrescente de likes e por tempo já vem do servidor,
    // mas ordenamos aqui de forma otimista local para garantir atualizações perfeitas.
    const sortedSongs = [...songsList].sort((a, b) => {
      const likesDiff = Number(b.likes || 0) - Number(a.likes || 0);
      if (likesDiff !== 0) return likesDiff;
      // Em caso de empate de likes, ordenar pela mais recente
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });

    elements.songCount.textContent = `${sortedSongs.length} ${sortedSongs.length === 1 ? 'sugestão' : 'sugestões'}`;

    if (sortedSongs.length === 0) {
      elements.songsList.innerHTML = `
        <div class="empty">
          <strong>Ainda não há sugestões.</strong>
          <span>Seja a primeira pessoa a escolher uma música!</span>
        </div>`;
      return;
    }

    elements.songsList.innerHTML = sortedSongs.map((song, index) => {
      const isLiked = likedSongs.has(song.id);
      const isLiking = likingIds.has(song.id);
      const songTitle = song.name || song.title || '';

      return `
        <article class="song-card" id="song-${song.id}">
          <div class="rank">${index + 1}</div>
          <div class="song-info">
            <p class="song-name">${escapeHtml(songTitle)}</p>
            <p class="song-meta">Sugestão dos convidados</p>
          </div>
          <button
            type="button"
            class="like-btn ${isLiked ? 'liked' : ''}"
            data-like-id="${song.id}"
            aria-label="${isLiked ? 'Você já curtiu' : 'Curtir'} ${escapeHtml(songTitle)}"
            ${isLiked || isLiking ? 'disabled' : ''}
          >
            ${isLiking ? '…' : `${isLiked ? '♥' : '♡'} ${Number(song.likes || 0)}`}
          </button>
        </article>
      `;
    }).join('');

    // Escutar cliques de likes
    elements.songsList.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-like-id');
        registerLike(id);
      });
    });

    // Rolar até o item destacado
    if (highlightId) {
      requestAnimationFrame(() => {
        const card = document.getElementById(`song-${highlightId}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  function renderMatches() {
    const matches = getMatchingSongs(elements.input.value);

    if (!matches.length) {
      elements.matches.classList.remove('visible');
      elements.matches.innerHTML = '';
      return;
    }

    elements.matches.innerHTML = `
      <p class="matches-title">Veja se sua música já está aqui:</p>
      ${matches.map(song => {
        const songTitle = song.name || song.title || '';
        return `
          <div class="match-item">
            <span>${escapeHtml(songTitle)}</span>
            <span class="match-likes">♥ ${Number(song.likes || 0)}</span>
          </div>`;
      }).join('')}
    `;
    elements.matches.classList.add('visible');
  }

  // ==========================================================================
  // FUNÇÕES AUXILIARES / UTILITÁRIAS
  // ==========================================================================

  function hexToHsl(hex) {
    hex = hex.replace(/^#/, '');
    
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100) + '%',
      l: Math.round(l * 100) + '%'
    };
  }

  function normalizeText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' e ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanStorageKey(title) {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  // Identificador exclusivo de navegador para a tabela de curtidas
  function getBrowserId() {
    let id = localStorage.getItem(STORAGE_KEYS.browserId);
    if (id) return id;

    id = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `browser_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(STORAGE_KEYS.browserId, id);
    return id;
  }

  function loadLikedIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.likedSongs) || '[]');
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function saveLikedIds() {
    localStorage.setItem(STORAGE_KEYS.likedSongs, JSON.stringify([...likedSongs]));
  }

  function highlightSongElement(id) {
    const card = document.getElementById(`song-${id}`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.borderColor = 'var(--purple)';
      card.style.boxShadow = '0 0 15px hsl(var(--h), var(--s), 80%)';
      card.style.transform = 'scale(1.02)';
      
      setTimeout(() => {
        card.style.borderColor = '';
        card.style.boxShadow = '';
        card.style.transform = '';
      }, 3000);
    }
  }

  function setSubmittingState(active) {
    elements.input.disabled = active;
    elements.submitBtn.disabled = active;
    elements.submitBtn.innerHTML = active
      ? '<span class="inline-spinner" aria-hidden="true"></span>Sincronizando e confirmando...'
      : 'Confirmar sugestão';
  }

  function showStatus(message, type) {
    elements.formStatus.textContent = message;
    elements.formStatus.className = `status visible ${type}`;
  }

  function clearStatus() {
    elements.formStatus.textContent = '';
    elements.formStatus.className = 'status';
  }

  function showError(message) {
    elements.songsList.innerHTML = `
      <div class="empty">
        <strong>⚠️ Ocorreu um erro</strong>
        <span>${escapeHtml(message)}</span>
      </div>`;
  }

  function escapeHtml(unsafe) {
    return String(unsafe || '')
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
