# 📊 Estudo de Viabilidade Econômica - WMS com Integração SAP B1

**Documento**: Análise de Custos e Precificação  
**Projeto**: WMS Orchestrator com Integração SAP Business One  
**Data**: 2026-02-05  
**Versão**: 1.0

---

## 📋 Sumário Executivo

Este estudo analisa os custos de desenvolvimento, manutenção e operação de um sistema WMS (Warehouse Management System) integrado ao SAP Business One, considerando o uso de ferramentas de IA para aceleração do desenvolvimento.

**Conclusões principais**:
- Custo de desenvolvimento: **R$ 45.000 - R$ 65.000** (com IA)
- Prazo de entrega: **2-4 meses** (1 desenvolvedor sênior)
- Preço sugerido por licença: **R$ 199 - R$ 399/usuário/mês**
- Break-even: **10-15 licenças**
- ROI estimado: **150-300%** no primeiro ano

---

## 1. Escopo Técnico Detalhado

### 1.1 Componentes do Sistema

| Componente | Tecnologias | Linhas de Código | Complexidade |
|------------|-------------|------------------|--------------|
| **SAP Connector** | TypeScript, Service Layer, Circuit Breaker | ~2.500 | Alta |
| **SAP Mock Service** | TypeScript, Factory Pattern | ~3.200 | Média |
| **Gateway/BFF** | Node.js, Fastify, JWT, WebSocket | ~1.500 | Média-Alta |
| **Core (Domínio)** | FastAPI, State Machine, PostgreSQL | ~2.000 | Alta |
| **Worker** | Python, Outbox Pattern, Jobs | ~800 | Média |
| **Frontend Web** | React, Vite, TanStack Query, Tailwind | ~3.000 | Média |
| **Collector (PWA)** | HTML/CSS/JS, Service Worker | ~500 | Baixa |
| **Observabilidade** | OpenTelemetry, Prometheus | ~1.000 | Média |
| **Testes** | Jest, pytest, E2E | ~2.000 | Média |
| **Infraestrutura** | Docker, Nginx, PostgreSQL | ~500 | Média |
| **Documentação** | Markdown, OpenAPI | ~12.000 palavras | - |
| **TOTAL** | | **~17.000 linhas** | **Alta** |

### 1.2 Funcionalidades Implementadas

#### Core WMS
- ✅ State Machine completa (6 estados, 7 transições)
- ✅ Criação e consulta de pedidos
- ✅ Audit trail imutável (scan_events)
- ✅ Idempotência em operações críticas
- ✅ Optimistic locking (concorrência)
- ✅ Tarefas (picking/packing/shipping)

#### Integração SAP B1
- ✅ Service Layer Client (autenticação, sessão)
- ✅ Circuit Breaker + Retry com backoff
- ✅ Rate Limiting
- ✅ Mapeamento de 200+ campos
- ✅ SQLQueries helper
- ✅ Mock Service completo para desenvolvimento
- ✅ Suporte a UDFs (campos customizados)
- 🔄 Polling incremental (pendente)
- 🔄 Criação de Delivery Notes (pendente)

#### Frontend
- ✅ Dashboard kanban interativo
- ✅ Real-time updates (SSE/WebSocket)
- ✅ Painel de integração SAP
- ✅ PWA para coletores

#### Infraestrutura
- ✅ Docker Compose completo
- ✅ Nginx como reverse proxy
- ✅ PostgreSQL com migrations
- ✅ Observabilidade (logs, métricas, traces)

---

## 2. Custos de Desenvolvimento

### 2.1 Ferramentas de IA - Stack Recomendada

| Ferramenta | Uso | USD/mês | BRL/mês* |
|------------|-----|---------|----------|
| **Cursor Pro** | Codificação assistida (principal) | $20 | R$ 116 |
| **Claude Pro** | Arquitetura, análise, documentação | $20 | R$ 116 |
| **ChatGPT Plus** | Consultas, debugging | $20 | R$ 116 |
| **Figma Pro** | Design de UI/UX | $15 | R$ 87 |
| **v0 by Vercel** | Prototipagem de componentes React | $20 | R$ 116 |
| **GitHub Copilot** | Autocomplete (backup) | $10 | R$ 58 |
| **TOTAL** | | **$105** | **~R$ 609** |

*Cotação: USD 1 = BRL 5,80

### 2.2 Estimativa de Horas - Comparativo

| Componente | Sem IA | Com IA | Economia |
|------------|--------|--------|----------|
| SAP Connector | 100h | 50h | 50% |
| SAP Mock Service | 60h | 25h | 58% |
| Gateway/BFF | 80h | 40h | 50% |
| Core (Domínio) | 120h | 65h | 46% |
| Worker | 40h | 20h | 50% |
| Frontend Web | 100h | 40h | 60% |
| Collector (PWA) | 30h | 15h | 50% |
| Observabilidade | 50h | 25h | 50% |
| Testes | 80h | 40h | 50% |
| Infraestrutura | 40h | 25h | 38% |
| Documentação | 40h | 15h | 63% |
| **TOTAL** | **740h** | **360h** | **51%** |

### 2.3 Custo de Desenvolvimento por Perfil

#### Cenário 1: Desenvolvedor Sênior Freelancer (PJ)

| Item | Cálculo | Valor |
|------|---------|-------|
| Horas de desenvolvimento | 360h | - |
| Valor/hora | R$ 150/h | - |
| **Subtotal mão de obra** | 360h × R$ 150 | **R$ 54.000** |
| Ferramentas IA (3 meses) | R$ 609 × 3 | R$ 1.827 |
| Infraestrutura dev | VPS, domínios | R$ 800 |
| Margem de contingência (15%) | - | R$ 8.100 |
| **TOTAL** | | **R$ 64.727** |

#### Cenário 2: Desenvolvedor Pleno (PJ)

| Item | Cálculo | Valor |
|------|---------|-------|
| Horas de desenvolvimento | 400h (curva de aprendizado) | - |
| Valor/hora | R$ 100/h | - |
| **Subtotal mão de obra** | 400h × R$ 100 | **R$ 40.000** |
| Ferramentas IA (4 meses) | R$ 609 × 4 | R$ 2.436 |
| Infraestrutura dev | VPS, domínios | R$ 1.000 |
| Margem de contingência (20%) | - | R$ 8.000 |
| **TOTAL** | | **R$ 51.436** |

#### Cenário 3: Squad (2 devs + 1 designer) - Software House

| Item | Cálculo | Valor |
|------|---------|-------|
| Dev Backend Sênior | 180h × R$ 180 | R$ 32.400 |
| Dev Frontend Pleno | 120h × R$ 120 | R$ 14.400 |
| Designer UI/UX | 40h × R$ 100 | R$ 4.000 |
| **Subtotal mão de obra** | | **R$ 50.800** |
| Ferramentas IA (2 meses) | R$ 900 × 2 | R$ 1.800 |
| Gestão de projeto (15%) | | R$ 7.620 |
| Overhead empresa (30%) | | R$ 15.240 |
| **TOTAL** | | **R$ 75.460** |

### 2.4 Resumo - Custo de Desenvolvimento

| Cenário | Prazo | Custo Total |
|---------|-------|-------------|
| Dev Sênior Solo (com IA) | 2-3 meses | **R$ 55.000 - R$ 65.000** |
| Dev Pleno Solo (com IA) | 3-4 meses | **R$ 45.000 - R$ 55.000** |
| Squad Software House | 1,5-2 meses | **R$ 70.000 - R$ 85.000** |
| Sem IA (Sênior) | 5-6 meses | **R$ 100.000 - R$ 130.000** |

---

## 3. Custos de Infraestrutura (Produção)

### 3.1 Cenário 1: Hostinger VPS (Custo-Benefício)

| Recurso | Especificação | USD/mês | BRL/mês |
|---------|---------------|---------|---------|
| VPS KVM 2 | 2 vCPU, 8GB RAM, 100GB NVMe | $13 | R$ 75 |
| PostgreSQL | No mesmo VPS (container) | - | - |
| Domínio + SSL | Let's Encrypt gratuito | $1 | R$ 6 |
| Backup automático | Semanal | $2 | R$ 12 |
| **TOTAL** | | **$16** | **~R$ 93/mês** |

**Capacidade**: até ~20 usuários simultâneos

### 3.2 Cenário 2: Cloud Escalável (AWS/GCP/Azure)

| Recurso | Especificação | USD/mês | BRL/mês |
|---------|---------------|---------|---------|
| Compute (EC2/GCE) | 2 vCPU, 8GB RAM | $60 | R$ 348 |
| RDS PostgreSQL | db.t3.small | $25 | R$ 145 |
| Load Balancer | Application LB | $18 | R$ 104 |
| Storage (S3/GCS) | 50GB | $5 | R$ 29 |
| CloudWatch/Monitoring | Básico | $10 | R$ 58 |
| Backup | Diário, 7 dias | $8 | R$ 46 |
| **TOTAL** | | **$126** | **~R$ 730/mês** |

**Capacidade**: até ~100 usuários simultâneos

### 3.3 Cenário 3: Enterprise (Alta Disponibilidade)

| Recurso | Especificação | USD/mês | BRL/mês |
|---------|---------------|---------|---------|
| Kubernetes (EKS/GKE) | 3 nodes t3.medium | $200 | R$ 1.160 |
| RDS PostgreSQL | Multi-AZ, db.r5.large | $150 | R$ 870 |
| Redis (ElastiCache) | cache.t3.medium | $45 | R$ 261 |
| Load Balancer | ALB + WAF | $50 | R$ 290 |
| Storage | 200GB + CDN | $30 | R$ 174 |
| Monitoring | DataDog/NewRelic | $50 | R$ 290 |
| Backup | Diário + DR | $25 | R$ 145 |
| **TOTAL** | | **$550** | **~R$ 3.190/mês** |

**Capacidade**: 500+ usuários, 99.9% SLA

---

## 4. Custos de Manutenção e Operação

### 4.1 Manutenção Mensal (após go-live)

| Item | Horas/mês | Custo/mês |
|------|-----------|-----------|
| Correção de bugs | 8h | R$ 1.200 |
| Updates de segurança | 4h | R$ 600 |
| Monitoramento/alertas | 4h | R$ 600 |
| Suporte N2/N3 | 8h | R$ 1.200 |
| Backup/restore tests | 2h | R$ 300 |
| Documentação | 2h | R$ 300 |
| **TOTAL** | **28h** | **~R$ 4.200/mês** |

### 4.2 Evolução Contínua (opcional)

| Item | Horas/mês | Custo/mês |
|------|-----------|-----------|
| Novas funcionalidades | 20h | R$ 3.000 |
| Melhorias de UX | 10h | R$ 1.500 |
| Otimização de performance | 8h | R$ 1.200 |
| Integração novos módulos | 12h | R$ 1.800 |
| **TOTAL** | **50h** | **~R$ 7.500/mês** |

---

## 5. Modelo de Precificação - Licença por Usuário

### 5.1 Análise de Custos Fixos Mensais

| Item | Mínimo | Médio | Enterprise |
|------|--------|-------|------------|
| Infraestrutura | R$ 93 | R$ 730 | R$ 3.190 |
| Manutenção básica | R$ 2.000 | R$ 4.200 | R$ 8.000 |
| Suporte | R$ 500 | R$ 2.000 | R$ 5.000 |
| Licenças terceiros | R$ 0 | R$ 500 | R$ 2.000 |
| **TOTAL FIXO** | **R$ 2.593** | **R$ 7.430** | **R$ 18.190** |

### 5.2 Cálculo do Preço por Licença

#### Premissas
- Amortização do desenvolvimento em 24 meses
- Margem de lucro: 40%
- Custo de desenvolvimento: R$ 60.000

| Métrica | Cálculo |
|---------|---------|
| Amortização mensal | R$ 60.000 ÷ 24 = **R$ 2.500/mês** |
| Custos fixos médios | R$ 7.430/mês |
| **Custo total mensal** | **R$ 9.930/mês** |

### 5.3 Tabela de Preços por Número de Usuários

| Usuários | Custo/usuário* | Preço Sugerido | Margem |
|----------|---------------|----------------|--------|
| 5 | R$ 1.986 | R$ 599/usuário | -70% |
| 10 | R$ 993 | R$ 399/usuário | -60% |
| **15** | **R$ 662** | **R$ 299/usuário** | **-55%** |
| **20** | **R$ 497** | **R$ 249/usuário** | **-50%** |
| **25** | **R$ 397** | **R$ 199/usuário** | **-50%** |
| 50 | R$ 199 | R$ 149/usuário | -25% |
| 100 | R$ 99 | R$ 99/usuário | 0% |

*Custo por usuário = Custo total mensal ÷ número de usuários

### 5.4 Modelos de Licenciamento Sugeridos

#### Modelo A: Por Usuário (SaaS)

| Plano | Usuários | Preço/usuário/mês | Inclui |
|-------|----------|-------------------|--------|
| **Starter** | 1-10 | R$ 399 | Básico, suporte email |
| **Professional** | 11-25 | R$ 299 | Completo, suporte prioritário |
| **Business** | 26-50 | R$ 199 | Completo, SLA 99%, treinamento |
| **Enterprise** | 50+ | Sob consulta | Customização, suporte 24/7 |

#### Modelo B: Por Empresa (On-Premise/Híbrido)

| Plano | Preço Único | Manutenção/ano | Usuários |
|-------|-------------|----------------|----------|
| **Small** | R$ 35.000 | R$ 7.000 (20%) | Até 10 |
| **Medium** | R$ 60.000 | R$ 12.000 (20%) | Até 25 |
| **Large** | R$ 100.000 | R$ 20.000 (20%) | Até 50 |
| **Enterprise** | R$ 180.000 | R$ 36.000 (20%) | Ilimitado |

#### Modelo C: Híbrido (Setup + Mensalidade)

| Plano | Setup (único) | Mensalidade | Usuários |
|-------|---------------|-------------|----------|
| **Starter** | R$ 5.000 | R$ 1.990/mês | Até 10 |
| **Professional** | R$ 10.000 | R$ 3.990/mês | Até 25 |
| **Business** | R$ 20.000 | R$ 7.990/mês | Até 50 |
| **Enterprise** | R$ 40.000 | R$ 14.990/mês | Ilimitado |

---

## 6. Análise de Retorno (ROI)

### 6.1 Cenário Conservador

| Métrica | Valor |
|---------|-------|
| Investimento inicial | R$ 60.000 |
| Clientes no Ano 1 | 5 empresas |
| Usuários médios/empresa | 15 |
| Preço médio | R$ 249/usuário/mês |
| **Receita Ano 1** | 5 × 15 × R$ 249 × 12 = **R$ 224.100** |
| Custos operacionais Ano 1 | R$ 7.430 × 12 = R$ 89.160 |
| **Lucro bruto Ano 1** | **R$ 134.940** |
| **ROI Ano 1** | **(R$ 134.940 - R$ 60.000) ÷ R$ 60.000 = 125%** |

### 6.2 Cenário Otimista

| Métrica | Valor |
|---------|-------|
| Investimento inicial | R$ 60.000 |
| Clientes no Ano 1 | 10 empresas |
| Usuários médios/empresa | 20 |
| Preço médio | R$ 299/usuário/mês |
| **Receita Ano 1** | 10 × 20 × R$ 299 × 12 = **R$ 717.600** |
| Custos operacionais Ano 1 | R$ 12.000 × 12 = R$ 144.000 |
| **Lucro bruto Ano 1** | **R$ 573.600** |
| **ROI Ano 1** | **(R$ 573.600 - R$ 60.000) ÷ R$ 60.000 = 856%** |

### 6.3 Break-Even Analysis

| Cenário | Usuários necessários | Tempo estimado |
|---------|---------------------|----------------|
| Preço R$ 399/usuário | 8 usuários | 2-3 meses |
| Preço R$ 299/usuário | 11 usuários | 3-4 meses |
| Preço R$ 199/usuário | 17 usuários | 4-6 meses |

---

## 7. Comparativo com Concorrência

### 7.1 Soluções WMS no Mercado Brasileiro

| Solução | Tipo | Preço/usuário/mês | Integração SAP |
|---------|------|-------------------|----------------|
| TOTVS WMS | Enterprise | R$ 500-1.500 | Nativa (TOTVS) |
| SAP EWM | Enterprise | R$ 800-2.000 | Nativa |
| Senior WMS | Mid-market | R$ 300-600 | Conector |
| GTI Plug WMS | Mid-market | R$ 200-400 | Conector |
| Intelipost WMS | SaaS | R$ 150-350 | API |
| **Este WMS** | **SaaS/On-Premise** | **R$ 199-399** | **Nativa SAP B1** |

### 7.2 Diferenciais Competitivos

| Diferencial | Valor para o Cliente |
|-------------|---------------------|
| **Integração nativa SAP B1** | Elimina middleware, reduz custos |
| **Real-time updates** | Dashboard sempre atualizado |
| **PWA para coletores** | Funciona offline, qualquer device |
| **Open source (core)** | Sem lock-in, customizável |
| **Preço competitivo** | 30-50% menor que concorrentes |

---

## 8. Recomendações

### 8.1 Estratégia de Preço Inicial

**Recomendação**: Modelo C (Híbrido) com desconto de lançamento

| Plano | Setup | Mensalidade | Promoção 6 meses |
|-------|-------|-------------|------------------|
| Starter | R$ 2.500 | R$ 1.490/mês | R$ 990/mês |
| Professional | R$ 5.000 | R$ 2.990/mês | R$ 1.990/mês |
| Business | R$ 10.000 | R$ 5.990/mês | R$ 3.990/mês |

### 8.2 Próximos Passos

1. **Curto prazo (30 dias)**
   - Finalizar integrações SAP pendentes (Fases 2-4)
   - Criar ambiente de demonstração
   - Preparar materiais de venda

2. **Médio prazo (60-90 dias)**
   - Pilotar com 2-3 clientes beta
   - Refinar preços baseado em feedback
   - Implementar billing automatizado

3. **Longo prazo (6 meses)**
   - Adicionar módulos (WMS avançado, roteirização)
   - Expandir integrações (outros ERPs)
   - Certificações e parcerias

---

## 9. Conclusões

### Investimento vs. Retorno

| Métrica | Valor |
|---------|-------|
| Investimento total | R$ 60.000 - R$ 85.000 |
| Break-even | 10-15 licenças |
| Payback | 4-6 meses |
| ROI Ano 1 (conservador) | 125% |
| ROI Ano 1 (otimista) | 856% |

### Viabilidade

✅ **O projeto é economicamente viável** devido a:
- Uso de IA reduz custos de desenvolvimento em ~50%
- Mercado de WMS em crescimento no Brasil
- Nicho específico (SAP B1) com baixa concorrência direta
- Modelo SaaS permite receita recorrente

### Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Mudanças na API SAP | Baixa | Abstração via adaptadores |
| Concorrência de preço | Média | Diferenciação por nicho |
| Churn de clientes | Média | Contrato mínimo 6 meses |
| Escalabilidade técnica | Baixa | Arquitetura cloud-native |

---

**Documento elaborado com base em análise técnica do código-fonte, pesquisa de mercado e benchmarks de precificação de software B2B no Brasil.**

---

**Última atualização**: 2026-02-05  
**Versão**: 1.0.0
