-- ============================================================================
-- SETS INGESTION TRACKING: Progress tracking for parallel imports
-- ============================================================================
-- Tracks import status per set/date for resume capability and worker coordination
-- ============================================================================

DROP TABLE IF EXISTS sets_ingestion_stats CASCADE;

CREATE TABLE sets_ingestion_stats (
    id BIGSERIAL PRIMARY KEY,
    console_uid TEXT NOT NULL REFERENCES sets(console_uid) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Import status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
    
    -- Record counts
    imported_records INTEGER DEFAULT 0,
    expected_records INTEGER,  -- from S3 file size estimation
    
    -- File info
    csv_file_path TEXT,  -- S3 path: dt=2026-01-24/basketball-cards-1948-bowman_G1096.csv
    file_size_bytes BIGINT,
    
    -- Worker tracking (for parallel processing)
    worker_id TEXT,  -- hostname:pid or custom worker name
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Error tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(console_uid, date)
);

-- Indexes for common queries
CREATE INDEX idx_ingestion_stats_status ON sets_ingestion_stats(status);
CREATE INDEX idx_ingestion_stats_date ON sets_ingestion_stats(date);
CREATE INDEX idx_ingestion_stats_worker ON sets_ingestion_stats(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX idx_ingestion_stats_pending ON sets_ingestion_stats(console_uid, date) WHERE status = 'pending';
CREATE INDEX idx_ingestion_stats_completed ON sets_ingestion_stats(console_uid, date, completed_at) WHERE status = 'completed';

COMMENT ON TABLE sets_ingestion_stats IS 'Tracks import progress per set/date for parallel processing and resume capability';

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to claim next pending set for a worker (atomic, prevents race conditions)
CREATE OR REPLACE FUNCTION claim_next_pending_set(
    p_worker_id TEXT,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(console_uid TEXT, set_name TEXT, csv_path TEXT) AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        UPDATE sets_ingestion_stats s
        SET status = 'in_progress',
            worker_id = p_worker_id,
            started_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE s.id = (
            SELECT s2.id 
            FROM sets_ingestion_stats s2
            WHERE s2.date = p_date 
              AND s2.status = 'pending'
            ORDER BY s2.console_uid
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING s.console_uid
    )
    SELECT 
        s.console_uid,
        s.name as set_name,
        s.csv_path
    FROM sets s
    INNER JOIN claimed c ON s.console_uid = c.console_uid;
END;
$$ LANGUAGE plpgsql;

-- Function to mark import as completed
CREATE OR REPLACE FUNCTION mark_import_completed(
    p_console_uid TEXT,
    p_date DATE,
    p_records INTEGER,
    p_csv_path TEXT,
    p_file_size BIGINT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO sets_ingestion_stats (
        console_uid, date, status, imported_records, 
        csv_file_path, file_size_bytes, completed_at, updated_at
    ) VALUES (
        p_console_uid, p_date, 'completed', p_records,
        p_csv_path, p_file_size, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (console_uid, date) DO UPDATE SET
        status = 'completed',
        imported_records = p_records,
        csv_file_path = p_csv_path,
        file_size_bytes = COALESCE(p_file_size, sets_ingestion_stats.file_size_bytes),
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        worker_id = NULL,
        error_message = NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to mark import as failed
CREATE OR REPLACE FUNCTION mark_import_failed(
    p_console_uid TEXT,
    p_date DATE,
    p_error TEXT,
    p_retry_count INTEGER DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    INSERT INTO sets_ingestion_stats (
        console_uid, date, status, error_message, retry_count, updated_at
    ) VALUES (
        p_console_uid, p_date, 'failed', p_error, p_retry_count, CURRENT_TIMESTAMP
    )
    ON CONFLICT (console_uid, date) DO UPDATE SET
        status = 'failed',
        error_message = p_error,
        retry_count = sets_ingestion_stats.retry_count + 1,
        updated_at = CURRENT_TIMESTAMP,
        worker_id = NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to mark as skipped (no S3 data available)
CREATE OR REPLACE FUNCTION mark_import_skipped(
    p_console_uid TEXT,
    p_date DATE,
    p_reason TEXT DEFAULT 'No S3 data available'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO sets_ingestion_stats (
        console_uid, date, status, error_message, updated_at
    ) VALUES (
        p_console_uid, p_date, 'skipped', p_reason, CURRENT_TIMESTAMP
    )
    ON CONFLICT (console_uid, date) DO UPDATE SET
        status = 'skipped',
        error_message = p_reason,
        updated_at = CURRENT_TIMESTAMP,
        worker_id = NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to reset failed imports for retry
CREATE OR REPLACE FUNCTION reset_failed_imports(
    p_date DATE DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE sets_ingestion_stats
    SET status = 'pending',
        worker_id = NULL,
        started_at = NULL,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE status = 'failed'
      AND (p_date IS NULL OR date = p_date);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- View: Import progress summary
CREATE OR REPLACE VIEW vw_import_progress AS
SELECT 
    date,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
    SUM(imported_records) FILTER (WHERE status = 'completed') as total_records_imported,
    COUNT(DISTINCT worker_id) FILTER (WHERE status = 'in_progress') as active_workers
FROM sets_ingestion_stats
GROUP BY date
ORDER BY date DESC;

-- View: Last import status per set
CREATE OR REPLACE VIEW vw_set_import_status AS
SELECT 
    s.console_uid,
    s.name as set_name,
    sp.name as sport,
    s.csv_path,
    latest.date as last_import_date,
    latest.status as last_import_status,
    latest.imported_records as last_import_records,
    latest.csv_file_path as last_import_file,
    latest.completed_at as last_import_completed,
    latest.error_message as last_error
FROM sets s
LEFT JOIN sports sp ON s.sport_id = sp.id
LEFT JOIN LATERAL (
    SELECT * FROM sets_ingestion_stats
    WHERE console_uid = s.console_uid
    ORDER BY date DESC
    LIMIT 1
) latest ON true
ORDER BY s.console_uid;

-- ============================================================================
-- INITIALIZATION: Pre-populate with all sets for today (or specified date)
-- ============================================================================

CREATE OR REPLACE FUNCTION init_ingestion_queue(
    p_date DATE DEFAULT CURRENT_DATE,
    p_sport TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO sets_ingestion_stats (console_uid, date, status)
    SELECT s.console_uid, p_date, 'pending'
    FROM sets s
    LEFT JOIN sports sp ON s.sport_id = sp.id
    WHERE (p_sport IS NULL OR LOWER(sp.name) = LOWER(p_sport))
      AND s.console_uid IS NOT NULL
    ON CONFLICT (console_uid, date) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION init_ingestion_queue IS 'Pre-populates ingestion tracking table for a date. Call before starting imports.';
