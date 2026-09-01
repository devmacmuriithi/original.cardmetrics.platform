-- ============================================================================
-- 04-INDICES: All database indexes (optional - for later optimization)
-- ============================================================================
-- Run this after tables are populated if you need query performance
-- ============================================================================

-- Dimension table indexes
CREATE INDEX IF NOT EXISTS idx_sports_slug ON sports(slug);
CREATE INDEX IF NOT EXISTS idx_leagues_sport ON leagues(sport_id);
CREATE INDEX IF NOT EXISTS idx_leagues_slug ON leagues(slug);
CREATE INDEX IF NOT EXISTS idx_manufacturers_slug ON manufacturers(slug);
CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_players_slug ON players(slug);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(full_name);
CREATE INDEX IF NOT EXISTS idx_players_last_name ON players(last_name);
CREATE INDEX IF NOT EXISTS idx_sets_sport ON sets(sport_id);
CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year);
CREATE INDEX IF NOT EXISTS idx_sets_slug ON sets(slug);

-- Cards table indexes
CREATE INDEX IF NOT EXISTS idx_cards_set ON cards(set_id);
CREATE INDEX IF NOT EXISTS idx_cards_player ON cards(player_id);
CREATE INDEX IF NOT EXISTS idx_cards_player_name ON cards(player_name) WHERE player_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_rookie ON cards(rookie_card) WHERE rookie_card = true;

-- Staging table indexes
CREATE INDEX IF NOT EXISTS idx_raw_ingest_date ON cards_raw_ingests(ingest_date);
CREATE INDEX IF NOT EXISTS idx_raw_ingest_card ON cards_raw_ingests(card_id, ingest_date);
CREATE INDEX IF NOT EXISTS idx_raw_processed ON cards_raw_ingests(processed) WHERE processed = false;

-- Daily snapshots indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON card_daily_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_snapshots_card ON card_daily_snapshots(card_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_recent ON card_daily_snapshots(date, card_id);

-- Daily deltas indexes
CREATE INDEX IF NOT EXISTS idx_daily_deltas_card ON card_daily_deltas(card_id);
CREATE INDEX IF NOT EXISTS idx_daily_deltas_date ON card_daily_deltas(date);

-- Computed metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_card ON card_computed_metrics(card_id);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON card_computed_metrics(date);
CREATE INDEX IF NOT EXISTS idx_metrics_loose_momentum ON card_computed_metrics(loose_momentum) WHERE loose_momentum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_psa10_momentum ON card_computed_metrics(psa10_momentum) WHERE psa10_momentum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_spread ON card_computed_metrics(psa10_loose_spread) WHERE psa10_loose_spread IS NOT NULL;

-- Price windows indexes
CREATE INDEX IF NOT EXISTS idx_price_windows_card ON card_price_windows(card_id);
CREATE INDEX IF NOT EXISTS idx_price_windows_date ON card_price_windows(date);
CREATE INDEX IF NOT EXISTS idx_price_windows_7d ON card_price_windows(change_7d_pct) WHERE has_7d_data;

-- Analytics daily indexes
CREATE INDEX IF NOT EXISTS idx_analytics_daily_card ON card_analytics_daily(card_id);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON card_analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_trending ON card_analytics_daily(is_trending, date) WHERE is_trending;

-- Investment metrics indexes
CREATE INDEX IF NOT EXISTS idx_inv_metrics_type ON card_investment_metrics_by_type(price_type);
CREATE INDEX IF NOT EXISTS idx_inv_metrics_7d ON card_investment_metrics_by_type(change_7d_pct) WHERE change_7d_pct IS NOT NULL;

-- Price spreads indexes
CREATE INDEX IF NOT EXISTS idx_price_spreads_upside ON card_price_spreads(grading_upside_potential) WHERE grading_upside_potential IS NOT NULL;
