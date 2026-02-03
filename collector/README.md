# Coletor WMS (PWA)

Aplicativo PWA simples para operador de coleta/expedicao, com fluxo rapido, botoes grandes e modo offline com fila.

## Como usar
- Abra `collector/index.html` em um navegador moderno (Chrome/Edge).
- Para testes completos de PWA/offline, sirva a pasta `collector/` com um servidor estatico.

## Funcionalidades
- Fila de tarefas (picking, packing, expedicao)
- Tela de picking: bipar endereco, SKU, quantidade, falta
- Packing double check
- Expedicao: bipar volume/pallet
- Modo offline com fila local e sincronizacao manual
- Scanner via camera (BarcodeDetector) e compatibilidade com scanner BT (entrada teclado)

## Notas
- O modo camera depende do suporte a `BarcodeDetector`.
- A sincronizacao e simulada (limpa a fila).
