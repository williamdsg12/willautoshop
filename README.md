# AutoLiveShop — Copiloto de lives · TikTok Shop

Extensão Chrome (Manifest V3) para automação e apoio de vendedores em **live shopping no TikTok Shop**.

## ✨ Funcionalidades

- **Painel em tempo real** — cronômetro de live, badge AO VIVO pulsando, métricas (GMV, vendas, ticket médio, espectadores) e feed de notificações de venda
- **Gestor de Live** — fixar produto automaticamente, mensagens automáticas no chat com emoji picker, oferta relâmpago automática
- **Respostas automáticas** — regras por palavra-chave, chamar pelo nome, alerta de carrinho no chat
- **Ajustes** — licença SaaS, guardião anti-ban, notificações Chrome configuráveis

## 🛠 Instalação (modo desenvolvedor)

1. Clone o repositório ou baixe o ZIP
2. Abra `chrome://extensions`
3. Ative **Modo do desenvolvedor**
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto
5. Clique no ícone na barra do Chrome → o Side Panel abre

## 📁 Estrutura

```
├── manifest.json       # Manifest V3
├── background.js       # Service Worker (timers, alarms, notificações)
├── content.js          # Content script para páginas do TikTok Shop
├── sidepanel.html      # UI do side panel
├── sidepanel.css       # Tema dark premium
├── sidepanel.js        # Lógica das 4 abas
└── icons/              # Ícones 16, 48, 128px
```

## 🚀 Fase 1 (MVP)

UI completa navegável com dados mockados, toggles salvos em `chrome.storage.local`, cronômetro funcional.

## 🔮 Fase 2 (em desenvolvimento)

- Integração real com DOM do TikTok Shop Live Studio (chat, produtos, métricas)
- Câmera virtual via vídeo do PC
- Backend de validação de licença

## 📄 Licença

Proprietário — AutoLiveShop © 2026
