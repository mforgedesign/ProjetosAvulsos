"use strict";

const $ = selector => document.querySelector(selector);
const gate = $("#gate");
const dashboard = $("#dashboard");
let dashboardData = null;

const demoData = {
  generatedAt: new Date().toISOString(),
  period: "Últimos 30 dias",
  kpis: [
    { label: "Leads na Susie", value: 84, note: "+12% no período" },
    { label: "Confirmaram no WhatsApp", value: 31, note: "36,9% dos leads" },
    { label: "Vendas comprovadas", value: 18, note: "58,1% das confirmações" },
    { label: "Oportunidades abertas", value: 9, note: "6 com alta prioridade" }
  ],
  funnel: [
    { label: "Nome + WhatsApp", value: 84 }, { label: "Modelo", value: 71 },
    { label: "Dados do evento", value: 58 }, { label: "Resumo final", value: 38 },
    { label: "Clique no WhatsApp", value: 31 }, { label: "Venda comprovada", value: 18 }
  ],
  objections: [
    { label: "Preço ou momento financeiro", value: 14 },
    { label: "Parou após resposta automática", value: 11 },
    { label: "Prazo ou evento muito próximo", value: 7 },
    { label: "Modelo não encontrado", value: 4 }
  ],
  opportunities: [
    { score: 9, title: "Retomar leads com evento próximo", detail: "Há intenção clara e dados suficientes para uma abordagem objetiva." },
    { score: 8, title: "Oferecer Save The Date", detail: "Leads antecipados demonstraram urgência em avisar convidados." },
    { score: 7, title: "Recuperar abandono no modelo", detail: "Apresente três opções alinhadas ao tema informado." }
  ],
  conversations: [
    { name: "Exemplo de lead", phoneE164: "+5511999999999", stage: "Negociação", score: 9, insight: "Demonstrou intenção de compra, mas interrompeu após perguntar sobre prazo.", suggestedMessage: "Oi! Separei uma opção que cabe no prazo do seu evento. Posso te mostrar?", analysisUrl: "", lastMessageAt: "2026-07-01T18:00:00Z" }
  ]
};

async function deriveKey(passphrase, salt, usage) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 },
    material, { name: "AES-GCM", length: 256 }, false, usage
  );
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

async function loadEncrypted(passphrase) {
  if (new URLSearchParams(location.search).get("demo") === "1") return demoData;
  const response = await fetch(`data/insights.enc.json?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Ainda não há uma consolidação publicada.");
  const envelope = await response.json();
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const ciphertext = fromBase64(envelope.ciphertext);
  const key = await deriveKey(passphrase, salt, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function render(data) {
  dashboardData = data;
  $("#updated-at").textContent = `Atualizado em ${new Date(data.generatedAt).toLocaleString("pt-BR")}`;
  $("#funnel-period").textContent = data.period || "";
  $("#kpis").replaceChildren(...(data.kpis || []).map(item => element("article", "kpi", `
    <span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.note || "")}</small>`)));

  const maxFunnel = Math.max(...(data.funnel || []).map(item => Number(item.value)), 1);
  $("#funnel").replaceChildren(...(data.funnel || []).map(item => element("div", "funnel-row", `
    <span class="funnel-label">${escapeHtml(item.label)}</span><div class="bar"><i style="width:${Math.max(2, Number(item.value) / maxFunnel * 100)}%"></i></div><span class="funnel-value">${escapeHtml(item.value)}</span>`)));

  const maxObjection = Math.max(...(data.objections || []).map(item => Number(item.value)), 1);
  $("#objections").replaceChildren(...(data.objections || []).map(item => element("div", "rank-item", `
    <strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span><div class="bar"><i style="width:${Number(item.value) / maxObjection * 100}%"></i></div>`)));

  $("#opportunity-count").textContent = `${(data.opportunities || []).length} sinais`;
  $("#opportunities").replaceChildren(...(data.opportunities || []).map(item => element("article", "opportunity", `
    <span class="score">${escapeHtml(item.score)}/10</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.detail)}</p>`)));
  renderConversations(data.conversations || []);
  renderCrm(data.crm || {});
}

function renderCrm(crm) {
  const stages = crm.stages || {};
  const total = Object.values(stages).reduce((sum, value) => sum + Number(value || 0), 0);
  $("#crm-db-status").textContent = crm.generatedAt ? `CRM · ${new Date(crm.generatedAt).toLocaleString("pt-BR")}` : "CRM local";
  $("#crm-stage-grid").replaceChildren(...Object.entries(stages).sort((a,b) => Number(b[1])-Number(a[1])).map(([stage, count]) => element("div", "stage-card", `<span>${escapeHtml(stage)}</span><strong>${escapeHtml(count)}</strong><small>${total ? Math.round(Number(count)/total*100) : 0}%</small>`)));
  $("#crm-approvals").textContent = escapeHtml(crm.approvalsPending ?? 0);
  $("#crm-outbox").textContent = escapeHtml(crm.capiShadow ?? 0);
  $("#crm-conflicts").textContent = escapeHtml(crm.identityConflictsOpen ?? 0);
  $("#crm-unmatched").textContent = escapeHtml(crm.unmatchedLeads ?? 0);
}

function renderConversations(items) {
  const list = $("#conversations");
  if (!items.length) {
    list.replaceChildren(element("p", "empty", "Nenhuma conversa encontrada."));
    return;
  }
  list.replaceChildren(...items.map(item => {
    const phoneDigits = String(item.phoneE164 || "").replace(/\D/g, "");
    const detail = document.createElement("details");
    detail.className = "conversation";
    detail.innerHTML = `<summary><span class="person"><strong>${escapeHtml(item.name || "Contato")}</strong><span>${escapeHtml(item.phoneE164 || "Sem telefone")}</span></span><span class="lead-score">${escapeHtml(item.score ?? "—")}/10</span><span class="stage">${escapeHtml(item.stage || "Indeterminado")}</span></summary>
      <div class="conversation-body"><div class="insight"><h4>Insight</h4><p>${escapeHtml(item.insight || "Sem insight.")}</p></div><div class="suggestion"><h4>Mensagem sugerida</h4><p>${escapeHtml(item.suggestedMessage || "Sem sugestão.")}</p></div><div class="conversation-actions">${phoneDigits ? `<a href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener">Abrir conversa</a>` : ""}${item.analysisUrl ? `<a class="secondary" href="${safeUrl(item.analysisUrl)}" target="_blank" rel="noopener">Ver análise</a>` : ""}</div></div>`;
    return detail;
  }));
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  node.className = className;
  if (content.includes?.("<")) node.innerHTML = content; else node.textContent = content;
  return node;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function safeUrl(value) {
  try {
    const url = new URL(value, location.href);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "";
  } catch { return ""; }
}

$("#unlock-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = $("#gate-status");
  status.textContent = "Descriptografando dados…";
  try {
    const data = await loadEncrypted($("#passphrase").value);
    render(data);
    $("#passphrase").value = "";
    gate.hidden = true;
    dashboard.hidden = false;
    status.textContent = "";
  } catch (error) {
    status.textContent = error.name === "OperationError" ? "Senha incorreta." : error.message;
  }
});

$("#lock").addEventListener("click", () => {
  dashboardData = null;
  dashboard.hidden = true;
  gate.hidden = false;
  $("#passphrase").focus();
});

$("#search").addEventListener("input", event => {
  const term = event.target.value.toLocaleLowerCase("pt-BR").trim();
  const filtered = (dashboardData?.conversations || []).filter(item =>
    [item.name, item.phoneE164, item.insight, item.suggestedMessage, item.stage]
      .some(value => String(value || "").toLocaleLowerCase("pt-BR").includes(term)));
  renderConversations(filtered);
});
