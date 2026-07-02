# Radar Comercial MForge

Painel estático para GitHub Pages. Os dados pessoais e os insights são publicados somente dentro de `data/insights.enc.json`, criptografado com AES-256-GCM. A senha nunca deve entrar no repositório.

Para visualizar o layout sem dados reais, abra `index.html?demo=1` e informe qualquer senha. Em produção, o Jarvis gera `/opt/mforge-insights/work/dashboard.json`, executa:

```bash
DASHBOARD_PASSPHRASE="$DASHBOARD_PASSPHRASE" \
node insights-mforge/scripts/encrypt-dashboard.mjs \
  /opt/mforge-insights/work/dashboard.json \
  insights-mforge/data/insights.enc.json
```

Depois remove `dashboard.json`, confirma que nenhum JSON/Markdown em texto claro foi adicionado ao Git e publica apenas o arquivo criptografado.

Validação local opcional:

```bash
DASHBOARD_PASSPHRASE="$DASHBOARD_PASSPHRASE" \
node insights-mforge/scripts/decrypt-dashboard.mjs \
  insights-mforge/data/insights.enc.json >/tmp/mforge-dashboard.json
```
