# Lições Aprendidas (Lessons Learned)

Este documento registra os aprendizados técnicos e de processo acumulados ao longo do desenvolvimento do projeto **Motor de Playlist de Convidados**.

---

## 1. Integração com Google Apps Script
- **CORS e Redirecionamentos**: O Google Apps Script redireciona requisições de Web App (HTTP 302) para URLs sob `script.googleusercontent.com`. 
- **Prevenção de Pré-Flight CORS no POST**: Requisições `POST` usando `Content-Type: application/json` acionam o pre-flight `OPTIONS` pelo navegador. Como o Apps Script não responde corretamente a chamadas `OPTIONS`, isso gera erros de CORS. Para solucionar isso de forma definitiva, podemos configurar as requisições `POST` com `Content-Type: text/plain;charset=utf-8` (enviando o JSON serializado no corpo). Isto classifica a chamada como uma **Simple Request** de acordo com a especificação CORS, fazendo o navegador enviar o `POST` diretamente sem fazer o pre-flight `OPTIONS`. No script, lemos os dados parseando `e.postData.contents`.
- **Origem dos Erros 404 no Redirect (Echo)**: Se o Google retornar erro `404` no endpoint temporário `script.googleusercontent.com/macros/echo?user_content_key=...` após uma requisição de Web App, isso geralmente significa que o código do Apps Script estourou uma exceção em tempo de execução no `doGet` ou `doPost` (por exemplo, tentando chamar métodos de um objeto nulo como `getActiveSpreadsheet()` em scripts independentes) ou retornou um valor inválido.
- **Formatação de Dados**: O Apps Script deve retornar dados usando `ContentService` configurando explicitamente o MimeType JSON.

---

## 2. Prevenção de Spam no Client-Side
- **LocalStorage**: O controle de curtidas local é uma estratégia simples e eficaz para convites de casamento ou eventos informais, impedindo cliques repetitivos rápidos (spam de likes) sem a necessidade de autenticação complexa (login). As IDs de músicas curtidas são salvas em um array serializado no LocalStorage do navegador daquele domínio.

---

## 3. Arquitetura de Geração Estática Customizada
- **Separação de Código e Parâmetros (config.js)**: Ao gerar múltiplas subpastas de playlists para diferentes convites, em vez de alterar diretamente o HTML ou JavaScript base em cada geração, a abordagem mais limpa é copiar os assets estáticos inalterados e injetar as variáveis específicas em um arquivo isolado `config.js` na pasta de destino. O script principal lê essas variáveis globalmente (`window.PLAYLIST_CONFIG`). Isso facilita a manutenção e atualização dos templates globais de HTML, CSS e JS sem quebrar as playlists já criadas.
- **Estilo Dinâmico via Variáveis de CSS**: Definir a cor predominante injetando o valor hex do `config.js` diretamente na propriedade do `:root` (`document.documentElement.style.setProperty('--primary-color', ...)`) permite que o CSS consuma cores dinâmicas mantendo toda a estilização e transições limpas em Vanilla CSS.
