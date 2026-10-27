const fs = require("fs");
const path = require("path");
const http = require("http");

const DIR = __dirname;
const CONFIG_PATH = path.join(DIR, "config.json");
const STATE_PATH = path.join(DIR, "estado.json");

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
const API = "https://api.condwell.com.br";
const PORTA = Number(config.porta || 3030);
const INTERVALO_MS = Math.max(1, Number(config.intervaloHoras || 11)) * 3600000;

let estado = { indice: -1, listas: {}, ultimaTroca: 0 };
try {
  Object.assign(estado, JSON.parse(fs.readFileSync(STATE_PATH, "utf8")));
} catch (e) {}

function salvarEstado() {
  fs.writeFileSync(STATE_PATH, JSON.stringify(estado, null, 2));
}

async function api(p, method, body) {
  const headers = {
    accept: "application/json",
    "x-device-id": String(config.device_id),
    "x-device-key": String(config.device_key)
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(API + p, {
    method: method || "GET",
    headers: headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const d = await res.json().catch(() => null);
  if (d && d.status === "ok") return d.dados !== undefined ? d.dados : d;
  throw new Error((d && d.mensagem) || "Erro " + res.status);
}

async function listarPlaylists() {
  return api("/v1/device/playlists", "GET");
}

async function criarLista(user) {
  const r = await api("/v1/device/code/resolve", "POST", { code: user.codigo });
  const serverUrl = r && r.dns && r.dns.server_url;
  if (!serverUrl) throw new Error("Codigo invalido: " + user.codigo);
  await api("/v1/device/playlists", "POST", {
    nome: String(user.usuario).slice(0, 20),
    username: user.usuario,
    password: user.senha,
    server_url: serverUrl,
    ativar: true
  });
  const lists = await listarPlaylists();
  const nova = lists.find((l) => l && l.username === user.usuario);
  if (nova) estado.listas[user.usuario] = nova.id;
  salvarEstado();
  return nova ? nova.id : null;
}

async function garantirListas() {
  for (const user of config.users) {
    if (!estado.listas[user.usuario]) {
      try {
        await criarLista(user);
        console.log("Lista criada para:", user.usuario);
      } catch (e) {
        console.error("Falha ao criar lista de", user.usuario + ":", e.message);
      }
    }
  }
}

async function trocarPara(indice) {
  const user = config.users[indice];
  if (!user) throw new Error("Indice invalido");
  let id = estado.listas[user.usuario];
  if (!id) id = await criarLista(user);
  if (!id) throw new Error("Lista nao encontrada para " + user.usuario);
  await api("/v1/device/playlists/" + id + "/activate", "POST");
  estado.indice = indice;
  estado.ultimaTroca = Date.now();
  salvarEstado();
  console.log("[" + new Date().toISOString() + "] Usuario ativo: " + user.usuario);
}

let rotacionando = false;
async function rotacionar() {
  if (rotacionando) return;
  rotacionando = true;
  try {
    await garantirListas();
    const proximo = (estado.indice + 1) % config.users.length;
    await trocarPara(proximo);
  } catch (e) {
    console.error("Falha na rotacao:", e.message);
  } finally {
    rotacionando = false;
  }
}

function proximaTroca() {
  return estado.ultimaTroca + INTERVALO_MS;
}

async function iniciar() {
  if (!config.users || !config.users.length) {
    console.error("config.json sem usuarios. Preencha e reinicie.");
    return;
  }
  const agora = Date.now();
  if (estado.ultimaTroca === 0) {
    console.log("Primeira execucao: preparando listas...");
    await garantirListas();
    await rotacionar();
  } else if (agora >= proximaTroca()) {
    console.log("Troca atrasada, rotacionando agora...");
    await rotacionar();
  } else {
    console.log("Proxima troca em", Math.round((proximaTroca() - agora) / 60000), "min");
  }
  setTimeout(function loop() {
    if (Date.now() >= proximaTroca()) rotacionar();
    setTimeout(loop, 60000);
  }, 60000);
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/status") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      usuarioAtual: config.users[estado.indice] ? config.users[estado.indice].usuario : null,
      ultimaTroca: estado.ultimaTroca,
      proximaTroca: proximaTroca(),
      indice: estado.indice,
      total: config.users.length
    }));
    return;
  }
  if (req.url === "/trocar-agora" && req.method === "POST") {
    rotacionar().then(() => {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORTA, () => {
  console.log("Painel em http://localhost:" + PORTA + "/status");
  iniciar();
});
