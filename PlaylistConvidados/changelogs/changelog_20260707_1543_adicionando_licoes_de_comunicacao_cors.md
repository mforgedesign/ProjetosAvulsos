# Changelog - 07/07/2026 15:43
## Frase descritiva: Adicionando lições de comunicação cors

Este changelog registra a modificação feita no arquivo de lições aprendidas (`lessons.md`) para documentar os novos aprendizados sobre CORS em requisições POST com Google Apps Script.

### Prompt Motivador
> Descoberta técnica durante a sincronização de dados: corrigir o envio de likes e sugestões utilizando requisições POST com cabeçalho text/plain, evitando a validação pré-flight OPTIONS e resolvendo as limitações de CORS do Google Apps Script.

### Explicação da Feature
- **Antes**: O documento continha apenas lições sobre contornar o CORS via requisições GET simples.
- **Agora**: Adicionou-se o detalhamento técnico sobre a realização de POSTs com cabeçalho `Content-Type: text/plain` (Simple Requests) e sobre a depuração de erros 404 de echo gerados por exceções em tempo de execução no Apps Script.

---

### Comparativo de Código

#### Código Antigo (`lessons.md` - Seção 1)
*(Vide backup em [lessons_20260707_1543.md.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/lessons_20260707_1543.md.bak))*

#### Código Novo (`lessons.md` - Seção 1)
*(Vide arquivo final em [lessons.md](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/lessons.md))*
