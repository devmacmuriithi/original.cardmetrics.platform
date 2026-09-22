const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper to parse cookies from headers
const parseCookies = (req) => {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
};

// Public & Login Routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'Admin@2026';

  if (username === validUser && password === validPass) {
    const sessionToken = Buffer.from(`${username}:${validPass}:authorized`).toString('base64');
    res.setHeader('Set-Cookie', `cardmetrics_auth=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    return res.redirect('/dashboard');
  }

  return res.redirect('/login?error=invalid');
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'cardmetrics_auth=; Path=/; HttpOnly; Max-Age=0');
  return res.redirect('/login');
});

// Authentication Guard Middleware
const sessionAuth = (req, res, next) => {
  // Allow health checks, login routes, and static assets (CSS, JS, images, fonts)
  if (
    req.path === '/health' ||
    req.path === '/login' ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/js/') ||
    req.path.startsWith('/images/') ||
    req.path.startsWith('/favicon.ico')
  ) {
    return next();
  }

  // Check cookie session
  const cookies = parseCookies(req);
  const authCookie = cookies['cardmetrics_auth'];

  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'Admin@2026';
  const expectedToken = Buffer.from(`${validUser}:${validPass}:authorized`).toString('base64');

  if (authCookie && authCookie === expectedToken) {
    return next();
  }

  // Also support Basic Auth header if accessed via API/CLI
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const auth = Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString().split(':');
    if (auth[0] === validUser && auth[1] === validPass) {
      return next();
    }
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in at /login' });
  }

  return res.redirect('/login');
};

app.use(sessionAuth);

const buildSalesWhere = (req) => {
  const {
    startDate = '',
    endDate = '',
    platform = '',
    listingType = '',
    condition = '',
    minPrice = '',
    maxPrice = '',
    minRating = ''
  } = req.query;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`sale_date >= $${paramIndex++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`sale_date <= $${paramIndex++}`);
    params.push(endDate);
  }
  if (platform) {
    conditions.push(`COALESCE(platform, metadata->'raw_sale'->>'price_source', 'eBay') ILIKE $${paramIndex++}`);
    params.push(platform);
  }
  if (listingType) {
    conditions.push(`COALESCE(listing_type, metadata->'raw_sale'->>'sale_type', CASE WHEN is_auction THEN 'Auction' ELSE 'BIN' END) ILIKE $${paramIndex++}`);
    params.push(listingType);
  }
  if (condition) {
    conditions.push(`COALESCE(condition, condition_label, metadata->'raw_sale'->>'grade', 'Ungraded') ILIKE $${paramIndex++}`);
    params.push(condition);
  }
  if (minPrice) {
    conditions.push(`sale_price >= $${paramIndex++}`);
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    conditions.push(`sale_price <= $${paramIndex++}`);
    params.push(Number(maxPrice));
  }
  if (minRating) {
    conditions.push(`seller_rating >= $${paramIndex++}`);
    params.push(Number(minRating));
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
};

const buildIndexSeries = (rows) => {
  if (!rows || rows.length === 0) return [];
  const basePrice = Number(rows[0].median_price || rows[0].avg_price || 0) || 1;
  return rows.map(row => {
    const price = Number(row.median_price || row.avg_price || 0) || 0;
    return {
      date: row.date,
      price,
      index_value: basePrice > 0 ? Number(((price / basePrice) * 100).toFixed(2)) : 0,
      sales_count: Number(row.sales_count || 0)
    };
  });
};

const findIndexValueAt = (series, targetDate) => {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].date <= targetDate) {
      return series[i].index_value;
    }
  }
  return null;
};

const buildIndexKpis = (series) => {
  if (!series.length) {
    return { current_value: 0, change_7d: 0, change_30d: 0, change_90d: 0 };
  }
  const last = series[series.length - 1];
  const lastDate = new Date(last.date);
  const date7 = new Date(lastDate); date7.setDate(date7.getDate() - 7);
  const date30 = new Date(lastDate); date30.setDate(date30.getDate() - 30);
  const date90 = new Date(lastDate); date90.setDate(date90.getDate() - 90);

  const value7 = findIndexValueAt(series, date7.toISOString().slice(0, 10));
  const value30 = findIndexValueAt(series, date30.toISOString().slice(0, 10));
  const value90 = findIndexValueAt(series, date90.toISOString().slice(0, 10));

  const changePct = (current, past) => {
    if (!past || past === 0) return 0;
    return Number((((current / past) - 1) * 100).toFixed(2));
  };

  return {
    current_value: Number(last.index_value || 0),
    change_7d: changePct(last.index_value, value7),
    change_30d: changePct(last.index_value, value30),
    change_90d: changePct(last.index_value, value90)
  };
};

const buildIndexWhere = (req) => {
  const {
    startDate = '',
    endDate = '',
    platform = '',
    listingType = '',
    condition = '',
    minPrice = '',
    maxPrice = '',
    minRating = '',
    setName = '',
    playerName = '',
    sport = '',
    yearFrom = '',
    yearTo = ''
  } = req.query;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    conditions.push(`s.sale_date >= $${paramIndex++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`s.sale_date <= $${paramIndex++}`);
    params.push(endDate);
  }
  if (platform) {
    conditions.push(`s.platform = $${paramIndex++}`);
    params.push(platform);
  }
  if (listingType) {
    conditions.push(`s.listing_type = $${paramIndex++}`);
    params.push(listingType);
  }
  if (condition) {
    conditions.push(`s.condition = $${paramIndex++}`);
    params.push(condition);
  }
  if (minPrice) {
    conditions.push(`s.sale_price >= $${paramIndex++}`);
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    conditions.push(`s.sale_price <= $${paramIndex++}`);
    params.push(Number(maxPrice));
  }
  if (minRating) {
    conditions.push(`s.seller_rating >= $${paramIndex++}`);
    params.push(Number(minRating));
  }
  if (setName) {
    conditions.push(`c.set_name ILIKE $${paramIndex++}`);
    params.push(`%${setName}%`);
  }
  if (playerName) {
    conditions.push(`c.player_name ILIKE $${paramIndex++}`);
    params.push(`%${playerName}%`);
  }
  if (sport) {
    conditions.push(`c.sport_name ILIKE $${paramIndex++}`);
    params.push(`%${sport}%`);
  }
  if (yearFrom) {
    conditions.push(`c.set_year >= $${paramIndex++}`);
    params.push(Number(yearFrom));
  }
  if (yearTo) {
    conditions.push(`c.set_year <= $${paramIndex++}`);
    params.push(Number(yearTo));
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  };
};

const appendWhere = (whereClause, extra) => {
  if (!extra) return whereClause;
  if (!whereClause) return `WHERE ${extra}`;
  return `${whereClause} AND ${extra}`;
};

const fetchDecisionSignals = async (client, whereClause, params) => {
  const getWindowMetrics = async (days, offsetDays = 0) => {
    const windowWhere = appendWhere(
      whereClause,
      `sale_date >= CURRENT_DATE - INTERVAL '${days + offsetDays} days' AND sale_date < CURRENT_DATE - INTERVAL '${offsetDays} days'`
    );
    const { rows: [row] } = await client.query(`
      SELECT COALESCE(AVG(sale_price), 0) AS avg_price,
             COUNT(*)::int AS count
      FROM card_sales
      ${windowWhere}
    `, params);
    return { avgPrice: Number(row.avg_price || 0), count: Number(row.count || 0) };
  };

  const getSegmentAvg = async (extraCondition, days, offsetDays = 0) => {
    const segmentWhere = appendWhere(whereClause, extraCondition);
    const windowWhere = appendWhere(
      segmentWhere,
      `sale_date >= CURRENT_DATE - INTERVAL '${days + offsetDays} days' AND sale_date < CURRENT_DATE - INTERVAL '${offsetDays} days'`
    );
    const { rows: [row] } = await client.query(`
      SELECT COALESCE(AVG(sale_price), 0) AS avg_price
      FROM card_sales
      ${windowWhere}
    `, params);
    return Number(row.avg_price || 0);
  };

  const window7 = await getWindowMetrics(7, 0);
  const windowPrev7 = await getWindowMetrics(7, 7);
  const window30 = await getWindowMetrics(30, 0);
  const windowPrev30 = await getWindowMetrics(30, 30);
  const window90 = await getWindowMetrics(90, 0);
  const windowPrev90 = await getWindowMetrics(90, 90);

  const momentum7d = windowPrev7.avgPrice > 0
    ? ((window7.avgPrice / windowPrev7.avgPrice) - 1) * 100
    : 0;
  const momentum30d = windowPrev30.avgPrice > 0
    ? ((window30.avgPrice / windowPrev30.avgPrice) - 1) * 100
    : 0;
  const momentum90d = windowPrev90.avgPrice > 0
    ? ((window90.avgPrice / windowPrev90.avgPrice) - 1) * 100
    : 0;

  const volumeShift7d = windowPrev7.count > 0
    ? ((window7.count / windowPrev7.count) - 1) * 100
    : 0;
  const volumeShift30d = windowPrev30.count > 0
    ? ((window30.count / windowPrev30.count) - 1) * 100
    : 0;

  const auctionAvg30 = await getSegmentAvg(`listing_type ILIKE 'Auction'`, 30, 0);
  const auctionAvgPrev30 = await getSegmentAvg(`listing_type ILIKE 'Auction'`, 30, 30);
  const binAvg30 = await getSegmentAvg(`listing_type ILIKE 'BIN'`, 30, 0);
  const binAvgPrev30 = await getSegmentAvg(`listing_type ILIKE 'BIN'`, 30, 30);

  const auctionPremium30 = binAvg30 > 0 ? ((auctionAvg30 / binAvg30) - 1) * 100 : 0;
  const auctionPremiumPrev30 = binAvgPrev30 > 0 ? ((auctionAvgPrev30 / binAvgPrev30) - 1) * 100 : 0;
  const auctionPremiumShift = auctionPremiumPrev30 !== 0
    ? ((auctionPremium30 / auctionPremiumPrev30) - 1) * 100
    : 0;

  const psaAvg30 = await getSegmentAvg(`condition ILIKE 'PSA 10'`, 30, 0);
  const psaAvgPrev30 = await getSegmentAvg(`condition ILIKE 'PSA 10'`, 30, 30);
  const rawAvg30 = await getSegmentAvg(`condition ILIKE 'Raw'`, 30, 0);
  const rawAvgPrev30 = await getSegmentAvg(`condition ILIKE 'Raw'`, 30, 30);

  const gradePremium30 = rawAvg30 > 0 ? psaAvg30 / rawAvg30 : 0;
  const gradePremiumPrev30 = rawAvgPrev30 > 0 ? psaAvgPrev30 / rawAvgPrev30 : 0;
  const gradePremiumShift = gradePremiumPrev30 !== 0
    ? ((gradePremium30 / gradePremiumPrev30) - 1) * 100
    : 0;

  const avgDaily30 = window30.count / 30;
  const avgDailyPrev30 = windowPrev30.count / 30;
  const liquidityScore = avgDailyPrev30 > 0
    ? Math.min(100, Math.max(0, (avgDaily30 / avgDailyPrev30) * 50 + volumeShift30d / 2))
    : Math.min(100, avgDaily30 * 5);

  const marketHeatScore = Math.min(
    100,
    Math.max(0, 50 + (momentum30d * 0.6) + (volumeShift30d * 0.3) + (auctionPremiumShift * 0.2))
  );

  const supplyPressure = volumeShift30d - momentum30d;

  let riskFlag = 'Stable';
  if (marketHeatScore >= 70 && momentum30d > 10) {
    riskFlag = 'Overheated';
  } else if (marketHeatScore <= 35 || momentum30d < -10) {
    riskFlag = 'Cooling';
  }

  return {
    momentum7d: Number(momentum7d.toFixed(1)),
    momentum30d: Number(momentum30d.toFixed(1)),
    momentum90d: Number(momentum90d.toFixed(1)),
    liquidityScore: Number(liquidityScore.toFixed(1)),
    volumeShift30d: Number(volumeShift30d.toFixed(1)),
    gradePremiumShift: Number(gradePremiumShift.toFixed(1)),
    gradePremium30: Number(gradePremium30.toFixed(2)),
    auctionPremiumShift: Number(auctionPremiumShift.toFixed(1)),
    auctionPremium30: Number(auctionPremium30.toFixed(1)),
    marketHeatScore: Number(marketHeatScore.toFixed(1)),
    supplyPressure: Number(supplyPressure.toFixed(1)),
    riskFlag
  };
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// ============================================================================
// MARKET INTELLIGENCE ROUTES (from matched_cards_final)
// ============================================================================

app.get('/api/intelligence/opportunities', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0,
      minScore = 0,
      search = '',
      opportunityType = '',
      riskLevel = ''
    } = req.query;
    
    const client = await pool.connect();
    
    let whereConditions = ['investment_score >= $1'];
    let params = [minScore];
    let paramCount = 1;
    
    if (search) {
      paramCount++;
      whereConditions.push(`player_name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
    }
    
    if (opportunityType) {
      paramCount++;
      whereConditions.push(`opportunity_type = $${paramCount}`);
      params.push(opportunityType);
    }
    
    if (riskLevel) {
      paramCount++;
      whereConditions.push(`risk_level = $${paramCount}`);
      params.push(riskLevel);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Get total count
    const { rows: [countResult] } = await client.query(`
      SELECT COUNT(*) as total FROM vw_investment_opportunities
      WHERE ${whereClause}
    `, params);
    
    // Get paginated data
    params.push(limit, offset);
    const { rows } = await client.query(`
      SELECT * FROM vw_investment_opportunities
      WHERE ${whereClause}
      ORDER BY investment_score DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);
    
    client.release();
    res.json({
      data: rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching investment opportunities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// INDICES ROUTES (from card_sales + cards)
// ============================================================================

const fetchIndexSeries = async (client, whereClause, params) => {
  const { rows } = await client.query(`
    SELECT
      s.sale_date::date AS date,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY s.sale_price) AS median_price,
      AVG(s.sale_price) AS avg_price,
      COUNT(*)::int AS sales_count
    FROM card_sales s
    LEFT JOIN cards c ON s.card_id = c.id
    ${whereClause}
    GROUP BY s.sale_date
    ORDER BY s.sale_date ASC
  `, params);

  const series = buildIndexSeries(rows);
  const kpis = buildIndexKpis(series);
  return { series, kpis };
};

app.get('/api/indices/set', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildIndexWhere(req);
    const { series, kpis } = await fetchIndexSeries(client, whereClause, params);
    res.json({ series, kpis });
  } catch (error) {
    console.error('Error fetching set index:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/indices/player', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildIndexWhere(req);
    const { series, kpis } = await fetchIndexSeries(client, whereClause, params);
    res.json({ series, kpis });
  } catch (error) {
    console.error('Error fetching player index:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/indices/grade', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildIndexWhere(req);
    const { series, kpis } = await fetchIndexSeries(client, whereClause, params);
    res.json({ series, kpis });
  } catch (error) {
    console.error('Error fetching grade index:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/indices/market', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildIndexWhere(req);
    const { series, kpis } = await fetchIndexSeries(client, whereClause, params);
    res.json({ series, kpis });
  } catch (error) {
    console.error('Error fetching market index:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/intelligence/grading', async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0,
      minExpectedValue = 0,
      search = '',
      difficulty = '',
      recommendation = ''
    } = req.query;
    
    const client = await pool.connect();
    
    let whereConditions = ['expected_value >= $1'];
    let params = [minExpectedValue];
    let paramCount = 1;
    
    if (search) {
      paramCount++;
      whereConditions.push(`player_name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
    }
    
    if (difficulty) {
      paramCount++;
      whereConditions.push(`grading_difficulty = $${paramCount}`);
      params.push(difficulty);
    }
    
    if (recommendation) {
      paramCount++;
      whereConditions.push(`grading_recommendation = $${paramCount}`);
      params.push(recommendation);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Get total count
    const { rows: [countResult] } = await client.query(`
      SELECT COUNT(*) as total FROM vw_grading_intelligence
      WHERE ${whereClause}
    `, params);
    
    // Get paginated data
    params.push(limit, offset);
    const { rows } = await client.query(`
      SELECT * FROM vw_grading_intelligence
      WHERE ${whereClause}
      ORDER BY expected_value DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);
    
    client.release();
    res.json({
      data: rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching grading intelligence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/intelligence/market-efficiency', async (req, res) => {
  try {
    const { 
      limit = 100, 
      offset = 0,
      signal = '',
      search = '',
      efficiency = '',
      liquidity = ''
    } = req.query;
    
    const client = await pool.connect();
    
    let whereConditions = [];
    let params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      whereConditions.push(`player_name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
    }
    
    if (signal) {
      paramCount++;
      whereConditions.push(`market_signal = $${paramCount}`);
      params.push(signal);
    }
    
    if (efficiency) {
      paramCount++;
      whereConditions.push(`pricing_efficiency = $${paramCount}`);
      params.push(efficiency);
    }
    
    if (liquidity) {
      paramCount++;
      whereConditions.push(`liquidity_tier = $${paramCount}`);
      params.push(liquidity);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const { rows: [countResult] } = await client.query(`
      SELECT COUNT(*) as total FROM vw_market_efficiency
      ${whereClause}
    `, params);
    
    // Get paginated data
    params.push(limit, offset);
    const { rows } = await client.query(`
      SELECT * FROM vw_market_efficiency
      ${whereClause}
      ORDER BY ABS(bgs_10_price / NULLIF(loose_price, 0) - expected_multiplier) DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);
    
    client.release();
    res.json({
      data: rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching market efficiency:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/intelligence/player-profiles', async (req, res) => {
  try {
    const { 
      search = '', 
      limit = 50,
      offset = 0
    } = req.query;
    
    const client = await pool.connect();
    
    let whereClause = '';
    const params = [];
    
    if (search) {
      whereClause = 'WHERE player_name ILIKE $1';
      params.push(`%${search}%`);
    }
    
    // Get total count
    const { rows: [countResult] } = await client.query(`
      SELECT COUNT(*) as total FROM vw_player_grading_profiles
      ${whereClause}
    `, params);
    
    // Get paginated data
    params.push(limit, offset);
    const paramOffset = search ? 2 : 1;
    const { rows } = await client.query(`
      SELECT * FROM vw_player_grading_profiles
      ${whereClause}
      ORDER BY total_cards_graded DESC
      LIMIT $${paramOffset} OFFSET $${paramOffset + 1}
    `, params);
    
    client.release();
    res.json({
      data: rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching player profiles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/intelligence/alerts', async (req, res) => {
  try {
    const { 
      priority = '', 
      limit = 100,
      offset = 0,
      search = ''
    } = req.query;
    
    const client = await pool.connect();
    
    let whereConditions = [];
    let params = [];
    let paramCount = 0;
    
    if (priority) {
      paramCount++;
      whereConditions.push(`priority = $${paramCount}`);
      params.push(priority);
    }
    
    if (search) {
      paramCount++;
      whereConditions.push(`player_name ILIKE $${paramCount}`);
      params.push(`%${search}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    // Get total count
    const { rows: [countResult] } = await client.query(`
      SELECT COUNT(*) as total FROM vw_opportunity_alerts
      ${whereClause}
    `, params);
    
    // Get paginated data
    params.push(limit, offset);
    const { rows } = await client.query(`
      SELECT * FROM vw_opportunity_alerts
      ${whereClause}
      ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, momentum_pct DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);
    
    client.release();
    res.json({
      data: rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching opportunity alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sale-feed', async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      search = '',
      platform = '',
      listingType = ''
    } = req.query;

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 100);
    const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const client = await pool.connect();

    const tableCheck = await client.query(
      `SELECT to_regclass('public.card_sales') AS table_name`
    );
    if (!tableCheck.rows[0]?.table_name) {
      client.release();
      return res.json({
        data: [],
        total: 0,
        limit: safeLimit,
        offset: safeOffset
      });
    }

    const whereConditions = [];
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(
        COALESCE(cs.listing_title, cs.metadata->'raw_sale'->>'title', c.card_name, '') ILIKE $${paramCount}
        OR COALESCE(cs.platform_listing_id, cs.metadata->'raw_sale'->>'price_history_id', cs.external_sale_id, '') ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
    }

    if (platform) {
      paramCount++;
      whereConditions.push(`COALESCE(cs.platform, cs.metadata->'raw_sale'->>'price_source', 'eBay') ILIKE $${paramCount}`);
      params.push(platform);
    }

    if (listingType) {
      paramCount++;
      whereConditions.push(`COALESCE(cs.listing_type, cs.metadata->'raw_sale'->>'sale_type', CASE WHEN cs.is_auction THEN 'Auction' ELSE 'BIN' END) ILIKE $${paramCount}`);
      params.push(listingType);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM card_sales cs
      LEFT JOIN cards c ON cs.card_id::text = c.id::text
      ${whereClause}
    `;

    const { rows: [countResult] } = await client.query(countQuery, params);

    params.push(safeLimit, safeOffset);
    const dataQuery = `
      SELECT
        cs.id,
        cs.card_id,
        cs.sale_date,
        cs.sale_price,
        cs.currency,
        COALESCE(cs.platform, cs.metadata->'raw_sale'->>'price_source', 'eBay') as platform,
        COALESCE(cs.platform_listing_id, cs.metadata->'raw_sale'->>'price_history_id', cs.external_sale_id) as platform_listing_id,
        COALESCE(cs.platform_url, cs.listing_url, cs.metadata->'raw_sale'->>'sale_url') as platform_url,
        COALESCE(cs.listing_type, cs.metadata->'raw_sale'->>'sale_type', CASE WHEN cs.is_auction THEN 'Auction' ELSE 'BIN' END) as listing_type,
        COALESCE(cs.condition, cs.condition_label, cs.metadata->'raw_sale'->>'grade', 'Ungraded') as condition,
        cs.seller_rating,
        cs.seller_location,
        cs.quantity,
        cs.shipping_cost,
        COALESCE(cs.listing_title, cs.metadata->'raw_sale'->>'title', c.card_name, 'Card Sale') as listing_title,
        cs.image_url,
        cs.imported_at,
        cs.verified,
        COALESCE(cs.data_source, 'ALX') as data_source
      FROM card_sales cs
      LEFT JOIN cards c ON cs.card_id::text = c.id::text
      ${whereClause}
      ORDER BY cs.sale_date DESC NULLS LAST, cs.imported_at DESC NULLS LAST, cs.id DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const { rows } = await client.query(dataQuery, params);

    client.release();
    res.json({
      data: rows,
      total: parseInt(countResult.total, 10),
      limit: safeLimit,
      offset: safeOffset
    });
  } catch (error) {
    console.error('Error fetching sale feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// SALES INTELLIGENCE ROUTES (from card_sales)
// ============================================================================

app.get('/api/sales/pulse', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      SELECT
        COUNT(*)::int AS total_sales,
        COALESCE(SUM(sale_price), 0) AS total_revenue,
        COALESCE(AVG(sale_price), 0) AS avg_price,
        COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
    `, params);

    const { rows: salesByDay } = await client.query(`
      SELECT sale_date::date AS date,
             COUNT(*)::int AS count,
             COALESCE(SUM(sale_price), 0) AS revenue
      FROM card_sales
      ${whereClause}
      GROUP BY sale_date
      ORDER BY sale_date ASC
      LIMIT 30
    `, params);

    const { rows: platformShare } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: listingTypeShare } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: priceBuckets } = await client.query(`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN sale_price < 25 THEN 'Under $25'
            WHEN sale_price < 100 THEN '$25-$99'
            WHEN sale_price < 250 THEN '$100-$249'
            WHEN sale_price < 500 THEN '$250-$499'
            ELSE '$500+'
          END AS bucket,
          CASE
            WHEN sale_price < 25 THEN 1
            WHEN sale_price < 100 THEN 2
            WHEN sale_price < 250 THEN 3
            WHEN sale_price < 500 THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) buckets
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: conditionShare } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: salesByHour } = await client.query(`
      SELECT EXTRACT(HOUR FROM imported_at)::int AS hour,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY hour
      ORDER BY hour
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        salesByDay,
        platformShare,
        listingTypeShare,
        priceBuckets,
        conditionShare,
        salesByHour
      }
    });
  } catch (error) {
    console.error('Error fetching sales pulse data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/sales/platform-mix', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      WITH platform_counts AS (
        SELECT COALESCE(platform, 'Unknown') AS platform,
               COUNT(*)::numeric AS count
        FROM card_sales
        ${whereClause}
        GROUP BY COALESCE(platform, 'Unknown')
      ), totals AS (
        SELECT COUNT(*)::numeric AS total_sales,
               COALESCE(AVG(sale_price), 0) AS avg_price
        FROM card_sales
        ${whereClause}
      ), top_platform AS (
        SELECT platform, count
        FROM platform_counts
        ORDER BY count DESC
        LIMIT 1
      )
      SELECT
        (SELECT COUNT(*) FROM platform_counts)::int AS platform_count,
        (SELECT platform FROM top_platform) AS top_platform,
        (SELECT CASE WHEN totals.total_sales = 0 THEN 0 ELSE ROUND((top_platform.count / totals.total_sales) * 100, 1) END
         FROM totals, top_platform) AS top_platform_share,
        (SELECT avg_price FROM totals) AS avg_price
    `, params);

    const { rows: volumeByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: revenueByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(SUM(sale_price), 0) AS revenue
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY revenue DESC
    `, params);

    const { rows: avgPriceByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(AVG(sale_price), 0) AS avg_price
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY avg_price DESC
    `, params);

    const { rows: listingTypeByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(listing_type, 'Unknown') AS listing_type,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown'), COALESCE(listing_type, 'Unknown')
      ORDER BY platform, listing_type
    `, params);

    const { rows: ratingByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(AVG(seller_rating), 0) AS avg_rating
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY avg_rating DESC
    `, params);

    const { rows: shippingByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY avg_shipping DESC
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        volumeByPlatform,
        revenueByPlatform,
        avgPriceByPlatform,
        listingTypeByPlatform,
        ratingByPlatform,
        shippingByPlatform
      }
    });
  } catch (error) {
    console.error('Error fetching platform mix data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/sales/auction-vs-bin', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      WITH type_stats AS (
        SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
               COUNT(*)::numeric AS count,
               COALESCE(AVG(sale_price), 0) AS avg_price
        FROM card_sales
        ${whereClause}
        GROUP BY COALESCE(listing_type, 'Unknown')
      ), totals AS (
        SELECT COUNT(*)::numeric AS total_sales
        FROM card_sales
        ${whereClause}
      )
      SELECT
        (SELECT avg_price FROM type_stats WHERE listing_type ILIKE 'Auction' LIMIT 1) AS auction_avg_price,
        (SELECT avg_price FROM type_stats WHERE listing_type ILIKE 'BIN' LIMIT 1) AS bin_avg_price,
        (SELECT CASE WHEN total_sales = 0 THEN 0 ELSE ROUND((count / total_sales) * 100, 1) END
         FROM type_stats, totals WHERE listing_type ILIKE 'Auction' LIMIT 1) AS auction_share,
        (SELECT CASE WHEN bin.avg_price = 0 THEN 0 ELSE ROUND(((auc.avg_price / bin.avg_price) - 1) * 100, 1) END
         FROM (SELECT avg_price FROM type_stats WHERE listing_type ILIKE 'Auction' LIMIT 1) auc,
              (SELECT avg_price FROM type_stats WHERE listing_type ILIKE 'BIN' LIMIT 1) bin) AS price_premium_pct
    `, params);

    const { rows: countByType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: avgPriceByType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COALESCE(AVG(sale_price), 0) AS avg_price
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY avg_price DESC
    `, params);

    const { rows: priceBucketsByType } = await client.query(`
      SELECT listing_type, bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          COALESCE(listing_type, 'Unknown') AS listing_type,
          CASE
            WHEN sale_price < 25 THEN 'Under $25'
            WHEN sale_price < 100 THEN '$25-$99'
            WHEN sale_price < 250 THEN '$100-$249'
            WHEN sale_price < 500 THEN '$250-$499'
            ELSE '$500+'
          END AS bucket,
          CASE
            WHEN sale_price < 25 THEN 1
            WHEN sale_price < 100 THEN 2
            WHEN sale_price < 250 THEN 3
            WHEN sale_price < 500 THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY listing_type, bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: shippingByType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY avg_shipping DESC
    `, params);

    const { rows: conditionByType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COALESCE(condition, 'Unknown') AS condition,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown'), COALESCE(condition, 'Unknown')
      ORDER BY listing_type, count DESC
    `, params);

    const { rows: ratingByType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COALESCE(AVG(seller_rating), 0) AS avg_rating
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY avg_rating DESC
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        countByType,
        avgPriceByType,
        priceBucketsByType,
        shippingByType,
        conditionByType,
        ratingByType
      }
    });
  } catch (error) {
    console.error('Error fetching auction vs BIN data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/sales/condition-premiums', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      WITH condition_stats AS (
        SELECT COALESCE(condition, 'Unknown') AS condition,
               COUNT(*)::int AS count,
               COALESCE(AVG(sale_price), 0) AS avg_price
        FROM card_sales
        ${whereClause}
        GROUP BY COALESCE(condition, 'Unknown')
      ), psa10 AS (
        SELECT COALESCE(AVG(sale_price), 0) AS avg_price
        FROM card_sales
        ${appendWhere(whereClause, "condition ILIKE 'PSA 10'")}
      ), raw AS (
        SELECT COALESCE(AVG(sale_price), 0) AS avg_price
        FROM card_sales
        ${appendWhere(whereClause, "condition ILIKE 'Raw'")}
      )
      SELECT
        (SELECT condition FROM condition_stats ORDER BY count DESC LIMIT 1) AS top_condition,
        (SELECT avg_price FROM psa10) AS avg_psa10,
        (SELECT avg_price FROM raw) AS avg_raw,
        (SELECT CASE WHEN raw.avg_price = 0 THEN 0 ELSE ROUND(psa10.avg_price / raw.avg_price, 2) END
         FROM psa10, raw) AS premium_multiplier
    `, params);

    const { rows: avgPriceByCondition } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COALESCE(AVG(sale_price), 0) AS avg_price
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown')
      ORDER BY avg_price DESC
    `, params);

    const { rows: countByCondition } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: platformByCondition } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COALESCE(platform, 'Unknown') AS platform,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown'), COALESCE(platform, 'Unknown')
      ORDER BY condition, count DESC
    `, params);

    const { rows: listingTypeByCondition } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COALESCE(listing_type, 'Unknown') AS listing_type,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown'), COALESCE(listing_type, 'Unknown')
      ORDER BY condition, count DESC
    `, params);

    const { rows: shippingByCondition } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown')
      ORDER BY avg_shipping DESC
    `, params);

    const { rows: priceBucketsByCondition } = await client.query(`
      SELECT condition, bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          COALESCE(condition, 'Unknown') AS condition,
          CASE
            WHEN sale_price < 25 THEN 'Under $25'
            WHEN sale_price < 100 THEN '$25-$99'
            WHEN sale_price < 250 THEN '$100-$249'
            WHEN sale_price < 500 THEN '$250-$499'
            ELSE '$500+'
          END AS bucket,
          CASE
            WHEN sale_price < 25 THEN 1
            WHEN sale_price < 100 THEN 2
            WHEN sale_price < 250 THEN 3
            WHEN sale_price < 500 THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY condition, bucket, order_key
      ORDER BY order_key
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        avgPriceByCondition,
        countByCondition,
        platformByCondition,
        listingTypeByCondition,
        shippingByCondition,
        priceBucketsByCondition
      }
    });
  } catch (error) {
    console.error('Error fetching condition premium data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/sales/liquidity', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      WITH daily AS (
        SELECT sale_date::date AS date,
               COUNT(*)::int AS count
        FROM card_sales
        ${whereClause}
        GROUP BY sale_date
      )
      SELECT
        (SELECT COUNT(*)::int FROM card_sales) AS total_sales,
        (SELECT COALESCE(AVG(count), 0) FROM daily) AS avg_daily_sales,
        (SELECT COALESCE(MAX(count), 0) FROM daily) AS peak_day_sales,
        (SELECT COALESCE(AVG(sale_price), 0) FROM card_sales) AS avg_sale_price
    `, params);

    const { rows: salesByDay } = await client.query(`
      SELECT sale_date::date AS date,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY sale_date
      ORDER BY sale_date ASC
      LIMIT 30
    `, params);

    const { rows: revenueByDay } = await client.query(`
      SELECT sale_date::date AS date,
             COALESCE(SUM(sale_price), 0) AS revenue
      FROM card_sales
      ${whereClause}
      GROUP BY sale_date
      ORDER BY sale_date ASC
      LIMIT 30
    `, params);

    const { rows: salesByWeekday } = await client.query(`
      SELECT TO_CHAR(sale_date, 'Dy') AS weekday,
             EXTRACT(DOW FROM sale_date)::int AS weekday_index,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY weekday, weekday_index
      ORDER BY weekday_index
    `, params);

    const { rows: priceTierVolume } = await client.query(`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN sale_price < 25 THEN 'Under $25'
            WHEN sale_price < 100 THEN '$25-$99'
            WHEN sale_price < 250 THEN '$100-$249'
            WHEN sale_price < 500 THEN '$250-$499'
            ELSE '$500+'
          END AS bucket,
          CASE
            WHEN sale_price < 25 THEN 1
            WHEN sale_price < 100 THEN 2
            WHEN sale_price < 250 THEN 3
            WHEN sale_price < 500 THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: listingTypeShare } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY count DESC
    `, params);

    const { rows: quantityDistribution } = await client.query(`
      SELECT COALESCE(quantity, 1) AS quantity,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(quantity, 1)
      ORDER BY quantity ASC
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        salesByDay,
        revenueByDay,
        salesByWeekday,
        priceTierVolume,
        listingTypeShare,
        quantityDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching liquidity data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/sales/seller-quality', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      WITH rating_buckets AS (
        SELECT
          CASE
            WHEN seller_rating >= 4.8 THEN '4.8-5.0'
            WHEN seller_rating >= 4.5 THEN '4.5-4.79'
            WHEN seller_rating >= 4.0 THEN '4.0-4.49'
            WHEN seller_rating IS NULL THEN 'Unrated'
            ELSE '<4.0'
          END AS bucket,
          COALESCE(AVG(sale_price), 0) AS avg_price
        FROM card_sales
        ${whereClause}
        GROUP BY bucket
      )
      SELECT
        (SELECT COALESCE(AVG(seller_rating), 0) FROM card_sales ${whereClause}) AS avg_rating,
        (SELECT CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM(CASE WHEN seller_rating >= 4.8 THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) END FROM card_sales ${whereClause}) AS pct_high_rated,
        (SELECT avg_price FROM rating_buckets WHERE bucket = '4.8-5.0') AS avg_price_high,
        (SELECT avg_price FROM rating_buckets WHERE bucket = '<4.0') AS avg_price_low
    `, params);

    const { rows: ratingDistribution } = await client.query(`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN seller_rating >= 4.8 THEN '4.8-5.0'
            WHEN seller_rating >= 4.5 THEN '4.5-4.79'
            WHEN seller_rating >= 4.0 THEN '4.0-4.49'
            WHEN seller_rating IS NULL THEN 'Unrated'
            ELSE '<4.0'
          END AS bucket,
          CASE
            WHEN seller_rating >= 4.8 THEN 1
            WHEN seller_rating >= 4.5 THEN 2
            WHEN seller_rating >= 4.0 THEN 3
            WHEN seller_rating IS NULL THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: avgPriceByRating } = await client.query(`
      SELECT bucket,
             COALESCE(AVG(sale_price), 0) AS avg_price
      FROM (
        SELECT
          CASE
            WHEN seller_rating >= 4.8 THEN '4.8-5.0'
            WHEN seller_rating >= 4.5 THEN '4.5-4.79'
            WHEN seller_rating >= 4.0 THEN '4.0-4.49'
            WHEN seller_rating IS NULL THEN 'Unrated'
            ELSE '<4.0'
          END AS bucket,
          CASE
            WHEN seller_rating >= 4.8 THEN 1
            WHEN seller_rating >= 4.5 THEN 2
            WHEN seller_rating >= 4.0 THEN 3
            WHEN seller_rating IS NULL THEN 4
            ELSE 5
          END AS order_key,
          sale_price
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: platformRating } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(AVG(seller_rating), 0) AS avg_rating
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY avg_rating DESC
    `, params);

    const { rows: listingTypeByRating } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             CASE
               WHEN seller_rating >= 4.8 THEN '4.8-5.0'
               WHEN seller_rating >= 4.5 THEN '4.5-4.79'
               WHEN seller_rating >= 4.0 THEN '4.0-4.49'
               WHEN seller_rating IS NULL THEN 'Unrated'
               ELSE '<4.0'
             END AS bucket,
             COUNT(*)::int AS count
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown'), bucket
      ORDER BY listing_type
    `, params);

    const { rows: shippingByRating } = await client.query(`
      SELECT bucket,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM (
        SELECT
          CASE
            WHEN seller_rating >= 4.8 THEN '4.8-5.0'
            WHEN seller_rating >= 4.5 THEN '4.5-4.79'
            WHEN seller_rating >= 4.0 THEN '4.0-4.49'
            WHEN seller_rating IS NULL THEN 'Unrated'
            ELSE '<4.0'
          END AS bucket,
          CASE
            WHEN seller_rating >= 4.8 THEN 1
            WHEN seller_rating >= 4.5 THEN 2
            WHEN seller_rating >= 4.0 THEN 3
            WHEN seller_rating IS NULL THEN 4
            ELSE 5
          END AS order_key,
          shipping_cost
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: salesByRating } = await client.query(`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN seller_rating >= 4.8 THEN '4.8-5.0'
            WHEN seller_rating >= 4.5 THEN '4.5-4.79'
            WHEN seller_rating >= 4.0 THEN '4.0-4.49'
            WHEN seller_rating IS NULL THEN 'Unrated'
            ELSE '<4.0'
          END AS bucket,
          CASE
            WHEN seller_rating >= 4.8 THEN 1
            WHEN seller_rating >= 4.5 THEN 2
            WHEN seller_rating >= 4.0 THEN 3
            WHEN seller_rating IS NULL THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        ratingDistribution,
        avgPriceByRating,
        platformRating,
        listingTypeByRating,
        shippingByRating,
        salesByRating
      }
    });
  } catch (error) {
    console.error('Error fetching seller quality data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.get('/api/sales/shipping-impact', async (req, res) => {
  const client = await pool.connect();
  try {
    const { whereClause, params } = buildSalesWhere(req);
    const decisionSignals = await fetchDecisionSignals(client, whereClause, params);
    const { rows: [kpis] } = await client.query(`
      SELECT
        COALESCE(AVG(shipping_cost), 0) AS avg_shipping,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(shipping_cost, 0)), 0) AS median_shipping,
        COALESCE(AVG(CASE WHEN sale_price = 0 THEN 0 ELSE (COALESCE(shipping_cost, 0) / sale_price) * 100 END), 0) AS shipping_pct_price,
        CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((SUM(CASE WHEN COALESCE(shipping_cost, 0) = 0 THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) END AS free_shipping_share
      FROM card_sales
      ${whereClause}
    `, params);

    const { rows: shippingDistribution } = await client.query(`
      SELECT bucket, COUNT(*)::int AS count
      FROM (
        SELECT
          CASE
            WHEN COALESCE(shipping_cost, 0) = 0 THEN 'Free'
            WHEN shipping_cost < 5 THEN 'Under $5'
            WHEN shipping_cost < 10 THEN '$5-$9'
            WHEN shipping_cost < 20 THEN '$10-$19'
            ELSE '$20+'
          END AS bucket,
          CASE
            WHEN COALESCE(shipping_cost, 0) = 0 THEN 1
            WHEN shipping_cost < 5 THEN 2
            WHEN shipping_cost < 10 THEN 3
            WHEN shipping_cost < 20 THEN 4
            ELSE 5
          END AS order_key
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: shippingByPlatform } = await client.query(`
      SELECT COALESCE(platform, 'Unknown') AS platform,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(platform, 'Unknown')
      ORDER BY avg_shipping DESC
    `, params);

    const { rows: shippingByListingType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY avg_shipping DESC
    `, params);

    const { rows: shippingByCondition } = await client.query(`
      SELECT COALESCE(condition, 'Unknown') AS condition,
             COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(condition, 'Unknown')
      ORDER BY avg_shipping DESC
    `, params);

    const { rows: shippingByPriceTier } = await client.query(`
      SELECT bucket, COALESCE(AVG(shipping_cost), 0) AS avg_shipping
      FROM (
        SELECT
          CASE
            WHEN sale_price < 25 THEN 'Under $25'
            WHEN sale_price < 100 THEN '$25-$99'
            WHEN sale_price < 250 THEN '$100-$249'
            WHEN sale_price < 500 THEN '$250-$499'
            ELSE '$500+'
          END AS bucket,
          CASE
            WHEN sale_price < 25 THEN 1
            WHEN sale_price < 100 THEN 2
            WHEN sale_price < 250 THEN 3
            WHEN sale_price < 500 THEN 4
            ELSE 5
          END AS order_key,
          shipping_cost
        FROM card_sales
        ${whereClause}
      ) bucketed
      GROUP BY bucket, order_key
      ORDER BY order_key
    `, params);

    const { rows: totalCostByListingType } = await client.query(`
      SELECT COALESCE(listing_type, 'Unknown') AS listing_type,
             COALESCE(AVG(COALESCE(sale_price, 0) + COALESCE(shipping_cost, 0)), 0) AS avg_total_cost
      FROM card_sales
      ${whereClause}
      GROUP BY COALESCE(listing_type, 'Unknown')
      ORDER BY avg_total_cost DESC
    `, params);

    res.json({
      kpis,
      decisionSignals,
      charts: {
        shippingDistribution,
        shippingByPlatform,
        shippingByListingType,
        shippingByCondition,
        shippingByPriceTier,
        totalCostByListingType
      }
    });
  } catch (error) {
    console.error('Error fetching shipping impact data:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ============================================================================
// AUTOCOMPLETE ENDPOINTS
// ============================================================================

app.get('/api/autocomplete/players', async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const client = await pool.connect();
    
    const { rows } = await client.query(`
      SELECT DISTINCT player_name
      FROM matched_cards_final
      WHERE player_name ILIKE $1
      ORDER BY player_name
      LIMIT $2
    `, [`%${q}%`, limit]);
    
    client.release();
    res.json(rows.map(r => r.player_name));
  } catch (error) {
    console.error('Error fetching player autocomplete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/autocomplete/consoles', async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const client = await pool.connect();
    
    const { rows } = await client.query(`
      SELECT DISTINCT console_name
      FROM matched_cards_final
      WHERE console_name ILIKE $1
      ORDER BY console_name
      LIMIT $2
    `, [`%${q}%`, limit]);
    
    client.release();
    res.json(rows.map(r => r.console_name));
  } catch (error) {
    console.error('Error fetching console autocomplete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/autocomplete/parallels', async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const client = await pool.connect();
    
    const { rows } = await client.query(`
      SELECT DISTINCT parallel
      FROM matched_cards_final
      WHERE parallel ILIKE $1
      ORDER BY parallel
      LIMIT $2
    `, [`%${q}%`, limit]);
    
    client.release();
    res.json(rows.map(r => r.parallel));
  } catch (error) {
    console.error('Error fetching parallel autocomplete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/intelligence/parallel-performance', async (req, res) => {
  try {
    const { console_name, limit = 50 } = req.query;
    const client = await pool.connect();
    
    let query = 'SELECT * FROM vw_parallel_performance';
    const params = [];
    
    if (console_name) {
      query += ' WHERE console_name ILIKE $1';
      params.push(`%${console_name}%`);
    }
    
    query += ' ORDER BY expected_roi DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const { rows } = await client.query(query, params);
    
    client.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching parallel performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/intelligence/stats', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Overall statistics
    const { rows: [stats] } = await client.query(`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(DISTINCT player_name) as total_players,
        COUNT(DISTINCT parallel) as total_parallels,
        ROUND(AVG(loose_price), 2) as avg_loose_price,
        ROUND(AVG(bgs_10_price), 2) as avg_psa10_price,
        SUM(sales_volume) as total_sales_volume
      FROM matched_cards_final
      WHERE loose_price > 0
    `);
    
    // Top opportunities count
    const { rows: [opportunities] } = await client.query(`
      SELECT COUNT(*) as count FROM vw_investment_opportunities
      WHERE investment_score >= 50
    `);
    
    // Active alerts count
    const { rows: [alerts] } = await client.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE priority = 'Critical') as critical_alerts,
        COUNT(*) FILTER (WHERE priority = 'High') as high_alerts
      FROM vw_opportunity_alerts
    `);
    
    client.release();
    res.json({
      ...stats,
      high_value_opportunities: opportunities.count,
      ...alerts
    });
  } catch (error) {
    console.error('Error fetching intelligence stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/intelligence/dashboard', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // KPI Stats
    const { rows: [kpis] } = await client.query(`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(DISTINCT player_name) as total_players,
        COUNT(DISTINCT parallel) as total_parallels,
        ROUND(AVG(CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC)), 1) as avg_gem_rate,
        ROUND(AVG(bgs_10_price / NULLIF(loose_price, 0)), 2) as avg_premium,
        SUM(sales_volume) as total_sales,
        ROUND(AVG(loose_price), 2) as avg_raw_price,
        ROUND(AVG(bgs_10_price), 2) as avg_psa10_price
      FROM matched_cards_final
      WHERE loose_price > 0 AND bgs_10_price > 0
    `);
    
    // Opportunity counts by type
    const { rows: opportunityTypes } = await client.query(`
      SELECT opportunity_type, COUNT(*) as count
      FROM vw_investment_opportunities
      GROUP BY opportunity_type
      ORDER BY count DESC
    `);
    
    // Alert priority distribution
    const { rows: alertPriority } = await client.query(`
      SELECT priority, COUNT(*) as count
      FROM vw_opportunity_alerts
      GROUP BY priority
      ORDER BY CASE priority 
        WHEN 'Critical' THEN 1 
        WHEN 'High' THEN 2 
        WHEN 'Medium' THEN 3 
        ELSE 4 END
    `);
    
    // Gem rate distribution
    const { rows: gemRateDistribution } = await client.query(`
      SELECT 
        CASE 
          WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) < 10 THEN '<10%'
          WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) < 20 THEN '10-20%'
          WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) < 30 THEN '20-30%'
          WHEN CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC) < 40 THEN '30-40%'
          ELSE '40%+'
        END as gem_rate_range,
        COUNT(*) as count
      FROM matched_cards_final
      WHERE gem_rate_all_time IS NOT NULL
      GROUP BY gem_rate_range
      ORDER BY gem_rate_range
    `);
    
    // Premium multiplier distribution
    const { rows: premiumDistribution } = await client.query(`
      SELECT 
        CASE 
          WHEN bgs_10_price / NULLIF(loose_price, 0) < 5 THEN '<5x'
          WHEN bgs_10_price / NULLIF(loose_price, 0) < 10 THEN '5-10x'
          WHEN bgs_10_price / NULLIF(loose_price, 0) < 15 THEN '10-15x'
          WHEN bgs_10_price / NULLIF(loose_price, 0) < 20 THEN '15-20x'
          ELSE '20x+'
        END as premium_range,
        COUNT(*) as count
      FROM matched_cards_final
      WHERE loose_price > 0 AND bgs_10_price > 0
      GROUP BY premium_range
      ORDER BY premium_range
    `);
    
    // Top 10 players by total graded
    const { rows: topPlayers } = await client.query(`
      SELECT player_name, total_cards_graded, avg_gem_rate_pct, avg_grade_premium
      FROM vw_player_grading_profiles
      ORDER BY total_cards_graded DESC
      LIMIT 10
    `);
    
    // Market efficiency breakdown
    const { rows: efficiencyBreakdown } = await client.query(`
      SELECT pricing_efficiency, COUNT(*) as count
      FROM vw_market_efficiency
      GROUP BY pricing_efficiency
      ORDER BY count DESC
    `);
    
    // Investment score distribution
    const { rows: scoreDistribution } = await client.query(`
      SELECT 
        CASE 
          WHEN investment_score >= 80 THEN '80-100'
          WHEN investment_score >= 60 THEN '60-79'
          WHEN investment_score >= 40 THEN '40-59'
          WHEN investment_score >= 20 THEN '20-39'
          ELSE '0-19'
        END as score_range,
        COUNT(*) as count
      FROM vw_investment_opportunities
      GROUP BY score_range
      ORDER BY score_range DESC
    `);
    
    // Grading difficulty distribution
    const { rows: difficultyDistribution } = await client.query(`
      SELECT grading_difficulty, COUNT(*) as count
      FROM vw_grading_intelligence
      GROUP BY grading_difficulty
      ORDER BY CASE grading_difficulty
        WHEN 'Extremely Difficult' THEN 1
        WHEN 'Very Difficult' THEN 2
        WHEN 'Difficult' THEN 3
        WHEN 'Moderate' THEN 4
        ELSE 5 END
    `);
    
    // Top parallels by average gem rate
    const { rows: topParallels } = await client.query(`
      SELECT 
        parallel,
        ROUND(AVG(CAST(REPLACE(gem_rate_all_time, '%', '') AS NUMERIC)), 1) as avg_gem_rate,
        COUNT(*) as card_count
      FROM matched_cards_final
      WHERE gem_rate_all_time IS NOT NULL
      GROUP BY parallel
      HAVING COUNT(*) >= 5
      ORDER BY avg_gem_rate DESC
      LIMIT 10
    `);
    
    // Price range distribution
    const { rows: priceDistribution } = await client.query(`
      SELECT 
        CASE 
          WHEN loose_price < 5 THEN '<$5'
          WHEN loose_price < 10 THEN '$5-$10'
          WHEN loose_price < 20 THEN '$10-$20'
          WHEN loose_price < 50 THEN '$20-$50'
          ELSE '$50+'
        END as price_range,
        COUNT(*) as count
      FROM matched_cards_final
      WHERE loose_price > 0
      GROUP BY price_range
      ORDER BY price_range
    `);
    
    // Expected value distribution
    const { rows: evDistribution } = await client.query(`
      SELECT 
        CASE 
          WHEN expected_value < 0 THEN 'Negative'
          WHEN expected_value < 10 THEN '$0-$10'
          WHEN expected_value < 25 THEN '$10-$25'
          WHEN expected_value < 50 THEN '$25-$50'
          ELSE '$50+'
        END as ev_range,
        COUNT(*) as count
      FROM vw_grading_intelligence
      GROUP BY ev_range
      ORDER BY ev_range
    `);
    
    client.release();
    
    res.json({
      kpis,
      charts: {
        opportunityTypes,
        alertPriority,
        gemRateDistribution,
        premiumDistribution,
        topPlayers,
        efficiencyBreakdown,
        scoreDistribution,
        difficultyDistribution,
        topParallels,
        priceDistribution,
        evDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// EXISTING CARD ROUTES
// ============================================================================

// Specific card routes MUST come before /api/cards/:id
app.get('/api/cards/top-movers', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || 50), 100);
    const client = await pool.connect();
    
    const { rows } = await client.query(`
      WITH recent_sales AS (
        SELECT 
          card_id, 
          sale_price, 
          sale_date,
          ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY sale_date DESC) as rn_desc,
          ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY sale_date ASC) as rn_asc
        FROM card_sales 
        WHERE sale_price > 0
      ),
      card_diffs AS (
        SELECT 
          latest.card_id, 
          latest.sale_price as latest_price,
          ROUND(((latest.sale_price - earliest.sale_price) / earliest.sale_price * 100)::numeric, 2) as calc_pct
        FROM (SELECT * FROM recent_sales WHERE rn_desc = 1) latest
        JOIN (SELECT * FROM recent_sales WHERE rn_asc = 1) earliest ON latest.card_id = earliest.card_id
        WHERE earliest.sale_price > 0 AND latest.sale_price != earliest.sale_price
      )
      SELECT 
        c.id as card_id,
        COALESCE(ccm.product_name, c.card_name) as product_name,
        COALESCE(ccm.console_name, c.set_name, 'Standard') as console_name,
        ROUND(COALESCE(cd.latest_price, ccm.avg_price, ccm.loose_price, 0)::numeric, 2) as loose_price,
        COALESCE(cd.calc_pct, ccm.price_change_pct, ccm.price_change_30d, 0) as price_change_pct,
        COALESCE(ccm.volume_30d, ccm.sales_volume, 1) as sales_volume,
        COALESCE(ccm.trend_state, CASE WHEN cd.calc_pct > 0 THEN 'up' ELSE 'down' END) as trend_state
      FROM card_diffs cd
      JOIN cards c ON cd.card_id::text = c.id::text
      LEFT JOIN card_computed_metrics ccm ON c.id::text = ccm.card_id::text
      ORDER BY ABS(cd.calc_pct) DESC
      LIMIT $1
    `, [limit]);
    
    client.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top movers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cards/volatility', async (req, res) => {
  try {
    const client = await pool.connect();
    const latestDate = await client.query(`
      SELECT MAX(date) as latest
      FROM card_computed_metrics
      WHERE loose_price_volatility IS NOT NULL
        AND loose_price IS NOT NULL
    `);
    const date = latestDate.rows[0].latest;

    if (!date) {
      client.release();
      return res.json([]);
    }
    
    const { rows } = await client.query(`
      SELECT 
        card_id,
        product_name,
        console_name,
        loose_price,
        loose_price_volatility,
        price_change_pct,
        sales_volume
      FROM card_computed_metrics
      WHERE date = $1
        AND loose_price_volatility IS NOT NULL
        AND loose_price IS NOT NULL
      ORDER BY loose_price_volatility DESC
      LIMIT 100
    `, [date]);
    
    client.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching volatility data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cards/grading-premium', async (req, res) => {
  try {
    const client = await pool.connect();
    const latestDate = await client.query('SELECT MAX(date) as latest FROM card_computed_metrics');
    const date = latestDate.rows[0].latest;
    
    const { rows } = await client.query(`
      SELECT 
        card_id,
        product_name,
        console_name,
        loose_price,
        psa10_price,
        ROUND(((psa10_price - loose_price) / NULLIF(loose_price, 0) * 100)::numeric, 2) as premium_pct,
        sales_volume
      FROM card_computed_metrics
      WHERE date = $1
        AND loose_price IS NOT NULL
        AND psa10_price IS NOT NULL
        AND loose_price > 0
        AND psa10_price > loose_price
      ORDER BY ((psa10_price - loose_price) / NULLIF(loose_price, 0)) DESC
      LIMIT 50
    `, [date]);
    
    client.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching grading premium data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cards', async (req, res) => {
  try {
    const { 
      search, 
      limit = 50, 
      offset = 0,
      trendState,
      minLiquidity,
      maxLiquidity,
      minMomentum,
      maxMomentum,
      minOpportunity,
      maxOpportunity,
      riskLevel
    } = req.query;
    
    const client = await pool.connect();
    
    const conditions = ['ccm.loose_price IS NOT NULL'];
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`(ccm.product_name ILIKE $${paramIndex} OR ccm.console_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (trendState) {
      conditions.push(`ccm.trend_state = $${paramIndex}`);
      params.push(trendState);
      paramIndex++;
    }
    
    if (minLiquidity) {
      conditions.push(`(ccm.sales_volume / 100.0) >= $${paramIndex}`);
      params.push(Number(minLiquidity));
      paramIndex++;
    }
    
    if (maxLiquidity) {
      conditions.push(`(ccm.sales_volume / 100.0) <= $${paramIndex}`);
      params.push(Number(maxLiquidity));
      paramIndex++;
    }
    
    if (minMomentum) {
      conditions.push(`ccm.price_change_pct >= $${paramIndex}`);
      params.push(Number(minMomentum));
      paramIndex++;
    }
    
    if (maxMomentum) {
      conditions.push(`ccm.price_change_pct <= $${paramIndex}`);
      params.push(Number(maxMomentum));
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    const query = `
      WITH latest_metrics AS (
        SELECT DISTINCT ON (ccm.card_id)
          ccm.card_id,
          ccm.product_name,
          ccm.console_name,
          ccm.loose_price,
          ccm.sales_volume,
          ccm.price_change_pct,
          ccm.trend_state,
          ccm.date,
          -- Calculated metrics from available columns
          LEAST(ccm.sales_volume / 100.0, 1.0) as liquidity_score,
          ccm.price_change_pct as momentum,
          ABS(ccm.price_change_pct) as volatility,
          -- Opportunity Score (simplified based on available columns)
          LEAST(100, GREATEST(0, ROUND((
            CASE WHEN ccm.trend_state = 'Rising' THEN 50 ELSE 0 END +
            (LEAST(ccm.sales_volume / 100.0, 1.0) * 30) +
            (COALESCE(ccm.price_change_pct, 0) * 20)
          )::numeric, 0))) as opportunity_score,
          -- Risk level
          CASE
            WHEN ABS(ccm.price_change_pct) > 25 THEN 'High'
            WHEN ABS(ccm.price_change_pct) > 10 THEN 'Medium'
            ELSE 'Low'
          END as risk_level
        FROM card_computed_metrics ccm
        WHERE ${whereClause}
        ORDER BY ccm.card_id, ccm.date DESC
      )
      SELECT 
        *,
        COUNT(*) OVER() as total_count
      FROM latest_metrics
      ORDER BY opportunity_score DESC, loose_price DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const { rows } = await client.query(query, params);
    
    client.release();
    
    res.json({
      cards: rows,
      total: rows.length > 0 ? rows[0].total_count : 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 90 } = req.query;
    const client = await pool.connect();
    
    // Card details with full intelligence metrics
    const { rows: [card] } = await client.query(`
      SELECT 
        ccm.card_id,
        ccm.product_name,
        ccm.console_name,
        ccm.loose_price,
        ccm.sales_volume,
        ccm.price_change_pct,
        ccm.trend_state,
        ccm.date,
        -- Calculated metrics
        ccm.price_change_pct as momentum,
        LEAST(ccm.sales_volume / 100.0, 1.0) as liquidity_score,
        ABS(ccm.price_change_pct) as volatility,
        -- Opportunity Score (simplified)
        LEAST(100, GREATEST(0, ROUND((
          CASE WHEN ccm.trend_state = 'Rising' THEN 50 ELSE 0 END +
          (LEAST(ccm.sales_volume / 100.0, 1.0) * 30) +
          (COALESCE(ccm.price_change_pct, 0) * 20)
        )::numeric, 0))) as opportunity_score,
        -- Risk Metrics
        CASE
          WHEN ABS(ccm.price_change_pct) > 25 THEN 'High'
          WHEN ABS(ccm.price_change_pct) > 10 THEN 'Medium'
          ELSE 'Low'
        END as risk_level,
        CASE
          WHEN ccm.price_change_pct < -5 THEN 'High'
          WHEN ccm.price_change_pct < 0 THEN 'Medium'
          ELSE 'Low'
        END as trend_break_risk,
        CASE
          WHEN ccm.sales_volume >= 100 THEN 95
          WHEN ccm.sales_volume >= 50 THEN 80
          WHEN ccm.sales_volume >= 20 THEN 60
          WHEN ccm.sales_volume >= 10 THEN 40
          ELSE 20
        END as data_confidence_score
      FROM card_computed_metrics ccm
      WHERE ccm.card_id = $1
      ORDER BY ccm.date DESC
      LIMIT 1
    `, [id]);
    
    // Historical data
    const { rows: history } = await client.query(`
      SELECT 
        date,
        loose_price,
        sales_volume,
        price_change_pct,
        trend_state,
        price_change_pct as momentum,
        LEAST(sales_volume / 100.0, 1.0) as liquidity_score
      FROM card_computed_metrics
      WHERE card_id = $1
        AND date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date ASC
    `, [id]);
    
    client.release();
    
    res.json({ card, history });
  } catch (error) {
    console.error('Error fetching card details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sets', async (req, res) => {
  try {
    const { 
      search, 
      limit = 50, 
      offset = 0,
      minOpportunity,
      trendState,
      minLiquidity
    } = req.query;
    
    const client = await pool.connect();
    
    const conditions = ['ccm.loose_price IS NOT NULL'];
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`(s.console_name ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    const query = `
      WITH set_metrics AS (
        SELECT 
          s.id,
          s.console_name,
          s.name,
          COUNT(ccm.card_id) as card_count,
          ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
          ROUND(MAX(ccm.loose_price)::numeric, 2) as max_price,
          ROUND(MIN(ccm.loose_price)::numeric, 2) as min_price,
          SUM(ccm.sales_volume)::bigint as total_volume,
          COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count,
          COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END) as declining_count,
          COUNT(CASE WHEN ccm.trend_state = 'Stable' THEN 1 END) as stable_count,
          AVG(ccm.price_change_pct) as avg_momentum,
          AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) as avg_liquidity,
          AVG(ABS(ccm.price_change_pct)) as avg_volatility,
          MAX(ccm.date) as last_updated,
          -- Opportunity Score (simplified based on available columns)
          LEAST(100, GREATEST(0, ROUND((
            (COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 50) +
            (AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) * 30) +
            (AVG(COALESCE(ccm.price_change_pct, 0)) * 20)
          )::numeric, 0))) as opportunity_score,
          -- Trend classification
          CASE 
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Rising'
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Declining'
            ELSE 'Mixed'
          END as set_trend,
          -- Risk score (based on volatility)
          ROUND((AVG(ABS(ccm.price_change_pct)) * 100)::numeric, 1) as risk_score
        FROM sets s
        LEFT JOIN cards c ON s.id = c.set_id
        LEFT JOIN card_computed_metrics ccm ON c.id = ccm.card_id
        WHERE ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
          AND ${whereClause}
        GROUP BY s.id, s.console_name, s.name
      )
      SELECT 
        *,
        COUNT(*) OVER() as total_count
      FROM set_metrics
      ${minOpportunity ? `WHERE opportunity_score >= ${Number(minOpportunity)}` : ''}
      ${trendState ? `${minOpportunity ? 'AND' : 'WHERE'} set_trend = '${trendState}'` : ''}
      ${minLiquidity ? `${minOpportunity || trendState ? 'AND' : 'WHERE'} avg_liquidity >= ${Number(minLiquidity)}` : ''}
      ORDER BY opportunity_score DESC, avg_price DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const { rows } = await client.query(query, params);
    
    client.release();
    
    res.json({
      sets: rows,
      total: rows.length > 0 ? rows[0].total_count : 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching sets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 90 } = req.query;
    const client = await pool.connect();
    
    // Set details
    const { rows: [set] } = await client.query(`
      SELECT 
        s.id,
        s.console_name,
        s.name,
        s.slug,
        s.sport_id,
        COUNT(ccm.card_id) as card_count,
        ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
        ROUND(MAX(ccm.loose_price)::numeric, 2) as max_price,
        ROUND(MIN(ccm.loose_price)::numeric, 2) as min_price,
        SUM(ccm.sales_volume)::bigint as total_volume,
        COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count,
        COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END) as declining_count,
        COUNT(CASE WHEN ccm.trend_state = 'Stable' THEN 1 END) as stable_count,
        MAX(ccm.date) as last_updated
      FROM sets s
      LEFT JOIN cards c ON s.id = c.set_id
      LEFT JOIN card_computed_metrics ccm ON c.id = ccm.card_id
      WHERE s.id = $1
        AND ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
      GROUP BY s.id, s.console_name, s.name, s.slug, s.sport_id
    `, [id]);
    
    // Top cards in set
    const { rows: topCards } = await client.query(`
      SELECT 
        ccm.card_id,
        ccm.product_name,
        ccm.loose_price,
        ccm.graded_price,
        ccm.psa10_price,
        ccm.sales_volume,
        ccm.price_change_pct,
        ccm.trend_state
      FROM card_computed_metrics ccm
      JOIN cards c ON ccm.card_id = c.id
      WHERE c.set_id = $1
        AND ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
        AND ccm.loose_price IS NOT NULL
      ORDER BY ccm.loose_price DESC
      LIMIT 20
    `, [id]);
    
    // Historical set metrics
    const { rows: history } = await client.query(`
      SELECT 
        ccm.date,
        ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
        SUM(ccm.sales_volume)::bigint as total_volume,
        COUNT(*) as card_count,
        COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count
      FROM card_computed_metrics ccm
      JOIN cards c ON ccm.card_id = c.id
      WHERE c.set_id = $1
        AND ccm.date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY ccm.date
      ORDER BY ccm.date ASC
    `, [id]);
    
    client.release();
    
    res.json({ set, topCards, history });
  } catch (error) {
    console.error('Error fetching set details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Players API with comprehensive metrics
app.get('/api/players', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0, minOpportunity, sport } = req.query;
    const client = await pool.connect();
    
    const conditions = ['ccm.loose_price IS NOT NULL'];
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      conditions.push(`ccm.product_name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    const query = `
      WITH player_metrics AS (
        SELECT 
          ccm.product_name as player_name,
          COUNT(DISTINCT ccm.card_id) as card_count,
          ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
          ROUND(MAX(ccm.loose_price)::numeric, 2) as max_price,
          SUM(ccm.sales_volume)::bigint as total_volume,
          AVG(ccm.price_change_pct) as avg_momentum,
          AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) as avg_liquidity,
          COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count,
          COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END) as declining_count,
          LEAST(100, GREATEST(0, ROUND((
            (COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 50) +
            (AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) * 30) +
            (AVG(COALESCE(ccm.price_change_pct, 0)) * 20)
          )::numeric, 0))) as opportunity_score,
          CASE 
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Rising'
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Declining'
            ELSE 'Mixed'
          END as player_trend,
          ROUND((AVG(ABS(ccm.price_change_pct)) * 100)::numeric, 1) as risk_score
        FROM card_computed_metrics ccm
        WHERE ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
          AND ${whereClause}
        GROUP BY ccm.product_name
        HAVING COUNT(DISTINCT ccm.card_id) >= 3
      )
      SELECT *, COUNT(*) OVER() as total_count
      FROM player_metrics
      ${minOpportunity ? `WHERE opportunity_score >= ${Number(minOpportunity)}` : ''}
      ORDER BY opportunity_score DESC, avg_price DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const { rows } = await client.query(query, params);
    client.release();
    
    res.json({
      players: rows,
      total: rows.length > 0 ? rows[0].total_count : 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sports API with comprehensive metrics
app.get('/api/sports', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const client = await pool.connect();
    
    const query = `
      WITH sport_metrics AS (
        SELECT 
          'Basketball' as sport_name,
          COUNT(DISTINCT ccm.card_id) as card_count,
          ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
          ROUND(MAX(ccm.loose_price)::numeric, 2) as max_price,
          SUM(ccm.sales_volume)::bigint as total_volume,
          AVG(ccm.price_change_pct) as avg_momentum,
          AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) as avg_liquidity,
          COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count,
          COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END) as declining_count,
          LEAST(100, GREATEST(0, ROUND((
            (COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 50) +
            (AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) * 30) +
            (AVG(COALESCE(ccm.price_change_pct, 0)) * 20)
          )::numeric, 0))) as opportunity_score,
          CASE 
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Rising'
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Declining'
            ELSE 'Mixed'
          END as sport_trend,
          ROUND((AVG(ABS(ccm.price_change_pct)) * 100)::numeric, 1) as risk_score
        FROM card_computed_metrics ccm
        WHERE ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
          AND ccm.loose_price IS NOT NULL
          AND ccm.console_name ILIKE '%basketball%'
        
        UNION ALL
        
        SELECT 
          'Baseball' as sport_name,
          COUNT(DISTINCT ccm.card_id) as card_count,
          ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
          ROUND(MAX(ccm.loose_price)::numeric, 2) as max_price,
          SUM(ccm.sales_volume)::bigint as total_volume,
          AVG(ccm.price_change_pct) as avg_momentum,
          AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) as avg_liquidity,
          COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count,
          COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END) as declining_count,
          LEAST(100, GREATEST(0, ROUND((
            (COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 50) +
            (AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) * 30) +
            (AVG(COALESCE(ccm.price_change_pct, 0)) * 20)
          )::numeric, 0))) as opportunity_score,
          CASE 
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Rising'
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Declining'
            ELSE 'Mixed'
          END as sport_trend,
          ROUND((AVG(ABS(ccm.price_change_pct)) * 100)::numeric, 1) as risk_score
        FROM card_computed_metrics ccm
        WHERE ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
          AND ccm.loose_price IS NOT NULL
          AND ccm.console_name ILIKE '%baseball%'
        
        UNION ALL
        
        SELECT 
          'Football' as sport_name,
          COUNT(DISTINCT ccm.card_id) as card_count,
          ROUND(AVG(ccm.loose_price)::numeric, 2) as avg_price,
          ROUND(MAX(ccm.loose_price)::numeric, 2) as max_price,
          SUM(ccm.sales_volume)::bigint as total_volume,
          AVG(ccm.price_change_pct) as avg_momentum,
          AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) as avg_liquidity,
          COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END) as rising_count,
          COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END) as declining_count,
          LEAST(100, GREATEST(0, ROUND((
            (COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 50) +
            (AVG(LEAST(ccm.sales_volume / 100.0, 1.0)) * 30) +
            (AVG(COALESCE(ccm.price_change_pct, 0)) * 20)
          )::numeric, 0))) as opportunity_score,
          CASE 
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Rising' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Rising'
            WHEN COUNT(CASE WHEN ccm.trend_state = 'Declining' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'Declining'
            ELSE 'Mixed'
          END as sport_trend,
          ROUND((AVG(ABS(ccm.price_change_pct)) * 100)::numeric, 1) as risk_score
        FROM card_computed_metrics ccm
        WHERE ccm.date = (SELECT MAX(date) FROM card_computed_metrics)
          AND ccm.loose_price IS NOT NULL
          AND ccm.console_name ILIKE '%football%'
      )
      SELECT *, COUNT(*) OVER() as total_count
      FROM sport_metrics
      ORDER BY opportunity_score DESC
      LIMIT $1 OFFSET $2
    `;
    
    const { rows } = await client.query(query, [limit, offset]);
    client.release();
    
    res.json({
      sports: rows,
      total: rows.length > 0 ? rows[0].total_count : 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching sports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard data
app.get('/api/dashboard', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Key metrics from card_computed_metrics (falling back to cards/matched_cards_final if needed)
    const { rows: metrics } = await client.query(`
      SELECT 
        COUNT(DISTINCT ccm.card_id) as total_cards,
        COUNT(DISTINCT c.set_id) as total_sets,
        ROUND(AVG(COALESCE(ccm.avg_price, ccm.loose_price, 0))::numeric, 2) as avg_card_price,
        COALESCE(SUM(COALESCE(ccm.sales_volume, ccm.volume_30d, 0)), 0)::bigint as total_volume,
        COUNT(CASE WHEN ccm.trend_state ILIKE '%rising%' OR ccm.trend_state ILIKE '%up%' THEN 1 END) as rising_cards,
        COUNT(CASE WHEN ccm.trend_state ILIKE '%declining%' OR ccm.trend_state ILIKE '%down%' THEN 1 END) as declining_cards,
        COUNT(CASE WHEN ccm.trend_state ILIKE '%stable%' OR ccm.trend_state ILIKE '%flat%' THEN 1 END) as stable_cards
      FROM card_computed_metrics ccm
      LEFT JOIN cards c ON ccm.card_id::text = c.id::text
    `);
    
    // Top movers (calculated from recent sales deltas or computed metrics)
    const { rows: topMovers } = await client.query(`
      WITH recent_sales AS (
        SELECT 
          card_id, 
          sale_price, 
          sale_date,
          ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY sale_date DESC) as rn_desc,
          ROW_NUMBER() OVER (PARTITION BY card_id ORDER BY sale_date ASC) as rn_asc
        FROM card_sales 
        WHERE sale_price > 0
      ),
      card_diffs AS (
        SELECT 
          latest.card_id, 
          latest.sale_price as latest_price,
          ROUND(((latest.sale_price - earliest.sale_price) / earliest.sale_price * 100)::numeric, 2) as calc_pct
        FROM (SELECT * FROM recent_sales WHERE rn_desc = 1) latest
        JOIN (SELECT * FROM recent_sales WHERE rn_asc = 1) earliest ON latest.card_id = earliest.card_id
        WHERE earliest.sale_price > 0 AND latest.sale_price != earliest.sale_price
      )
      SELECT 
        COALESCE(ccm.product_name, c.card_name) as product_name,
        COALESCE(ccm.console_name, c.set_name) as console_name,
        COALESCE(cd.latest_price, ccm.avg_price, 0) as loose_price,
        COALESCE(cd.calc_pct, ccm.price_change_pct, ccm.price_change_30d, 0) as price_change_pct,
        COALESCE(ccm.volume_30d, ccm.sales_volume, 1) as sales_volume
      FROM card_diffs cd
      JOIN cards c ON cd.card_id::text = c.id::text
      LEFT JOIN card_computed_metrics ccm ON c.id::text = ccm.card_id::text
      ORDER BY ABS(cd.calc_pct) DESC
      LIMIT 20
    `);
    
    // Top sets by volume
    const { rows: topSets } = await client.query(`
      SELECT 
        COALESCE(s.console_name, ccm.console_name, 'Unknown Set') as console_name,
        COUNT(ccm.card_id) as card_count,
        ROUND(AVG(COALESCE(ccm.loose_price, ccm.avg_price, 0))::numeric, 2) as avg_price,
        COALESCE(SUM(COALESCE(ccm.sales_volume, ccm.volume_30d, 0)), 0)::bigint as total_volume
      FROM card_computed_metrics ccm
      LEFT JOIN cards c ON ccm.card_id::text = c.id::text
      LEFT JOIN sets s ON c.set_id = s.id
      GROUP BY COALESCE(s.console_name, ccm.console_name, 'Unknown Set')
      ORDER BY total_volume DESC
      LIMIT 10
    `);
    
    client.release();
    
    res.json({
      metrics: metrics[0] || {
        total_cards: 0,
        total_sets: 0,
        avg_card_price: 0,
        total_volume: 0,
        rising_cards: 0,
        declining_cards: 0,
        stable_cards: 0
      },
      topMovers: topMovers || [],
      topSets: topSets || []
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route handlers for different pages (must come after API routes)
app.get('/cards/top-movers', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'top-movers.html'));
});

app.get('/sets/top-volume', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'top-sets.html'));
});

app.get('/intelligence-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'intelligence-dashboard.html'));
});

app.get('/sales/pulse', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-pulse.html'));
});

app.get('/sales/platform-mix', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-platform-mix.html'));
});

app.get('/sales/auction-vs-bin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-auction-vs-bin.html'));
});

app.get('/sales/condition-premiums', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-condition-premiums.html'));
});

app.get('/sales/liquidity', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-liquidity.html'));
});

app.get('/sales/seller-quality', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-seller-quality.html'));
});

app.get('/sales/shipping-impact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sales-shipping-impact.html'));
});

app.get('/indices/set', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indices-set.html'));
});

app.get('/indices/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indices-player.html'));
});

app.get('/indices/grade', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indices-grade.html'));
});

app.get('/indices/market', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indices-market.html'));
});

app.get('/card-detail/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'card-detail.html'));
});

app.get('/set-detail/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'set-detail.html'));
});

app.get('/player-detail/:name', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player-detail.html'));
});

app.get('/sport-detail/:name', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sport-detail.html'));
});

app.get('/opportunities', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'opportunities.html'));
});

app.get('/grading', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'grading.html'));
});

app.get('/market-efficiency', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'market-efficiency.html'));
});

app.get('/player-profiles', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player-profiles.html'));
});

app.get('/alerts', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'alerts.html'));
});

app.get('/sale-feed', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sale-feed.html'));
});

app.get('/cards/volatility', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cards-volatility.html'));
});

app.get('/cards/premium', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cards-premium.html'));
});

app.get(/^\/cards(?!\/api)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cards.html'));
});

app.get('/sets/performance', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sets-performance.html'));
});

app.get('/sets/liquidity', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sets-liquidity.html'));
});

app.get(/^\/sets(?!\/api)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sets.html'));
});

// Serve the main dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler for undefined routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.status(404).send('Page not found');
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Analytics server running at http://localhost:${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`🃏 Cards: http://localhost:${port}/cards`);
  console.log(`📦 Sets: http://localhost:${port}/sets`);
});

module.exports = app;
