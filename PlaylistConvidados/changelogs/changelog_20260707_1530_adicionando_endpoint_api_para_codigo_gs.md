# Changelog - 07/07/2026 15:30
## Frase descritiva: Adicionando endpoint api para código gs

Este changelog registra a modificação feita no servidor local (`generator/server.js`) para criar a rota de leitura do arquivo Apps Script do projeto.

### Prompt Motivador
> Pedido do usuário para colocar um botão para copiar o código do Google Apps Script (.gs) diretamente da interface.

### Explicação da Feature
- **Antes**: O servidor Express possuía endpoints apenas para listar playlists ativas (`GET /api/playlists`) e gerar novas playlists estáticas (`POST /api/generate`).
- **Agora**: Adicionou-se o endpoint `GET /api/gs-code` que lê dinamicamente o arquivo físico `apps-script/codigo.gs` na raiz do projeto e o retorna como um JSON `{ code: '...' }`, eliminando redundâncias de replicação.

---

### Comparativo de Código

#### Código Antigo (`generator/server.js` - Listener de Rota)
*(Vide backup em [generator_server_20260707_1530.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/generator_server_20260707_1530.js.bak))*

#### Código Novo (`generator/server.js` - Listener de Rota)
*(Vide arquivo final em [generator/server.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/generator/server.js))*
