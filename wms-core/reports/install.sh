#!/bin/bash

# ============================================================================
# SCRIPT DE INSTALAÇÃO DO AGENTE DE DADOS - WMS CORE
# ============================================================================
# Este script automatiza a instalação completa do módulo de relatórios
# ============================================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações (ajustar conforme necessário)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-wms_db}"
DB_USER="${DB_USER:-wms_user}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_psql() {
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client (psql) não encontrado"
        echo "Por favor, instale o PostgreSQL client primeiro."
        exit 1
    fi
    print_success "PostgreSQL client encontrado"
}

check_db_connection() {
    print_info "Testando conexão com o banco de dados..."
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        print_success "Conexão com banco de dados OK"
        return 0
    else
        print_error "Falha ao conectar ao banco de dados"
        echo "  Host: $DB_HOST"
        echo "  Port: $DB_PORT"
        echo "  Database: $DB_NAME"
        echo "  User: $DB_USER"
        return 1
    fi
}

execute_sql_file() {
    local file=$1
    local description=$2
    
    print_info "Executando: $description"
    
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" > /dev/null 2>&1; then
        print_success "$description - OK"
        return 0
    else
        print_error "$description - FALHOU"
        return 1
    fi
}

# ============================================================================
# MENU INTERATIVO
# ============================================================================

show_menu() {
    clear
    print_header "INSTALAÇÃO AGENTE DE DADOS - WMS CORE"
    echo ""
    echo "1) Instalação Completa (Recomendado)"
    echo "2) Apenas Migrações"
    echo "3) Apenas Relatórios"
    echo "4) Verificar Instalação"
    echo "5) Desinstalar"
    echo "6) Configurar Job de Snapshot"
    echo "0) Sair"
    echo ""
    read -p "Escolha uma opção: " choice
    return $choice
}

# ============================================================================
# INSTALAÇÃO COMPLETA
# ============================================================================

install_complete() {
    print_header "INSTALAÇÃO COMPLETA"
    
    # Verificações
    check_psql || exit 1
    
    # Solicitar credenciais se não estiverem definidas
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Password do banco de dados: " DB_PASSWORD
        echo ""
    fi
    
    check_db_connection || exit 1
    
    echo ""
    print_info "Iniciando instalação..."
    echo ""
    
    # 1. Migrações
    print_header "ETAPA 1: MIGRAÇÕES"
    
    if [ -f "$PROJECT_ROOT/migrations/0001_init.sql" ]; then
        execute_sql_file "$PROJECT_ROOT/migrations/0001_init.sql" "Migração 0001 (Base)"
    else
        print_warning "Migração 0001 não encontrada, pulando..."
    fi
    
    if [ -f "$PROJECT_ROOT/migrations/0002_locations_inventory.sql" ]; then
        execute_sql_file "$PROJECT_ROOT/migrations/0002_locations_inventory.sql" "Migração 0002 (Locations + Inventory)"
    else
        print_error "Migração 0002 não encontrada!"
        exit 1
    fi
    
    echo ""
    
    # 2. Relatórios
    print_header "ETAPA 2: RELATÓRIOS"
    
    execute_sql_file "$SCRIPT_DIR/queries/sla-reports.sql" "Relatórios de SLA"
    execute_sql_file "$SCRIPT_DIR/queries/productivity-reports.sql" "Relatórios de Produtividade"
    execute_sql_file "$SCRIPT_DIR/queries/divergence-reports.sql" "Relatórios de Divergências"
    
    echo ""
    
    # 3. Verificação
    print_header "ETAPA 3: VERIFICAÇÃO"
    
    print_info "Verificando views criadas..."
    VIEW_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'report_%';" | tr -d ' ')
    
    print_info "Verificando funções criadas..."
    FUNC_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'report_%';" | tr -d ' ')
    
    echo ""
    print_success "Views criadas: $VIEW_COUNT"
    print_success "Funções criadas: $FUNC_COUNT"
    
    echo ""
    print_header "INSTALAÇÃO CONCLUÍDA"
    print_success "Agente de Dados instalado com sucesso!"
    echo ""
    print_info "Próximos passos:"
    echo "  1. Configure o job de snapshot (opção 6 do menu)"
    echo "  2. Consulte a documentação em: $SCRIPT_DIR/README.md"
    echo "  3. Teste os relatórios: SELECT * FROM report_orders_at_risk;"
    echo ""
}

# ============================================================================
# APENAS MIGRAÇÕES
# ============================================================================

install_migrations_only() {
    print_header "INSTALAÇÃO: APENAS MIGRAÇÕES"
    
    check_psql || exit 1
    
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Password do banco de dados: " DB_PASSWORD
        echo ""
    fi
    
    check_db_connection || exit 1
    
    execute_sql_file "$PROJECT_ROOT/migrations/0001_init.sql" "Migração 0001"
    execute_sql_file "$PROJECT_ROOT/migrations/0002_locations_inventory.sql" "Migração 0002"
    
    print_success "Migrações instaladas!"
}

# ============================================================================
# APENAS RELATÓRIOS
# ============================================================================

install_reports_only() {
    print_header "INSTALAÇÃO: APENAS RELATÓRIOS"
    
    check_psql || exit 1
    
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Password do banco de dados: " DB_PASSWORD
        echo ""
    fi
    
    check_db_connection || exit 1
    
    execute_sql_file "$SCRIPT_DIR/queries/sla-reports.sql" "Relatórios de SLA"
    execute_sql_file "$SCRIPT_DIR/queries/productivity-reports.sql" "Relatórios de Produtividade"
    execute_sql_file "$SCRIPT_DIR/queries/divergence-reports.sql" "Relatórios de Divergências"
    
    print_success "Relatórios instalados!"
}

# ============================================================================
# VERIFICAÇÃO
# ============================================================================

verify_installation() {
    print_header "VERIFICAÇÃO DA INSTALAÇÃO"
    
    check_psql || exit 1
    
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Password do banco de dados: " DB_PASSWORD
        echo ""
    fi
    
    check_db_connection || exit 1
    
    echo ""
    print_info "Verificando tabelas..."
    TABLES=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;")
    echo "$TABLES" | while read -r table; do
        if [ -n "$table" ]; then
            print_success "Tabela: $(echo $table | tr -d ' ')"
        fi
    done
    
    echo ""
    print_info "Verificando views de relatórios..."
    VIEWS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'report_%' ORDER BY table_name;")
    echo "$VIEWS" | while read -r view; do
        if [ -n "$view" ]; then
            print_success "View: $(echo $view | tr -d ' ')"
        fi
    done
    
    echo ""
    print_info "Verificando funções..."
    FUNCTIONS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'report_%' ORDER BY routine_name;")
    echo "$FUNCTIONS" | while read -r func; do
        if [ -n "$func" ]; then
            print_success "Função: $(echo $func | tr -d ' ')"
        fi
    done
    
    echo ""
}

# ============================================================================
# DESINSTALAÇÃO
# ============================================================================

uninstall() {
    print_header "DESINSTALAÇÃO"
    print_warning "ATENÇÃO: Esta operação irá remover TODOS os relatórios e views!"
    read -p "Tem certeza que deseja continuar? (sim/não): " confirm
    
    if [ "$confirm" != "sim" ]; then
        print_info "Desinstalação cancelada."
        return
    fi
    
    check_psql || exit 1
    
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Password do banco de dados: " DB_PASSWORD
        echo ""
    fi
    
    check_db_connection || exit 1
    
    print_info "Removendo relatórios..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
-- Remover views
DROP VIEW IF EXISTS report_sla_picking_time CASCADE;
DROP VIEW IF EXISTS report_sla_checking_time CASCADE;
DROP VIEW IF EXISTS report_sla_end_to_end CASCADE;
DROP VIEW IF EXISTS report_orders_at_risk CASCADE;
DROP VIEW IF EXISTS report_picker_productivity CASCADE;
DROP VIEW IF EXISTS report_checker_productivity CASCADE;
DROP VIEW IF EXISTS report_productivity_by_zone CASCADE;
DROP VIEW IF EXISTS report_task_cycle_time CASCADE;
DROP VIEW IF EXISTS report_scan_divergences CASCADE;
DROP VIEW IF EXISTS report_divergence_by_sku CASCADE;
DROP VIEW IF EXISTS report_divergence_by_operator CASCADE;
DROP VIEW IF EXISTS report_inventory_adjustments_detail CASCADE;
DROP VIEW IF EXISTS report_checking_divergences CASCADE;

-- Remover funções
DROP FUNCTION IF EXISTS report_sla_summary CASCADE;
DROP FUNCTION IF EXISTS report_picker_ranking CASCADE;
DROP FUNCTION IF EXISTS report_operator_utilization CASCADE;
DROP FUNCTION IF EXISTS report_adjustments_summary CASCADE;
DROP FUNCTION IF EXISTS report_accuracy_kpi CASCADE;

-- Remover views utilitárias
DROP VIEW IF EXISTS v_inventory_current CASCADE;
DROP VIEW IF EXISTS v_inventory_by_location CASCADE;
DROP VIEW IF EXISTS v_locations_pickable CASCADE;
EOF
    
    print_success "Desinstalação concluída!"
}

# ============================================================================
# CONFIGURAR JOB DE SNAPSHOT
# ============================================================================

configure_snapshot_job() {
    print_header "CONFIGURAÇÃO DO JOB DE SNAPSHOT"
    
    echo "Este job deve ser executado diariamente para criar snapshots do inventário."
    echo ""
    echo "Escolha o método de agendamento:"
    echo "1) Crontab (Linux/Mac)"
    echo "2) pg_cron (PostgreSQL extension)"
    echo "3) Exibir instruções para Windows Task Scheduler"
    echo ""
    read -p "Escolha uma opção: " method
    
    case $method in
        1)
            print_info "Adicionando ao crontab..."
            CRON_LINE="0 2 * * * PGPASSWORD='$DB_PASSWORD' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SCRIPT_DIR/examples/snapshot-job.sql >> /var/log/wms/snapshot.log 2>&1"
            
            echo "$CRON_LINE" | crontab -
            print_success "Job adicionado ao crontab (execução diária às 02:00)"
            ;;
        2)
            print_info "Configurando pg_cron..."
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT cron.schedule(
  'daily-inventory-snapshot',
  '0 2 * * *',
  \$\$\i $SCRIPT_DIR/examples/snapshot-job.sql\$\$
);
EOF
            print_success "Job configurado no pg_cron"
            ;;
        3)
            echo ""
            print_info "Instruções para Windows Task Scheduler:"
            echo ""
            echo "1. Abra o Task Scheduler"
            echo "2. Crie uma nova tarefa básica"
            echo "3. Nome: 'WMS Daily Snapshot'"
            echo "4. Disparador: Diariamente às 02:00"
            echo "5. Ação: Iniciar um programa"
            echo "   Programa: C:\\Program Files\\PostgreSQL\\XX\\bin\\psql.exe"
            echo "   Argumentos: -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f \"$SCRIPT_DIR\\examples\\snapshot-job.sql\""
            echo ""
            ;;
    esac
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    while true; do
        show_menu
        choice=$?
        
        echo ""
        
        case $choice in
            1)
                install_complete
                read -p "Pressione ENTER para continuar..."
                ;;
            2)
                install_migrations_only
                read -p "Pressione ENTER para continuar..."
                ;;
            3)
                install_reports_only
                read -p "Pressione ENTER para continuar..."
                ;;
            4)
                verify_installation
                read -p "Pressione ENTER para continuar..."
                ;;
            5)
                uninstall
                read -p "Pressione ENTER para continuar..."
                ;;
            6)
                configure_snapshot_job
                read -p "Pressione ENTER para continuar..."
                ;;
            0)
                print_info "Saindo..."
                exit 0
                ;;
            *)
                print_error "Opção inválida"
                sleep 2
                ;;
        esac
    done
}

# Executar
main
