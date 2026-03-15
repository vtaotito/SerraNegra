-- ============================================================================
-- PAINEL: Tabela de Usuários
-- ============================================================================
-- Migração para o sistema de autenticação do painel administrativo
-- painel.garrafariaserranegra.com.br
-- ============================================================================

CREATE TABLE IF NOT EXISTS panel_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(200) NOT NULL,

    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    -- admin: acesso total, gerencia usuários
    -- supervisor: acesso a todos os módulos, sem gestão de usuários
    -- operador: acesso ao WMS
    -- comercial: acesso ao cockpit e B2B
    -- viewer: somente leitura

    is_active BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,

    -- Módulos permitidos (JSON array de strings)
    allowed_modules JSONB NOT NULL DEFAULT '["wms","cockpit","b2b"]'::jsonb,

    -- Segurança
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(50),
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    password_changed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_panel_users_username ON panel_users(username);
CREATE INDEX idx_panel_users_email ON panel_users(email);
CREATE INDEX idx_panel_users_role ON panel_users(role);
CREATE INDEX idx_panel_users_is_active ON panel_users(is_active);

-- Trigger para updated_at
CREATE TRIGGER trigger_panel_users_updated_at
    BEFORE UPDATE ON panel_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tabela de sessões (para invalidação)
CREATE TABLE IF NOT EXISTS panel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES panel_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_panel_sessions_user_id ON panel_sessions(user_id);
CREATE INDEX idx_panel_sessions_token_hash ON panel_sessions(token_hash);
CREATE INDEX idx_panel_sessions_expires_at ON panel_sessions(expires_at);

-- Log de atividades do painel
CREATE TABLE IF NOT EXISTS panel_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES panel_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_panel_activity_log_user_id ON panel_activity_log(user_id);
CREATE INDEX idx_panel_activity_log_action ON panel_activity_log(action);
CREATE INDEX idx_panel_activity_log_created_at ON panel_activity_log(created_at);

COMMENT ON TABLE panel_users IS 'Usuários do painel administrativo';
COMMENT ON TABLE panel_sessions IS 'Sessões ativas do painel';
COMMENT ON TABLE panel_activity_log IS 'Log de atividades do painel';
