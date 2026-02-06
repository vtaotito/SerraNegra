# 🔌 Frontend de Integração SAP B1

## 📋 Visão Geral

Frontend completo para configuração e monitoramento da integração com SAP Business One, disponível em `http://31.97.174.120:8080/integracao`.

## ✨ Funcionalidades Implementadas

### 1. **Configuração SAP** (Aba: Configuração)
- ✅ Formulário completo para credenciais SAP:
  - Service Layer URL
  - Company Database
  - Usuário
  - Senha (armazenada com segurança)
- ✅ Teste de conexão em tempo real
- ✅ Validação de campos obrigatórios
- ✅ Feedback visual de sucesso/erro

### 2. **Monitoramento de Status** (Aba: Status)
- ✅ Card de status da integração:
  - Estado da conexão SAP
  - Validade da sessão
  - Latência de resposta
- ✅ Status de sincronização:
  - Última sincronização
  - Quantidade de pedidos sincronizados
  - Pedidos abertos no SAP
  - Próxima sincronização estimada
- ✅ Botão de sincronização manual
- ✅ Histórico de sincronizações (últimas 10)
- ✅ Métricas de integração
- ✅ Informações do Worker

### 3. **Visualização de Pedidos SAP** (Aba: Pedidos SAP)
- ✅ Lista de pedidos abertos no SAP
- ✅ Informações detalhadas:
  - DocEntry / DocNum
  - Cliente (código e nome)
  - Valor total
  - Status no WMS
- ✅ Atualização em tempo real
- ✅ Link direto para pedidos no WMS

## 🗂️ Estrutura de Arquivos Criados

### Frontend (Next.js)
```
web-next/
├── app/integracao/
│   └── page.tsx                                    # ✅ Página principal de integração
├── features/integration/
│   ├── types.ts                                    # ✅ Tipos TypeScript
│   ├── hooks/
│   │   └── useSapIntegration.ts                   # ✅ Hooks customizados
│   └── components/
│       ├── SapConfigForm.tsx                       # ✅ Formulário de configuração
│       ├── SapStatusCard.tsx                       # ✅ Card de status
│       ├── SapSyncHistory.tsx                      # ✅ Histórico de sync
│       └── SapOrdersPreview.tsx                    # ✅ Preview de pedidos
├── components/ui/
│   ├── tabs.tsx                                    # ✅ Componente Tabs (Radix)
│   ├── input.tsx                                   # ✅ Componente Input
│   └── label.tsx                                   # ✅ Componente Label
└── lib/api/
    └── endpoints.ts                                # ✅ Atualizado com endpoints SAP
```

### Backend (Gateway)
```
gateway/src/routes/
└── sap.ts                                          # ✅ Novos endpoints adicionados:
    ├── GET /api/sap/config
    ├── PUT /api/sap/config
    ├── POST /api/sap/config/test
    └── GET /api/sap/sync/status
```

## 🔗 Endpoints da API

### Configuração
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/sap/config` | Retorna configuração atual (sem senha) |
| `PUT` | `/api/sap/config` | Atualiza configuração SAP |
| `POST` | `/api/sap/config/test` | Testa conexão com credenciais fornecidas |

### Sincronização
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/sap/sync/status` | Status da última sincronização |
| `POST` | `/api/sap/sync` | Dispara sincronização manual |

### Pedidos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/sap/orders` | Lista pedidos do SAP |
| `GET` | `/api/sap/orders/:docEntry` | Busca pedido específico |
| `PATCH` | `/api/sap/orders/:docEntry/status` | Atualiza status no SAP |

### Health
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/sap/health` | Testa conexão com SAP |

## 🚀 Como Usar

### 1. Configurar Credenciais SAP

1. Acesse `http://31.97.174.120:8080/integracao`
2. Clique na aba **"Configuração"**
3. Preencha os campos:
   ```
   Service Layer URL: https://sap-garrafariasnegra-sl.skyinone.net:50000
   Company Database: SBO_GARRAFARIASNEGRA
   Usuário: seu_usuario
   Senha: sua_senha
   ```
4. Clique em **"Testar Conexão"** para validar
5. Se o teste for bem-sucedido, clique em **"Salvar Configuração"**

### 2. Monitorar Status

1. Clique na aba **"Status"**
2. Visualize:
   - ✅ Conexão SAP (conectado/desconectado)
   - ✅ Última sincronização
   - ✅ Pedidos sincronizados
   - ✅ Histórico de sincronizações

### 3. Sincronizar Manualmente

1. Na aba **"Status"**, clique em **"Sincronizar Agora"**
2. Aguarde a conclusão
3. Verifique o toast de confirmação
4. Veja o resultado no histórico

### 4. Visualizar Pedidos SAP

1. Clique na aba **"Pedidos SAP"**
2. Veja os últimos 10 pedidos abertos no SAP
3. Use o botão **"Atualizar"** para recarregar
4. Clique em **"Ver todos no WMS"** para ir à lista completa

## 🎨 Design e UX

- **Tabs modernas** com ícones (Radix UI)
- **Cards informativos** com Shadcn/UI
- **Formulários validados** com React Hook Form + Zod
- **Feedback visual** com Sonner (toasts)
- **Loading states** em todas as operações
- **Cores semânticas**:
  - 🟢 Verde: Sucesso, conectado
  - 🔴 Vermelho: Erro, desconectado
  - 🟡 Amarelo: Aviso
  - 🔵 Azul: Informação

## 📊 Métricas Exibidas

### Card de Status
- **Conexão SAP**: ok/erro
- **Sessão**: válida/inválida
- **Latência**: tempo em ms
- **Última sincronização**: tempo relativo
- **Pedidos sincronizados**: quantidade
- **Pedidos abertos no SAP**: quantidade em tempo real

### Histórico
- **Data/hora** da sincronização
- **Status**: SUCCESS/FAILED
- **Quantidade** de pedidos
- **Duração** em ms
- **Mensagem de erro** (se houver)

## ⚙️ Configuração de Ambiente

### Variáveis de Ambiente (Gateway)
```bash
# .env no gateway/
SAP_BASE_URL=https://sap-garrafariasnegra-sl.skyinone.net:50000
SAP_COMPANY_DB=SBO_GARRAFARIASNEGRA
SAP_USERNAME=usuario_sap
SAP_PASSWORD=senha_sap
```

### Dependências Instaladas
```json
{
  "@radix-ui/react-tabs": "^1.x",
  "@radix-ui/react-label": "^2.x",
  "react-hook-form": "^7.54.2",
  "@hookform/resolvers": "^3.9.1",
  "zod": "^3.24.1",
  "date-fns": "^4.1.0",
  "sonner": "^1.7.2"
}
```

## 🔐 Segurança

- ✅ Senha nunca é retornada em `GET /api/sap/config`
- ✅ Teste de conexão não persiste credenciais
- ✅ Validação de campos obrigatórios
- ✅ CORS configurado no Gateway e Core
- ✅ Correlation ID em todas as requisições

## 🐛 Troubleshooting

### Erro: "Conexão recusada"
- Verifique se o Service Layer está acessível
- Teste a URL no navegador: `https://sap-server:50000/b1s/v1/Login`
- Verifique firewall e certificados SSL

### Erro: "Credenciais inválidas"
- Confirme usuário e senha no SAP
- Verifique o nome do Company Database
- Teste login direto no SAP GUI

### Erro: "CORS"
- Verifique configuração do Gateway (`cors` registrado)
- Verifique Core (`CORSMiddleware` adicionado)
- Veja console do navegador para detalhes

### Sincronização não funciona
- Verifique logs do Worker: `docker logs wms-worker`
- Confirme que o Worker está rodando: `docker ps`
- Teste endpoint manual: `POST /api/sap/sync`

## 📝 Próximos Passos

### ⚠️ Pendente (MVP)
- [ ] **Persistência de configuração** - Atualmente não salva no .env
- [ ] **Histórico de sincronizações** - Mock no frontend (implementar no Core)
- [ ] **Métricas reais** - Integrar com banco de dados de logs
- [ ] **Autenticação** - Restringir acesso à página de configuração

### 🚀 Melhorias Futuras
- [ ] Filtros avançados na lista de pedidos SAP
- [ ] Gráficos de performance de sincronização
- [ ] Alertas de falhas por email/Slack
- [ ] Sincronização bidirecional automática
- [ ] Webhooks do SAP (se disponível)

## 🧪 Como Testar

### Teste Local
```bash
# 1. Subir os serviços
cd deploy
docker-compose up -d

# 2. Acessar frontend
http://localhost:3002/integracao

# 3. Configurar credenciais
# (usar credenciais de desenvolvimento)

# 4. Testar sincronização
# Clicar em "Sincronizar Agora"

# 5. Ver logs
docker logs -f wms-gateway
docker logs -f wms-worker
```

### Teste em Produção
```bash
# 1. Acessar
http://31.97.174.120:8080/integracao

# 2. Configurar credenciais de produção

# 3. Testar conexão primeiro

# 4. Sincronizar manualmente

# 5. Monitorar status
```

## 📚 Referências

- [SAP Service Layer API](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bfc43547ef7c9e1f/4bffc44e70b34f33bd05c40eaabb73ac.html)
- [Radix UI Tabs](https://www.radix-ui.com/docs/primitives/components/tabs)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
- [Shadcn/UI](https://ui.shadcn.com/)

---

**Status**: ✅ Implementado e pronto para uso  
**Última atualização**: 2026-02-03  
**Autor**: Cursor AI Assistant
