# ⚡ EXECUTE AGORA - Guia Rápido

## 🎯 Objetivo

Colocar o WMS funcionando em **localhost** (5 min) e depois em **VPS** (30-60 min).

---

## 📍 LOCALHOST (AGORA - 5 minutos)

### Passo 1: Verificar Requisitos

```powershell
node --version
# Deve ser >= 18.0.0
```

Se não tiver Node.js, baixe em: https://nodejs.org

### Passo 2: Iniciar API

**Abra PowerShell nesta pasta e execute:**

```powershell
.\START-API.ps1
```

**Aguarde ver:**
```
Core API online em :8000
```

✅ **API está rodando!**

### Passo 3: Testar (Opcional mas Recomendado)

**Em OUTRO terminal PowerShell:**

```powershell
.\test-dashboard.ps1
```

Deve mostrar ✅ em todos os testes.

### Passo 4: Usar do Frontend

Seu frontend já pode fazer requisições:

```javascript
// Exemplo
fetch('http://localhost:8000/api/v1/dashboard/metrics', {
  headers: {
    'X-User-Id': 'dev-user',
    'X-User-Role': 'SUPERVISOR',
    'X-User-Name': 'Usuário Dev'
  }
})
```

---

## 🎉 Pronto! Localhost Funcionando

Endpoints disponíveis:
- `http://localhost:8000/health` - Health check
- `http://localhost:8000/api/v1/dashboard/metrics` - Métricas
- `http://localhost:8000/api/v1/orders` - Pedidos
- `http://localhost:8000/api/v1/catalog/items` - Catálogo
- E mais 35+ endpoints!

---

## 🌐 VPS (Depois - 30-60 minutos)

### Quando Estiver Pronto para VPS

1. **Leia o guia completo:**
   ```
   DEPLOY-LOCALHOST-VPS.md
   ```

2. **Execute passo a passo:**
   - Preparar VPS (Ubuntu, Node.js, PM2)
   - Transferir código
   - Configurar Nginx
   - Configurar SSL
   - Deploy!

3. **Use o script automático:**
   ```bash
   bash deploy-vps.sh
   ```

---

## 📚 Documentação Completa

Tudo que você precisa saber está em:

1. **`README-IMPORTANTE.md`** ⭐ - Início rápido
2. **`PROXIMOS-PASSOS-EXECUTAR.md`** - Plano detalhado
3. **`DEPLOY-LOCALHOST-VPS.md`** - Guia completo localhost + VPS
4. **`RESUMO-EXECUTIVO.md`** - Visão geral do projeto
5. **`CORS-FIX.md`** - Se tiver problemas de CORS
6. **`QUICK-FIX.md`** - Soluções rápidas

---

## 🆘 Problemas?

### "Porta 8000 em uso"

```powershell
netstat -ano | findstr :8000
taskkill /F /PID <número-do-PID>
.\START-API.ps1
```

### "Cannot find module"

```powershell
cd api
npm install
cd ..
.\START-API.ps1
```

### "Frontend não conecta"

1. API está rodando? (`curl http://localhost:8000/health`)
2. Headers corretos? (X-User-Id, X-User-Role, X-User-Name)
3. CORS ativo? (sim, já está configurado)
4. Limpe cache do navegador (Ctrl+Shift+Del)

---

## ✅ Checklist

### Localhost
- [ ] Node.js >= 18.0.0 instalado
- [ ] Executei `.\START-API.ps1`
- [ ] Vi "Core API online em :8000"
- [ ] Testei com `.\test-dashboard.ps1`
- [ ] Frontend está conectando

### VPS (Depois)
- [ ] Li `DEPLOY-LOCALHOST-VPS.md`
- [ ] VPS com Ubuntu pronto
- [ ] Segui o passo a passo
- [ ] Executei `deploy-vps.sh`
- [ ] Health checks passando
- [ ] SSL configurado

---

## 🎯 Status Atual

```
✅ API REST - 40+ endpoints prontos
✅ JWT Auth - Implementado
✅ RBAC - 4 roles configurados
✅ CORS - Configurado e testado
✅ Gateway - SSE/WebSocket pronto
✅ SAP Integration - Estrutura pronta
✅ Documentação - Completa
✅ Scripts - Prontos para uso

🚀 EXECUTE AGORA: .\START-API.ps1
```

---

**Próximo Passo:** Execute `.\START-API.ps1` AGORA! ⚡

**Tempo estimado:** 5 minutos para localhost, 30-60 minutos para VPS

**Última atualização:** 2026-02-03
