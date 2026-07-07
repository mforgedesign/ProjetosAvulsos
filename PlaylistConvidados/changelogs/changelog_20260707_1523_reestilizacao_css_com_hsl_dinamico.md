# Changelog - 07/07/2026 15:23
## Frase descritiva: Reestilização CSS com HSL dinâmico

Este changelog registra a modificação feita no arquivo de estilos (`templates/style.css`) para emular os efeitos visuais do arquivo de referência, acoplando um sistema de cores HSL dinâmicas.

### Prompt Motivador
> Solicitação do usuário para utilizar o arquivo `index.html` presente na pasta de Downloads como referência visual de UI do projeto.

### Explicação da Feature
- **Antes**: O CSS usava variáveis de cores fixas de tema escuro.
- **Agora**: Adotou-se o CSS do arquivo de referência (glassmorphism leve, pódios de ranking, botões com transições e animação shimmer na borda superior). As variáveis de cores foram parametrizadas usando a notação HSL baseada em `--h`, `--s`, `--l` injetadas via JS a partir do Hex selecionado no gerador, alterando dinamicamente e de forma harmônica toda a paleta visual do site.

---

### Comparativo de Código

#### Código Antigo (`templates/style.css`)
*(Vide backup em [templates_style_20260707_1520.css.bak](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/backups/templates_style_20260707_1520.css.bak))*

#### Código Novo (`templates/style.css`)
*(Vide arquivo final em [templates/style.css](file:///C:/Users/Acer/Documents/ProjetosAvulsos/PlaylistConvidados/templates/style.css))*
