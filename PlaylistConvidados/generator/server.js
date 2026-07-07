const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do Painel Administrativo
app.use(express.static(path.join(__dirname, 'public')));

// Caminhos importantes do projeto
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEMPLATES_DIR = path.join(PROJECT_ROOT, 'templates');
const PLAYLISTS_DIR = path.join(PROJECT_ROOT, 'playlists');

// Garantir que a pasta de playlists existe
if (!fs.existsSync(PLAYLISTS_DIR)) {
  fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
}

/**
 * ROTA: Listar todas as playlists geradas
 * GET /api/playlists
 */
app.get('/api/playlists', (req, res) => {
  try {
    if (!fs.existsSync(PLAYLISTS_DIR)) {
      return res.json([]);
    }

    const folders = fs.readdirSync(PLAYLISTS_DIR).filter(file => {
      const fullPath = path.join(PLAYLISTS_DIR, file);
      return fs.statSync(fullPath).isDirectory();
    });

    const playlists = folders.map(folder => {
      const configPath = path.join(PLAYLISTS_DIR, folder, 'config.js');
      let title = folder;
      let primaryColor = '#6366f1';
      let apiUrl = '';

      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        // Extração simples das variáveis usando regex para não precisar dar eval()
        const titleMatch = content.match(/title:\s*["'`](.*?)["'`]/);
        const colorMatch = content.match(/primaryColor:\s*["'`](.*?)["'`]/);
        const urlMatch = content.match(/apiUrl:\s*["'`](.*?)["'`]/);

        if (titleMatch) title = titleMatch[1];
        if (colorMatch) primaryColor = colorMatch[1];
        if (urlMatch) apiUrl = urlMatch[1];
      }

      return {
        folderName: folder,
        title: title,
        primaryColor: primaryColor,
        apiUrl: apiUrl,
        localUrl: `/playlists/${folder}/index.html`,
        githubUrl: `https://mforgedesign.github.io/ProjetosAvulsos/PlaylistConvidados/playlists/${folder}/`
      };
    });

    res.json(playlists);
  } catch (error) {
    console.error('Erro ao listar playlists:', error);
    res.status(500).json({ error: 'Erro ao listar as playlists existentes.' });
  }
});

// Servir a pasta playlists estaticamente também no servidor local para testes imediatos
app.use('/playlists', express.static(PLAYLISTS_DIR));

/**
 * ROTA: Gerar uma nova playlist
 * POST /api/generate
 */
app.post('/api/generate', (req, res) => {
  const { folderName, title, apiUrl, primaryColor } = req.body;

  // Validações básicas
  if (!folderName || !title || !apiUrl) {
    return res.status(400).json({ error: 'Os campos Pasta, Título e URL da Planilha são obrigatórios.' });
  }

  // Sanitizar o nome da pasta (permitir apenas letras, números e hífens/sublinhados)
  const cleanFolderName = folderName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, '-');

  if (!cleanFolderName) {
    return res.status(400).json({ error: 'Nome de pasta inválido após normalização.' });
  }

  const targetDir = path.join(PLAYLISTS_DIR, cleanFolderName);
  const color = primaryColor || '#6366f1';

  try {
    // 1. Criar diretório da nova playlist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 2. Copiar templates (index.html, style.css, script.js)
    const filesToCopy = ['index.html', 'style.css', 'script.js'];
    filesToCopy.forEach(fileName => {
      const srcFile = path.join(TEMPLATES_DIR, fileName);
      const destFile = path.join(targetDir, fileName);

      if (!fs.existsSync(srcFile)) {
        throw new Error(`Template ${fileName} não encontrado no servidor.`);
      }

      fs.copyFileSync(srcFile, destFile);
    });

    // 3. Gerar o arquivo config.js dinamicamente
    const configContent = `/**
 * Configuração gerada automaticamente pelo Motor de Playlist
 */
window.PLAYLIST_CONFIG = {
  title: "${title.replace(/"/g, '\\"')}",
  apiUrl: "${apiUrl.trim()}",
  primaryColor: "${color}"
};
`;

    fs.writeFileSync(path.join(targetDir, 'config.js'), configContent, 'utf8');

    // 4. Executar deploy automático no GitHub Pages
    let gitSuccess = true;
    let gitMessage = '';
    
    try {
      const status = execSync('git status --porcelain', { cwd: PROJECT_ROOT }).toString().trim();
      if (status) {
        execSync('git add .', { cwd: PROJECT_ROOT });
        const commitMsg = `feat(playlist): deploy automatico da playlist ${title} (${cleanFolderName})`;
        execSync(`git commit -m "${commitMsg}"`, { cwd: PROJECT_ROOT });
        
        // Tentar pull rebase preventivo para evitar rejeição de branches
        try {
          execSync('git pull origin main --rebase', { cwd: PROJECT_ROOT });
        } catch (pullErr) {
          console.warn('Aviso: Falha no git pull rebase de deploy:', pullErr.message);
        }
        
        execSync('git push', { cwd: PROJECT_ROOT });
        gitMessage = 'Enviado para o GitHub com sucesso! O build do GitHub Pages foi iniciado.';
      } else {
        gitMessage = 'Playlist atualizada localmente. Nenhuma nova alteração detectada para deploy.';
      }
    } catch (gitErr) {
      console.error('Erro no deploy automático do Git:', gitErr);
      gitSuccess = false;
      gitMessage = `Playlist criada localmente, mas falhou ao enviar para o GitHub: ${gitErr.message}`;
    }

    // 5. Retornar resposta de sucesso
    res.json({
      success: true,
      gitSuccess: gitSuccess,
      message: gitSuccess ? `Playlist "${title}" gerada e publicada com sucesso!` : `Playlist "${title}" gerada localmente.`,
      gitMessage: gitMessage,
      data: {
        folderName: cleanFolderName,
        title: title,
        primaryColor: color,
        localUrl: `/playlists/${cleanFolderName}/index.html`,
        githubUrl: `https://mforgedesign.github.io/ProjetosAvulsos/PlaylistConvidados/playlists/${cleanFolderName}/`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar playlist:', error);
    res.status(500).json({ error: `Falha ao gerar os arquivos da playlist: ${error.message}` });
  }
});

/**
 * ROTA: Retornar o código do Apps Script (codigo.gs) para cópia
 * GET /api/gs-code
 */
app.get('/api/gs-code', (req, res) => {
  const gsPath = path.join(PROJECT_ROOT, 'apps-script', 'codigo.gs');
  try {
    if (fs.existsSync(gsPath)) {
      const code = fs.readFileSync(gsPath, 'utf8');
      res.json({ code });
    } else {
      res.status(404).json({ error: 'Arquivo codigo.gs não encontrado no servidor.' });
    }
  } catch (error) {
    console.error('Erro ao ler codigo.gs:', error);
    res.status(500).json({ error: 'Erro interno ao ler arquivo do Apps Script.' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Motor de Playlist Rodando Localmente!`);
  console.log(`   Painel Administrativo: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
