-- ============================================================================
-- Script SQL para criar UDFs (User Defined Fields) no SAP Business One
-- Tabela: Orders (ORDR)
-- ============================================================================
-- IMPORTANTE: Execute este script no SAP B1 Administration Tool
-- ou via SQL Server Management Studio conectado ao banco do SAP
-- ============================================================================

-- UDF: Status WMS
IF NOT EXISTS (SELECT 1 FROM CUFD WHERE TableID = 'ORDR' AND AliasID = 'WMS_STATUS')
BEGIN
    INSERT INTO CUFD (
        TableID, FieldID, AliasID, Descr, 
        TypeID, SizeID, EditSize, Dflt, NotNull, 
        IndexID, RTable, RField, FldValue, FldDate
    )
    VALUES (
        'ORDR',                    -- TableID: Tabela Orders
        (SELECT ISNULL(MAX(FieldID), 0) + 1 FROM CUFD WHERE TableID = 'ORDR'), 
        'WMS_STATUS',              -- AliasID: Nome do campo (prefixo U_ será adicionado)
        'Status WMS',              -- Descrição
        'A',                       -- TypeID: A = Alphanumeric (String)
        50,                        -- Tamanho máximo
        50,                        -- EditSize
        '',                        -- Valor padrão
        'N',                       -- NotNull: N = Não obrigatório
        NULL,                      -- IndexID
        NULL,                      -- RTable
        NULL,                      -- RField
        NULL,                      -- FldValue
        NULL                       -- FldDate
    );
    PRINT 'UDF U_WMS_STATUS criado com sucesso';
END
ELSE
BEGIN
    PRINT 'UDF U_WMS_STATUS já existe';
END
GO

-- UDF: Order ID do WMS
IF NOT EXISTS (SELECT 1 FROM CUFD WHERE TableID = 'ORDR' AND AliasID = 'WMS_ORDERID')
BEGIN
    INSERT INTO CUFD (
        TableID, FieldID, AliasID, Descr, 
        TypeID, SizeID, EditSize, Dflt, NotNull, 
        IndexID, RTable, RField, FldValue, FldDate
    )
    VALUES (
        'ORDR',
        (SELECT ISNULL(MAX(FieldID), 0) + 1 FROM CUFD WHERE TableID = 'ORDR'), 
        'WMS_ORDERID',
        'ID Pedido WMS',
        'A',
        50,
        50,
        '',
        'N',
        NULL, NULL, NULL, NULL, NULL
    );
    PRINT 'UDF U_WMS_ORDERID criado com sucesso';
END
ELSE
BEGIN
    PRINT 'UDF U_WMS_ORDERID já existe';
END
GO

-- UDF: Último evento aplicado
IF NOT EXISTS (SELECT 1 FROM CUFD WHERE TableID = 'ORDR' AND AliasID = 'WMS_LAST_EVENT')
BEGIN
    INSERT INTO CUFD (
        TableID, FieldID, AliasID, Descr, 
        TypeID, SizeID, EditSize, Dflt, NotNull, 
        IndexID, RTable, RField, FldValue, FldDate
    )
    VALUES (
        'ORDR',
        (SELECT ISNULL(MAX(FieldID), 0) + 1 FROM CUFD WHERE TableID = 'ORDR'), 
        'WMS_LAST_EVENT',
        'Último Evento WMS',
        'A',
        50,
        50,
        '',
        'N',
        NULL, NULL, NULL, NULL, NULL
    );
    PRINT 'UDF U_WMS_LAST_EVENT criado com sucesso';
END
ELSE
BEGIN
    PRINT 'UDF U_WMS_LAST_EVENT já existe';
END
GO

-- UDF: Timestamp da última atualização
IF NOT EXISTS (SELECT 1 FROM CUFD WHERE TableID = 'ORDR' AND AliasID = 'WMS_LAST_TS')
BEGIN
    INSERT INTO CUFD (
        TableID, FieldID, AliasID, Descr, 
        TypeID, SizeID, EditSize, Dflt, NotNull, 
        IndexID, RTable, RField, FldValue, FldDate
    )
    VALUES (
        'ORDR',
        (SELECT ISNULL(MAX(FieldID), 0) + 1 FROM CUFD WHERE TableID = 'ORDR'), 
        'WMS_LAST_TS',
        'Última Atualização WMS',
        'A',                       -- String para timestamp ISO
        30,
        30,
        '',
        'N',
        NULL, NULL, NULL, NULL, NULL
    );
    PRINT 'UDF U_WMS_LAST_TS criado com sucesso';
END
ELSE
BEGIN
    PRINT 'UDF U_WMS_LAST_TS já existe';
END
GO

-- UDF: Correlation ID para rastreamento
IF NOT EXISTS (SELECT 1 FROM CUFD WHERE TableID = 'ORDR' AND AliasID = 'WMS_CORR_ID')
BEGIN
    INSERT INTO CUFD (
        TableID, FieldID, AliasID, Descr, 
        TypeID, SizeID, EditSize, Dflt, NotNull, 
        IndexID, RTable, RField, FldValue, FldDate
    )
    VALUES (
        'ORDR',
        (SELECT ISNULL(MAX(FieldID), 0) + 1 FROM CUFD WHERE TableID = 'ORDR'), 
        'WMS_CORR_ID',
        'Correlation ID WMS',
        'A',
        100,
        100,
        '',
        'N',
        NULL, NULL, NULL, NULL, NULL
    );
    PRINT 'UDF U_WMS_CORR_ID criado com sucesso';
END
ELSE
BEGIN
    PRINT 'UDF U_WMS_CORR_ID já existe';
END
GO

-- Verificar UDFs criados
SELECT 
    TableID as 'Tabela',
    AliasID as 'Campo',
    Descr as 'Descrição',
    CASE TypeID 
        WHEN 'A' THEN 'String'
        WHEN 'N' THEN 'Number'
        WHEN 'D' THEN 'Date'
        ELSE TypeID 
    END as 'Tipo',
    SizeID as 'Tamanho'
FROM CUFD 
WHERE TableID = 'ORDR' 
AND AliasID LIKE 'WMS_%'
ORDER BY AliasID;

-- ============================================================================
-- NOTAS IMPORTANTES:
-- ============================================================================
-- 1. Após executar, reinicie o Service Layer para reconhecer os novos campos
-- 2. Os campos aparecerão como U_WMS_STATUS, U_WMS_ORDERID, etc.
-- 3. Teste via Service Layer: GET /Orders?$select=U_WMS_STATUS
-- 4. Se precisar remover um UDF: DELETE FROM CUFD WHERE TableID='ORDR' AND AliasID='...'
-- ============================================================================
