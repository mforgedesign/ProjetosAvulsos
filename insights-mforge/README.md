# Radar Comercial MForge

Painel estático para GitHub Pages. Os dados pessoais e os insights são
publicados somente dentro de `data/insights.enc.json`, criptografado com
AES-256-GCM. A senha nunca deve entrar no repositório.

Para visualizar o layout sem dados reais, abra `index.html?demo=1` e informe
qualquer senha. Em produção, o Jarvis gera `dashboard.json`, executa:

```bash
DASHBOARD_PASSPHRASE="$DASHBOARD_PASSPHRASE" \
node scripts/encrypt-dashboard.mjs dashboard.json data/insights.enc.json
```

Depois remove `dashboard.json`, confirma que nenhum JSON/Markdown em texto
claro foi adicionado ao Git e publica apenas o arquivo criptografado.
