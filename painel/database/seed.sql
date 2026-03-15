-- ============================================================================
-- SEED: Usuário administrador do painel
-- ============================================================================
-- Usuário: vitor.tito
-- Email: vtao.tito@gmail.com
-- Senha padrão: Admin@2026 (hash bcrypt com custo 12)
-- IMPORTANTE: Altere a senha após o primeiro login!
-- ============================================================================

INSERT INTO panel_users (
    username,
    email,
    password_hash,
    display_name,
    role,
    allowed_modules,
    is_active
) VALUES (
    'vitor.tito',
    'vtao.tito@gmail.com',
    -- bcrypt hash de 'Admin@2026' com custo 12
    '$2a$12$LJ3m4ys1PrG4vqRqYeJI3OW0cFv1p8.KzQN7UBL2RI8MvEuFW1hGy',
    'Vitor Tito',
    'admin',
    '["wms","cockpit","b2b"]'::jsonb,
    true
) ON CONFLICT (username) DO NOTHING;
