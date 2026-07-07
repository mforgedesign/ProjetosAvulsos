# Changelog - 07/07/2026 15:51
## Frase descritiva: Migrando comunicação para get nativo

Este changelog registra a modificação feita no JavaScript do template (`templates/script.js`) para migrar a comunicação cliente-planilha exclusivamente para requisições GET.

### Prompt Motivador
> Correção de erro de CORS no POST: requisições POST com redirecionamento no Google Apps Script geram falhas de CORS em alguns domínios. Migrar as rotas de sugestão e curtida para GET elimina definitivamente essas limitações de comunicação.

### Explicação da Feature
- **Antes**: O frontend utilizava o método `POST` com cabeçalho `text/plain` para cadastrar sugestões e registrar votos de curtida, que disparavam erros CORS de origem cruzada no navegador do usuário.
- **Agora**: A lógica dos métodos `addSong` e `registerLike` foi alterada para enviar as requisições exclusivamente via `GET` (com query string parametrizada, cache-busters de timestamp e redirecionamento nativo suportado), eliminando quaisquer problemas de CORS pré-flight.

---

### Comparativo de Código

#### Código Antigo (`templates/script.js` - Métodos de gravação)
*(Vide backup em [templates_script_20260707_1551.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/templates_script_20260707_1551.js.bak))*

#### Código Novo (`templates/script.js` - Métodos de gravação)
*(Vide arquivo final em [templates/script.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/templates/script.js))*
