# Changelog - 07/07/2026 15:41
## Frase descritiva: Compatibilizando comunicação com api original

Este changelog registra a modificação feita no JavaScript do template (`templates/script.js`) para compatibilizar as requisições de listagem, voto e sugestão com o modelo de dados do script robusto.

### Prompt Motivador
> Correção de erro de sincronização: ao recarregar a playlist, o frontend acusava erro de comunicação devido à divergência de chaves de dados e ações entre o script simplificado e a planilha existente do usuário.

### Explicação da Feature
- **Antes**: O frontend esperava um array de músicas diretamente da raiz da resposta GET, com chaves `.title`. Usava requisições GET com query string para votar (`?action=like&id=...`) e sugerir (`?action=add&song=...`).
- **Agora**: O frontend realiza requisições `GET ?action=list` e lê o array encapsulado em `data.songs` usando a chave `.name` como título. Os votos e sugestões foram portados para requisições `POST` usando cabeçalho `Content-Type: text/plain` (o que evita erros de CORS pré-flight OPTIONS no Apps Script) e o corpo em JSON no formato do script robusto.

---

### Comparativo de Código

#### Código Antigo (`templates/script.js`)
*(Vide backup em [templates_script_20260707_1540.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/templates_script_20260707_1540.js.bak))*

#### Código Novo (`templates/script.js`)
*(Vide arquivo final em [templates/script.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/templates/script.js))*
