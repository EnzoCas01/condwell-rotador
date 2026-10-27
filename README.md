# Condwell Rotador

Troca automaticamente de usuário no player Condwell (http://player.condwell.com.br).

- **rotador.js** — script da VPS: a cada 11h (configurável) ativa o próximo usuário da lista pela API oficial.
- **extensao/** — extensão do Chrome/Edge: painel de troca manual + sincroniza com a VPS e recarrega o player sozinho.

## 1. Configurar na VPS

Requisitos: Node.js 18+

```bash
git clone <URL_DO_REPO>
cd condwell-rotador/vps
nano config.json   # preencha device_id, device_key e os usuários
node rotador.js
```

Para rodar pra sempre:

```bash
npm i -g pm2
pm2 start rotador.js --name condwell-rotador
pm2 save
```

### config.json

```json
{
  "device_id": "COPIE_DA_EXTENSAO",
  "device_key": "COPIE_DA_EXTENSAO",
  "porta": 3030,
  "intervaloHoras": 11,
  "users": [
    { "codigo": "CODIGO1", "usuario": "usuario1", "senha": "senha1" },
    { "codigo": "CODIGO2", "usuario": "usuario2", "senha": "senha2" }
  ]
}
```

Para pegar `device_id` e `device_key`: abra o player no navegador, clique em **Trocar usuário**, seção **Sessão do aparelho**, botão **Copiar**.

### Endpoints

- `GET /status` — usuário ativo, última troca, próxima troca
- `POST /trocar-agora` — força a troca para o próximo usuário

## 2. Extensão no navegador

1. Chrome/Edge → `chrome://extensions`
2. Ative o **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione a pasta `extensao/`
4. No player, abra **Trocar usuário** → **Troca automática (VPS)** → digite `http://IP_DA_VPS:3030` → **Salvar VPS**

A extensão verifica a VPS a cada 1 minuto e recarrega o player quando o usuário mudar.

Na TV, a troca vale para a conta do aparelho: basta reiniciar o app para carregar o novo usuário.

## Atenção

- Não commite o `config.json` com dados reais (o `estado.json` já está no `.gitignore`).
