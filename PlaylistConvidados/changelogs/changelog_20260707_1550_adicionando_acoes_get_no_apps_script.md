# Changelog - 07/07/2026 15:50
## Frase descritiva: Adicionando ações get no apps script

Este changelog registra a modificação feita no arquivo do Apps Script (`apps-script/codigo.gs`) para adicionar o suporte a sugestões e curtidas via método GET.

### Prompt Motivador
> Correção de erro de CORS no POST: requisições POST com redirecionamento no Google Apps Script geram falhas de CORS em alguns domínios. Migrar as rotas de sugestão e curtida para GET elimina definitivamente essas limitações de comunicação.

### Explicação da Feature
- **Antes**: O `doGet` aceitava apenas a ação `list`. As ações `suggest` (sugerir) e `like` (curtir) precisavam ser enviadas via `doPost`, gerando restrições de CORS pré-flight.
- **Agora**: O `doGet` foi expandido para aceitar as parâmetros de query string `action=suggest&song=...` e `action=like&songId=...&browserId=...`, permitindo que toda a operação ocorra de forma simples e segura via GET.

---

### Comparativo de Código

#### Código Antigo (`apps-script/codigo.gs` - Função `doGet`)
*(Vide backup em [apps_script_codigo_20260707_1550.gs.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/apps_script_codigo_20260707_1550.gs.bak))*

#### Código Novo (`apps-script/codigo.gs` - Função `doGet`)
*(Vide arquivo final em [apps-script/codigo.gs](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/apps-script/codigo.gs))*
