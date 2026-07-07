# Changelog - 07/07/2026 15:35
## Frase descritiva: Adicionando deploy automatico no git

Este changelog registra a modificação feita no servidor local (`generator/server.js`) para integrar o fluxo automatizado do Git (add, commit, pull rebase e push) no endpoint de geração de playlists.

### Prompt Motivador
> Pedido do usuário para que o processo de deploy ocorra automaticamente ao clicar em gerar playlist, sem depender de comandos manuais no terminal ou do agente AI.

### Explicação da Feature
- **Antes**: A rota `/api/generate` apenas criava diretórios e arquivos de templates locais na máquina. Para publicar, exigia-se comitar e dar push manualmente via terminal.
- **Agora**: Acoplou-se a biblioteca `child_process.execSync` na rota. Ao gerar com sucesso, o servidor executa sequencialmente: `git add .`, `git commit` (com mensagem customizada), `git pull --rebase` (para evitar conflitos) e `git push`, enviando a nova playlist instantaneamente para o GitHub Pages.

---

### Comparativo de Código

#### Código Antigo (`generator/server.js` - Endpoint `/api/generate`)
*(Vide backup em [generator_server_20260707_1535.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/generator_server_20260707_1535.js.bak))*

#### Código Novo (`generator/server.js` - Endpoint `/api/generate`)
*(Vide arquivo final em [generator/server.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/generator/server.js))*
