/**
 * ==========================================================================
 * LÓGICA PRINCIPAL - PLAYLIST DE CONVIDADOS
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Carregar Configurações e Definir Tema
  const config = window.PLAYLIST_CONFIG || {
    title: "Playlist de Convidados",
    apiUrl: "",
    primaryColor: "#6366f1"
  };

  // Definir título na página
  document.getElementById('playlist-title').textContent = config.title;
  document.title = `${config.title} | Sugestões de Músicas`;

  // Aplicar cor predominante dinamicamente no CSS
  if (config.primaryColor) {
    document.documentElement.style.setProperty('--primary-color', config.primaryColor);
    // Gerar uma cor de brilho (glow) com opacidade baseada no hex da cor primária
    const glowColor = hexToRgba(config.primaryColor, 0.15);
    document.documentElement.style.setProperty('--primary-glow', glowColor);
  }

  // 2. Elementos do DOM
  const songInput = document.getElementById('song-input');
  const btnSuggest = document.getElementById('btn-suggest');
  const btnSuggestText = btnSuggest.querySelector('.btn-text');
  const btnSuggestSpinner = btnSuggest.querySelector('.spinner');
  const searchFeedback = document.getElementById('search-feedback');
  const btnRefresh = document.getElementById('btn-refresh');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const playlistList = document.getElementById('playlist-list');
  const totalSongsBadge = document.getElementById('total-songs-badge');

  // 3. Estado Local da Aplicação
  let songsList = [];
  const storageKey = `liked_songs_${cleanStorageKey(config.title)}`;

  // Obter lista de curtidas salvas no LocalStorage
  let likedSongs = JSON.parse(localStorage.getItem(storageKey)) || [];

  // ==========================================================================
  // INICIALIZAÇÃO E REQUISIÇÕES DE API
  // ==========================================================================
  
  // Buscar músicas na planilha
  async function fetchPlaylist() {
    if (!config.apiUrl) {
      showError("URL da API não configurada. Configure o Apps Script no arquivo config.js.");
      return;
    }

    showLoading(true);
    try {
      // Usando GET para evitar problemas de pré-flight CORS do Apps Script
      const response = await fetch(`${config.apiUrl}?action=list`, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) throw new Error("Erro na requisição da planilha");

      const data = await response.json();
      
      if (data.error) {
        showError(data.error);
        return;
      }

      songsList = Array.isArray(data) ? data : [];
      renderPlaylist();

    } catch (error) {
      console.error("Erro ao buscar playlist:", error);
      showError("Não foi possível carregar a lista de músicas. Tente novamente mais tarde.");
    } finally {
      showLoading(false);
    }
  }

  // Enviar nova sugestão de música
  async function addSong(songName) {
    setSuggestingState(true);
    try {
      const encodedSong = encodeURIComponent(songName);
      const response = await fetch(`${config.apiUrl}?action=add&song=${encodedSong}`, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) throw new Error("Erro ao enviar sugestão");

      const data = await response.json();

      if (data.error) {
        // Se a música já existir, o Apps Script também acusa
        showNotification(data.error, 'warning');
        if (data.id) {
          // Destacar item existente na lista
          highlightSongElement(data.id);
        }
        return;
      }

      // Adição com sucesso
      showNotification("Música sugerida com sucesso!", "success");
      songInput.value = '';
      searchFeedback.style.display = 'none';
      
      // Recarregar playlist atualizada
      await fetchPlaylist();

    } catch (error) {
      console.error("Erro ao adicionar música:", error);
      showNotification("Erro ao enviar sugestão. Verifique sua conexão.", "error");
    } finally {
      setSuggestingState(false);
    }
  }

  // Enviar Like para a API
  async function registerLike(songId, likeButtonElement, countElement) {
    // Impedir cliques múltiplos rápidos
    if (likeButtonElement.disabled || likeButtonElement.classList.contains('liked')) return;
    
    // Otimista: atualiza a tela antes do fetch responder
    likeButtonElement.classList.add('liked');
    likeButtonElement.disabled = true;
    
    const currentLikes = parseInt(countElement.textContent) || 0;
    countElement.textContent = currentLikes + 1;
    
    // Adicionar no LocalStorage
    likedSongs.push(songId);
    localStorage.setItem(storageKey, JSON.stringify(likedSongs));

    try {
      const response = await fetch(`${config.apiUrl}?action=like&id=${songId}`, {
        method: 'GET',
        mode: 'cors'
      });

      if (!response.ok) throw new Error("Falha ao registrar like no servidor");
      
      const data = await response.json();
      if (data.success) {
        // Atualiza com o valor real retornado do servidor
        countElement.textContent = data.likes;
        // Atualiza na nossa lista local de memória e reordena
        const songIndex = songsList.findIndex(s => s.id === songId);
        if (songIndex !== -1) {
          songsList[songIndex].likes = data.likes;
          // Reordena e renderiza sem causar reload total
          reorderAndRender();
        }
      }
    } catch (error) {
      console.error("Erro ao curtir música:", error);
      // Reverter estado otimista caso falhe
      likeButtonElement.classList.remove('liked');
      likeButtonElement.disabled = false;
      countElement.textContent = currentLikes;
      likedSongs = likedSongs.filter(id => id !== songId);
      localStorage.setItem(storageKey, JSON.stringify(likedSongs));
      showNotification("Não foi possível registrar seu voto. Tente novamente.", "error");
    }
  }

  // ==========================================================================
  // RENDERIZAÇÃO E INTERACTION
  // ==========================================================================

  function renderPlaylist() {
    playlistList.innerHTML = '';
    totalSongsBadge.textContent = songsList.length;

    if (songsList.length === 0) {
      emptyState.style.display = 'block';
      playlistList.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    playlistList.style.display = 'flex';

    // Ordenar por likes decrescente
    const sortedSongs = [...songsList].sort((a, b) => b.likes - a.likes);

    sortedSongs.forEach((song, index) => {
      const hasLiked = likedSongs.includes(song.id);
      
      const li = document.createElement('li');
      li.className = 'playlist-item';
      li.setAttribute('data-id', song.id);
      
      li.innerHTML = `
        <div class="song-info">
          <span class="song-rank">${index + 1}</span>
          <div class="song-details">
            <h4 class="song-title" title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</h4>
          </div>
        </div>
        <div class="like-controls">
          <span class="like-count" data-count-id="${song.id}">${song.likes}</span>
          <button class="btn-like ${hasLiked ? 'liked' : ''}" data-like-id="${song.id}" ${hasLiked ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
      `;

      // Evento de Like
      const likeBtn = li.querySelector('.btn-like');
      const countSpan = li.querySelector(`[data-count-id="${song.id}"]`);
      likeBtn.addEventListener('click', () => registerLike(song.id, likeBtn, countSpan));

      playlistList.appendChild(li);
    });
  }

  // Reordenar a lista na memória e re-renderizar sem recarregar da API
  function reorderAndRender() {
    renderPlaylist();
  }

  // ==========================================================================
  // BUSCA E EVITAR REDUNDÂNCIAS (CLIENT-SIDE)
  // ==========================================================================

  // Escuta a digitação do usuário para identificar redundâncias em tempo real
  songInput.addEventListener('input', () => {
    const query = songInput.value;
    
    if (!query.trim()) {
      searchFeedback.style.display = 'none';
      return;
    }

    const normalizedQuery = normalizeText(query);
    
    // Verifica se a música digitada se assemelha a alguma já existente
    const duplicate = songsList.find(song => {
      const normalizedTitle = normalizeText(song.title);
      // Se a música digitada estiver inteiramente contida na música cadastrada,
      // ou se a música cadastrada estiver inteiramente contida na digitada (com tamanho razoável)
      return normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
    });

    if (duplicate) {
      searchFeedback.style.display = 'flex';
      // Rola a lista até o elemento duplicado para que o usuário veja
      const el = document.querySelector(`[data-id="${duplicate.id}"]`);
      if (el) {
        el.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        el.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
      }
    } else {
      searchFeedback.style.display = 'none';
      // Limpa os estilos de destaque temporários
      document.querySelectorAll('.playlist-item').forEach(item => {
        item.style.borderColor = '';
        item.style.backgroundColor = '';
      });
    }
  });

  // Evento ao clicar em sugerir
  btnSuggest.addEventListener('click', () => {
    const value = songInput.value.trim();
    if (!value) {
      showNotification("Por favor, digite o nome e artista da música.", "error");
      return;
    }
    
    // Validação final de duplicidade
    const normalizedVal = normalizeText(value);
    const exactDuplicate = songsList.find(s => normalizeText(s.title) === normalizedVal);
    if (exactDuplicate) {
      showNotification("Esta música já existe na lista! Dê um like nela.", "warning");
      highlightSongElement(exactDuplicate.id);
      return;
    }

    addSong(value);
  });

  // Permitir enviar com a tecla Enter
  songInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnSuggest.click();
    }
  });

  // Atualizar lista manualmente
  btnRefresh.addEventListener('click', () => {
    fetchPlaylist();
  });

  // ==========================================================================
  // FUNÇÕES AUXILIARES / UTILITÁRIAS
  // ==========================================================================

  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^\w\s-]/gi, '') // Remove caracteres especiais exceto hífen
      .replace(/\s+/g, ' ') // Transforma múltiplos espaços em um só
      .trim();
  }

  function cleanStorageKey(title) {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  function highlightSongElement(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.style.borderColor = 'var(--primary-color)';
      element.style.boxShadow = '0 0 15px var(--primary-color)';
      element.style.transform = 'scale(1.02)';
      
      setTimeout(() => {
        element.style.borderColor = '';
        element.style.boxShadow = '';
        element.style.transform = '';
      }, 3000);
    }
  }

  function setSuggestingState(isSuggesting) {
    btnSuggest.disabled = isSuggesting;
    songInput.disabled = isSuggesting;
    if (isSuggesting) {
      btnSuggestText.style.display = 'none';
      btnSuggestSpinner.style.display = 'inline-block';
    } else {
      btnSuggestText.style.display = 'inline-block';
      btnSuggestSpinner.style.display = 'none';
    }
  }

  function showLoading(show) {
    if (show) {
      loadingState.style.display = 'block';
      emptyState.style.display = 'none';
      playlistList.style.display = 'none';
    } else {
      loadingState.style.display = 'none';
    }
  }

  function showError(message) {
    loadingState.style.display = 'none';
    emptyState.style.display = 'block';
    emptyState.querySelector('.empty-icon').textContent = '⚠️';
    emptyState.querySelector('h4').textContent = 'Ocorreu um erro';
    emptyState.querySelector('p').textContent = message;
    playlistList.style.display = 'none';
  }

  function showNotification(message, type = 'success') {
    // Sistema leve de notificação flutuante toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background-color: ${type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : 'var(--error)'};
      color: #fff;
      padding: 12px 24px;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
      font-weight: 600;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
      opacity: 0;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
      toast.style.opacity = '1';
    }, 50);

    // Animação de saída
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    // 3 dígitos
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } 
    // 6 dígitos
    else if (hex.length === 7) {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  // Carregar lista de músicas imediatamente
  fetchPlaylist();
});
