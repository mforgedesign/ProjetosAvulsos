# Changelog - 07/07/2026 15:36
## Frase descritiva: Atualizando toasts de deploy git

Este changelog registra a modificação feita no script do painel do gerador (`generator/public/app.js`) para suportar a notificação detalhada do status de deploy automático.

### Prompt Motivador
> Pedido do usuário para que o processo de deploy ocorra automaticamente ao clicar em gerar playlist, sem depender de comandos manuais no terminal ou do agente AI.

### Explicação da Feature
- **Antes**: A UI tratava o retorno da API exibindo um único toast genérico de sucesso.
- **Agora**: A lógica analisa as novas propriedades do JSON (`gitSuccess` e `gitMessage`) e exibe feedbacks visuais múltiplos sequenciais: o primeiro toast confirma a geração dos arquivos, e o segundo detalha se o push para o GitHub Pages ocorreu com sucesso ou falha (em vermelho), facilitando diagnósticos rápidos.

---

### Comparativo de Código

#### Código Antigo (`generator/public/app.js`)
*(Vide backup em [generator_app_20260707_1535.js.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/generator_app_20260707_1535.js))*

#### Código Novo (`generator/public/app.js`)
*(Vide arquivo final em [generator/public/app.js](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/generator/public/app.js))*
