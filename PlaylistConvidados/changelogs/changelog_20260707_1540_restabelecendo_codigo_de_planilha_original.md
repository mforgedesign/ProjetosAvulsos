# Changelog - 07/07/2026 15:40
## Frase descritiva: Restabelecendo código de planilha original

Este changelog registra a modificação feita no arquivo do Apps Script (`apps-script/codigo.gs`) para restabelecer a versão original do usuário que possui suporte a concorrência e tabelas de curtidas vinculadas.

### Prompt Motivador
> Correção de erro de sincronização: ao recarregar a playlist, o frontend acusava erro de comunicação devido à divergência de chaves de dados e ações entre o script simplificado e a planilha existente do usuário.

### Explicação da Feature
- **Antes**: O código Apps Script anterior era simplificado, gravando apenas ID, Música e Likes na planilha ativa sem tratamento de concorrência ou registro de curtidas por navegador.
- **Agora**: Sobrescreveu-se o script pela versão robusta do usuário (`Code.gs` de Downloads), que manipula as abas `Musicas` e `Curtidas`, implementa o `LockService` para controle de escrita e processa requisições `POST` com JSON no corpo.

---

### Comparativo de Código

#### Código Antigo (`apps-script/codigo.gs`)
*(Vide backup em [apps_script_codigo_20260707_1540.gs.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/apps_script_codigo_20260707_1540.gs.bak))*

#### Código Novo (`apps-script/codigo.gs`)
*(Vide arquivo final em [apps-script/codigo.gs](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/apps-script/codigo.gs))*
