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

  // 3. Estado Local da Aplicação
  let songsList = [];
  const storageKey = `liked_songs_${cleanTitle}`;
  let likedSongs = loadLikedIds();
  let isSubmitting = false;
  let likingIds = new Set(); // Evitar cliques concorrentes

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

  // Buscar músicas
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
      // Usar query string GET para contornar problemas de CORS no Apps Script
      const timestamp = Date.now();
      const response = await fetch(`${config.apiUrl}?action=list&_=${timestamp}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });

      if (!response.ok) throw new Error("Erro na comunicação com a planilha");

      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
        return;
      }

      songsList = Array.isArray(data) ? data : [];
      renderSongs();
      renderMatches();

    } catch (error) {
      console.error("Erro ao buscar playlist:", error);
      if (!options.silent) {
        showError("Não foi possível carregar a lista de músicas. Verifique sua conexão.");
      }
    } finally {
      elements.refreshBtn.disabled = false;
    }
  }

  // Enviar Sugestão
  async function addSong(songName) {
    isSubmitting = true;
    setSubmittingState(true);
    clearStatus();

    try {
      // 1. Sincronizar silenciosamente antes para garantir que ninguém adicionou enquanto digitava
      await fetchPlaylist({ silent: true });

      const duplicate = findExactDuplicate(songName);
      if (duplicate) {
        showStatus('Essa música acabou de aparecer na lista! Dê um like nela.', 'info');
        highlightSongElement(duplicate.id);
        return;
      }

      // 2. Enviar nova sugestão
      const encodedSong = encodeURIComponent(songName);
      const response = await fetch(`${config.apiUrl}?action=add&song=${encodedSong}`, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) throw new Error("Erro ao salvar música");

      const data = await response.json();

      if (data.error) {
        showStatus(data.error, 'info');
        if (data.id) {
          highlightSongElement(data.id);
        }
        return;
      }

      // Sucesso
      showStatus("Música sugerida com sucesso! Você pode sugerir outra.", "success");
      elements.form.reset();
      elements.charCount.textContent = '0/120';
      elements.input.focus();

      // Recarregar
      await fetchPlaylist({ silent: true });

    } catch (error) {
      console.error("Erro ao adicionar música:", error);
      showStatus("Erro ao enviar sua sugestão. Tente novamente.", "error");
    } finally {
      isSubmitting = false;
      setSubmittingState(false);
    }
  }

  // Registrar Like
  async function registerLike(songId, songName) {
    if (likedSongs.has(songId) || likingIds.has(songId)) return;

    likingIds.add(songId);
    
    // Atualização otimista
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
      const response = await fetch(`${config.apiUrl}?action=like&id=${songId}`, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) throw new Error("Erro de servidor ao registrar like");

      const data = await response.json();
      if (data.success) {
        // Atualiza com os likes reais do servidor
        if (songIndex >= 0) {
          songsList[songIndex].likes = data.likes;
        }
        renderSongs(songId);
      }
    } catch (error) {
      console.error("Erro ao curtir música:", error);
      // Reverter otimismo se der erro
      if (songIndex >= 0) {
        songsList[songIndex].likes = originalLikes;
      }
      likedSongs.delete(songId);
      saveLikedIds();
      renderSongs();
      showStatus("Falha ao registrar voto. Verifique a conexão.", "error");
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
      .filter(song => normalizeText(song.title).includes(normalizedQuery))
      .slice(0, 5);
  }

  function findExactDuplicate(value) {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    return songsList.find(song => normalizeText(song.title) === normalized) || null;
  }

  // ==========================================================================
  // RENDERIZAÇÃO DOM
  // ==========================================================================

  function renderSongs(highlightId = '') {
    // Ordenar decrescente por likes e alfabeticamente por nome em caso de empate
    const sortedSongs = [...songsList].sort((a, b) => {
      const likesDiff = Number(b.likes || 0) - Number(a.likes || 0);
      if (likesDiff !== 0) return likesDiff;
      return String(a.title).localeCompare(String(b.title), 'pt-BR');
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

      return `
        <article class="song-card" id="song-${song.id}">
          <div class="rank">${index + 1}</div>
          <div class="song-info">
            <p class="song-name">${escapeHtml(song.title)}</p>
            <p class="song-meta">Sugestão dos convidados</p>
          </div>
          <button
            type="button"
            class="like-btn ${isLiked ? 'liked' : ''}"
            data-like-id="${song.id}"
            aria-label="${isLiked ? 'Você já curtiu' : 'Curtir'} ${escapeHtml(song.title)}"
            ${isLiked || isLiking ? 'disabled' : ''}
          >
            ${isLiking ? '…' : `${isLiked ? '♥' : '♡'} ${Number(song.likes || 0)}`}
          </button>
        </article>
      `;
    }).join('');

    // Escutar eventos de clique nos botões de like
    elements.songsList.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-like-id');
        const song = songsList.find(s => s.id === id);
        if (song) registerLike(id, song.title);
      });
    });

    // Rolar até o item destacado se aplicável
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
      ${matches.map(song => `
        <div class="match-item">
          <span>${escapeHtml(song.title)}</span>
          <span class="match-likes">♥ ${Number(song.likes || 0)}</span>
        </div>`).join('')}
    `;
    elements.matches.classList.add('visible');
  }

  // ==========================================================================
  // FUNÇÕES AUXILIARES
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

  function loadLikedIds() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  }

  function saveLikedIds() {
    localStorage.setItem(storageKey, JSON.stringify([...likedSongs]));
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
