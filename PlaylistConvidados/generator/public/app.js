document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const form = document.getElementById('playlist-form');
  const inputTitle = document.getElementById('input-title');
  const inputFolder = document.getElementById('input-folder');
  const inputApi = document.getElementById('input-api');
  const inputColor = document.getElementById('input-color');
  const colorHexLabel = document.getElementById('color-hex-label');
  const btnSubmit = document.getElementById('btn-submit');
  const submitSpinner = btnSubmit.querySelector('.spinner-admin');
  
  // Tabela
  const playlistsLoading = document.getElementById('playlists-loading');
  const playlistsEmpty = document.getElementById('playlists-empty');
  const playlistsTableWrapper = document.getElementById('playlists-table-wrapper');
  const playlistsListBody = document.getElementById('playlists-list-body');

  // Controle de Edição Manual do Slug
  let isFolderManuallyEdited = false;

  // ==========================================================================
  // SUGERIR SLUG AUTOMATICAMENTE
  // ==========================================================================
  inputTitle.addEventListener('input', () => {
    if (!isFolderManuallyEdited) {
      inputFolder.value = generateSlug(inputTitle.value);
    }
  });

  inputFolder.addEventListener('input', () => {
    isFolderManuallyEdited = inputFolder.value.trim() !== '';
    // Garante que o slug digitado siga regras básicas
    inputFolder.value = generateSlug(inputFolder.value);
  });

  function generateSlug(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/&/g, 'e')
      .replace(/[^a-z0-9-_]/g, '-')   // substitui caracteres inválidos por hífens
      .replace(/-+/g, '-')             // reduz múltiplos hífens para um só
      .replace(/^-+|-+$/g, '');        // remove hífens no início e fim
  }

  // ==========================================================================
  // SELETOR E PALETAS DE CORES
  // ==========================================================================
  inputColor.addEventListener('input', () => {
    colorHexLabel.textContent = inputColor.value.toUpperCase();
    clearActivePaletteButtons();
  });

  // Configurar botões de paletas pré-definidas
  const paletteBtns = document.querySelectorAll('.btn-palette');
  paletteBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      inputColor.value = color;
      colorHexLabel.textContent = color.toUpperCase();
      
      clearActivePaletteButtons();
      btn.classList.add('active');
    });
  });

  function clearActivePaletteButtons() {
    paletteBtns.forEach(b => b.classList.remove('active'));
  }

  // ==========================================================================
  // GERENCIAR E LISTAR PLAYLISTS EXISTENTES
  // ==========================================================================
  async function loadPlaylists() {
    playlistsLoading.style.display = 'flex';
    playlistsEmpty.style.display = 'none';
    playlistsTableWrapper.style.display = 'none';

    try {
      const response = await fetch('/api/playlists');
      if (!response.ok) throw new Error("Falha ao buscar as playlists geradas");
      
      const playlists = await response.json();
      
      if (playlists.length === 0) {
        playlistsEmpty.style.display = 'flex';
        playlistsLoading.style.display = 'none';
        return;
      }

      playlistsListBody.innerHTML = '';
      playlists.forEach(playlist => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(playlist.title)}</strong></td>
          <td><code>playlists/${playlist.folderName}/</code></td>
          <td>
            <div class="playlist-color-indicator">
              <span class="color-dot" style="background-color: ${playlist.primaryColor}"></span>
              <span>${playlist.primaryColor.toUpperCase()}</span>
            </div>
          </td>
          <td>
            <div class="link-group">
              <a href="${playlist.localUrl}" target="_blank" class="link-action">
                🔍 Testar Local
              </a>
              <a href="${playlist.githubUrl}" target="_blank" class="link-action link-github">
                🌐 URL GitHub Pages
              </a>
            </div>
          </td>
        `;
        playlistsListBody.appendChild(tr);
      });

      playlistsTableWrapper.style.display = 'block';
    } catch (error) {
      console.error("Erro ao listar playlists:", error);
      showToast("Erro ao obter lista de playlists.", "error");
    } finally {
      playlistsLoading.style.display = 'none';
    }
  }

  // ==========================================================================
  // SUBMISSÃO DO FORMULÁRIO (GERAÇÃO)
  // ==========================================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = inputTitle.value.trim();
    const folderName = inputFolder.value.trim();
    const apiUrl = inputApi.value.trim();
    const primaryColor = inputColor.value;

    if (!title || !folderName || !apiUrl) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          folderName,
          apiUrl,
          primaryColor
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ocorreu um erro no servidor ao gerar.");
      }

      showToast(result.message || "Playlist gerada com sucesso!", "success");
      
      // Limpar formulário de forma amigável
      inputTitle.value = '';
      inputFolder.value = '';
      isFolderManuallyEdited = false;
      // Manter a URL da planilha e a cor para conveniência
      
      // Recarregar a lista de playlists
      loadPlaylists();

    } catch (error) {
      console.error("Erro ao submeter formulário:", error);
      showToast(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  });

  function setSubmitting(isSubmitting) {
    btnSubmit.disabled = isSubmitting;
    submitSpinner.style.display = isSubmitting ? 'inline-block' : 'none';
    const btnText = btnSubmit.querySelector('span');
    btnText.textContent = isSubmitting ? 'Gerando arquivos...' : 'Gerar Playlist';
  }

  // ==========================================================================
  // SISTEMA DE NOTIFICAÇÃO (TOAST)
  // ==========================================================================
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast-admin';
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 16px 24px;
      border-radius: var(--radius-md);
      color: #fff;
      font-weight: 600;
      font-size: 0.9rem;
      z-index: 1000;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      background-color: ${type === 'success' ? 'var(--success)' : 'var(--error)'};
      transform: translateY(100px);
      opacity: 0;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Entrada
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    }, 50);

    // Saída
    setTimeout(() => {
      toast.style.transform = 'translateY(100px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ==========================================================================
  // COPIAR CÓDIGO APPS SCRIPT (.GS)
  // ==========================================================================
  const btnCopyGs = document.getElementById('btn-copy-gs');
  if (btnCopyGs) {
    btnCopyGs.addEventListener('click', async () => {
      btnCopyGs.disabled = true;
      const originalText = btnCopyGs.innerHTML;
      btnCopyGs.innerHTML = '<span>⌛ Buscando...</span>';
      
      try {
        const response = await fetch('/api/gs-code');
        if (!response.ok) throw new Error("Erro ao carregar código do servidor");
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        await navigator.clipboard.writeText(data.code);
        showToast("Código do Apps Script copiado para o clipboard!", "success");
        btnCopyGs.innerHTML = '<span>✔️ Copiado!</span>';
      } catch (err) {
        console.error("Erro ao copiar código:", err);
        showToast(`Erro ao copiar código: ${err.message}`, "error");
        btnCopyGs.innerHTML = '<span>❌ Falha</span>';
      } finally {
        setTimeout(() => {
          btnCopyGs.disabled = false;
          btnCopyGs.innerHTML = originalText;
        }, 2500);
      }
    });
  }

  // Carregar playlists ao iniciar
  loadPlaylists();
});
