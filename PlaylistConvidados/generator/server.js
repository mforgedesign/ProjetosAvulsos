const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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
        githubUrl: `https://mforgedesign.github.io/ProjetosAvulsos/playlists/${folder}/`
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

    // 4. Retornar resposta de sucesso
    res.json({
      success: true,
      message: `Playlist "${title}" gerada com sucesso!`,
      data: {
        folderName: cleanFolderName,
        title: title,
        primaryColor: color,
        localUrl: `/playlists/${cleanFolderName}/index.html`,
        githubUrl: `https://mforgedesign.github.io/ProjetosAvulsos/playlists/${cleanFolderName}/`
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
