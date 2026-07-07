# Changelog - 07/07/2026 15:45
## Frase descritiva: Corrigindo caminho das urls github pages

Este changelog registra a modificação feita no arquivo de servidor (`generator/server.js`) para corrigir as rotas geradas para o GitHub Pages.

### Prompt Motivador
> Correção de erro 404: os links do GitHub Pages exibidos no painel gerador resultavam em erro 404 porque não incluíam o subdiretório do projeto.

### Explicação da Feature
- **Antes**: O servidor gerava URLs assumindo que a pasta `playlists/` estava na raiz do domínio do GitHub Pages (`https://mforgedesign.github.io/ProjetosAvulsos/playlists/...`).
- **Agora**: Ajustaram-se os endpoints `/api/playlists` e `/api/generate` para incluir a subpasta do motor (`PlaylistConvidados`), montando a URL correta: `https://mforgedesign.github.io/ProjetosAvulsos/PlaylistConvidados/playlists/...`.

---

### Comparativo de Código

#### Código Antigo (`generator/server.js`)
*(Vide backup em [generator_server_20260707_1545.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/generator_server_20260707_1545.js.bak))*

#### Código Novo (`generator/server.js`)
*(Vide arquivo final em [generator/server.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/generator/server.js))*
