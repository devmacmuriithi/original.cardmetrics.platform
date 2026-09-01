-- ALX v1 Canonical Liquidity Signals Schema
-- Config table for tunable thresholds

DROP TABLE IF EXISTS alx_signal_config CASCADE;

CREATE TABLE alx_signal_config (
    id SERIAL PRIMARY KEY,
    config_key TEXT UNIQUE NOT NULL,
    config_value DECIMAL(10,2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default values per spec
INSERT INTO alx_signal_config (config_key, config_value, description) VALUES
    ('rolloff_multiplier', 5, 'Multiplier for roll-off detection: D > B_prev * 5'),
    ('execution_multiplier', 10, 'Multiplier for execution eligibility: D < B_prev * 10'),
    ('high_tier_threshold', 1000, 'Min sales_volume_365 for High liquidity tier'),
    ('medium_tier_threshold', 300, 'Min sales_volume_365 for Medium liquidity tier');

-- Output table: Canonical daily signals per card
DROP TABLE IF EXISTS alx_market_signals_daily CASCADE;

CREATE TABLE alx_market_signals_daily (
    date DATE NOT NULL,
    card_id BIGINT NOT NULL,
    console_uid TEXT,
    
    -- Source data (from card_market_daily)
    sales_volume_365 DECIMAL,  -- Using sales_volume as the 365-day proxy
    
    -- Computed signals
    liquidity_baseline DECIMAL(10,2),  -- V / 365
    liquidity_tier TEXT,              -- High, Medium, Low
    rolloff_flag BOOLEAN,             -- Ghost volatility detector
    execution_eligible BOOLEAN,       -- Market execution gate
    
    -- Metadata
    computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (date, card_id)
);

CREATE INDEX idx_alx_signals_date ON alx_market_signals_daily(date);
CREATE INDEX idx_alx_signals_card ON alx_market_signals_daily(card_id);
CREATE INDEX idx_alx_signals_tier ON alx_market_signals_daily(liquidity_tier);
CREATE INDEX idx_alx_signals_eligible ON alx_market_signals_daily(execution_eligible) WHERE execution_eligible = true;
CREATE INDEX idx_alx_signals_rolloff ON alx_market_signals_daily(rolloff_flag) WHERE rolloff_flag = true;

COMMENT ON TABLE alx_market_signals_daily IS 'ALX v1 Canonical Liquidity Signals - daily per card';
COMMENT ON COLUMN alx_market_signals_daily.liquidity_baseline IS 'V / 365: approximate avg units/day';
COMMENT ON COLUMN alx_market_signals_daily.rolloff_flag IS 'True when D > B_prev * 5 (ghost volatility)';
COMMENT ON COLUMN alx_market_signals_daily.execution_eligible IS 'Gate for market/instant execution';
