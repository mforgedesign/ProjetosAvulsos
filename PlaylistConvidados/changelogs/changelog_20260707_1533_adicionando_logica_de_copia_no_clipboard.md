# Changelog - 07/07/2026 15:33
## Frase descritiva: Adicionando lógica de cópia no clipboard

Este changelog registra a modificação feita no script do painel administrativo (`generator/public/app.js`) para controlar as requisições à API e a área de transferência do sistema.

### Prompt Motivador
> Pedido do usuário para colocar um botão para copiar o código do Google Apps Script (.gs) diretamente da interface.

### Explicação da Feature
- **Antes**: O painel local não realizava requisições fora do formulário de submissão e das listagens de diretórios de playlists.
- **Agora**: Adicionou-se o evento de clique no botão `#btn-copy-gs` que realiza o fetch assíncrono para `/api/gs-code`, lê a string e a grava diretamente no clipboard do sistema operacional usando a Web API `navigator.clipboard`. Além disso, exibe feedbacks animados de carregamento, sucesso ("Copiado! ✔️") e erros visuais temporários.

---

### Comparativo de Código

#### Código Antigo (`generator/public/app.js`)
*(Vide backup em [generator_app_20260707_1530.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/generator_app_20260707_1530.js))*

#### Código Novo (`generator/public/app.js`)
*(Vide arquivo final em [generator/public/app.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/generator/public/app.js))*
