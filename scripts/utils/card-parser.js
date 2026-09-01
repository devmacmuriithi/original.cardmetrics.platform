/**
 * Card Name Parser - Smart Pattern-Based Parsing
 * Extracts structured data from product names without hard-coding player names
 */

// Known basketball card set names (for exclusion)
const KNOWN_SETS = new Set([
  'chronicles', 'origins', 'prizm', 'select', 'spectra', 'donruss', 'optic', 'mosaic',
  'contenders', 'national treasures', 'immaculate collection', 'flawless', 'elite',
  'status', 'threads', 'timeless treasures', 'absolute', 'certified', 'court kings',
  'crusade', 'exquisite', 'finest', 'gala', 'gold standard', 'hall of fame', 'hoops',
  'illusions', 'inception', 'institute', 'intrigue', 'luxury suite', 'marquee',
  'monarchs', 'nobility', 'obsidian', 'ovation', 'palatial', 'paramount',
  'past and present', 'photogenic', 'plates and patches', 'portfolio', 'preferred',
  'prestige', 'pristine', 'prominence', 'prospects', 'radiant', 'revolution',
  'rookie anthology', 'rookies and stars', 'select draft picks', 'skybox',
  'sophisticated', 'sp authentic', 'spx', 'strata', 'supreme', 'swat', 'sweet shot',
  'symphony', 'timeless', 'topps chrome', 'topps finest', 'topps gallery',
  'transcendent', 'treasured', 'triple threads', 'tribute', 'trinity', 'ultimate',
  'ultra', 'unparalleled', 'valiant', 'vanguard', 'vault', 'vertex', 'veterans',
  'vibrance', 'vivid', 'wings', 'x-factor', 'now', 'chrome', 'bowman', 'sterling',
  'wnba', 'draft picks', 'draft', 'one and one', 'crown royale', 'donruss elite'
]);

/**
 * Check if a word looks like a name (capitalized, not a known set)
 */
function isPotentialName(word) {
  if (!word || word.length < 2) return false;
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  return /^[A-Z]/.test(word) && !KNOWN_SETS.has(clean);
}

/**
 * Check if text contains a player name pattern (2 capitalized words)
 */
function findPlayerNamePattern(words, startIdx = 0) {
  for (let i = startIdx; i < words.length - 1; i++) {
    const current = words[i];
    const next = words[i + 1];
    
    // Look for 2 consecutive capitalized words that aren't known sets
    if (isPotentialName(current) && isPotentialName(next)) {
      // Check if this forms a reasonable name (not too long)
      const nameLen = current.length + next.length;
      if (nameLen <= 25) { // Reasonable name length
        return { start: i, end: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Parse a card product name into structured components
 * @param {string} productName - Raw product name from CSV
 * @returns {object} Parsed components: year, manufacturer, set, player, cardNumber, variant
 */
function parseCardName(productName) {
  if (!productName || typeof productName !== 'string') {
    return { year: null, manufacturer: null, setName: null, playerName: null, 
             cardNumber: null, variant: null, raw: productName };
  }

  const result = { year: null, manufacturer: null, setName: null, playerName: null, 
                   cardNumber: null, variant: null, raw: productName };

  let remaining = productName.trim();

  // Extract Year
  const yearMatch = remaining.match(/^(\d{4})\s+/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1]);
    remaining = remaining.slice(yearMatch[0].length).trim();
  }

  // Extract Manufacturer
  const manufacturerMatch = remaining.match(/^(Topps|Panini|Upper Deck|Bowman|Donruss|Leaf)/i);
  if (manufacturerMatch) {
    result.manufacturer = manufacturerMatch[1];
    remaining = remaining.slice(manufacturerMatch[0].length).trim();
  }

  // Extract Variant [content]
  const variantMatch = remaining.match(/\[([^\]]+)\]/);
  if (variantMatch) {
    result.variant = variantMatch[1].trim();
    remaining = remaining.replace(variantMatch[0], '').trim();
  }

  // Extract Card Number #123
  const cardNumMatch = remaining.match(/#(\d+[a-zA-Z]?)/);
  if (cardNumMatch) {
    result.cardNumber = cardNumMatch[1];
    remaining = remaining.replace(cardNumMatch[0], '').trim();
  }

  // Now parse remaining for Set and Player
  const words = remaining.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return result;

  // Strategy: Find player name pattern (2 capitalized words), then determine set
  
  // First, try to find player at the END (pattern: "... Player Name SetName")
  // Examples: "Caitlin Clark Chronicles", "Paige Bueckers Prizm"
  let playerPattern = null;
  let setName = null;
  
  // Look from end to start for player pattern
  for (let checkEnd = words.length; checkEnd >= 2; checkEnd--) {
    const subset = words.slice(0, checkEnd);
    const pattern = findPlayerNamePattern(subset);
    
    if (pattern) {
      // Check if remaining words after player form a known set
      const afterPlayer = words.slice(pattern.end + 1);
      const beforePlayer = words.slice(0, pattern.start);
      
      if (afterPlayer.length > 0) {
        const afterText = afterPlayer.join(' ').toLowerCase();
        if (KNOWN_SETS.has(afterText)) {
          playerPattern = pattern;
          setName = afterText;
          break;
        }
      }
      
      // Check if words before player form a known set
      if (beforePlayer.length > 0) {
        const beforeText = beforePlayer.join(' ').toLowerCase();
        if (KNOWN_SETS.has(beforeText)) {
          playerPattern = pattern;
          setName = beforeText;
          break;
        }
      }
    }
  }
  
  // If no set-associated pattern found, just find any player pattern
  if (!playerPattern) {
    playerPattern = findPlayerNamePattern(words);
    
    // If player found, check surrounding words for set
    if (playerPattern) {
      const before = words.slice(0, playerPattern.start).join(' ').toLowerCase();
      const after = words.slice(playerPattern.end + 1).join(' ').toLowerCase();
      
      if (KNOWN_SETS.has(before)) {
        setName = before;
      } else if (KNOWN_SETS.has(after)) {
        setName = after;
      }
    }
  }
  
  // Apply results
  if (playerPattern) {
    result.playerName = words.slice(playerPattern.start, playerPattern.end + 1).join(' ');
    result.setName = setName;
  } else if (words.length >= 2) {
    // Fallback: last 2 words as player, rest as set
    const lastTwo = words.slice(-2);
    if (lastTwo.every(w => /^[A-Z]/.test(w))) {
      result.playerName = lastTwo.join(' ');
      result.setName = words.slice(0, -2).join(' ') || null;
    } else {
      result.setName = words.join(' ');
    }
  } else {
    result.setName = words.join(' ');
  }

  return cleanResult(result);
}

function cleanResult(result) {
  if (result.playerName) {
    result.playerName = result.playerName.replace(/[,.;:!?]+$/, '').trim();
  }
  if (result.setName) {
    result.setName = result.setName.replace(/[,.;:!?]+$/, '').trim() || null;
  }
  return result;
}

/**
 * Batch parse multiple card names
 * @param {string[]} productNames - Array of product names
 * @returns {object[]} Array of parsed results
 */
function parseBatch(productNames) {
  return productNames.map(name => parseCardName(name));
}

/**
 * Normalize player name for matching
 */
function normalizePlayerName(playerName) {
  if (!playerName) return null;
  return playerName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate fingerprint from parsed data
 */
function generateParsedFingerprint(parsed) {
  const parts = [
    parsed.manufacturer || 'unknown',
    parsed.year || '0000',
    parsed.setName ? parsed.setName.toLowerCase().replace(/\s+/g, '-') : 'base',
    normalizePlayerName(parsed.playerName) || 'unknown',
    parsed.cardNumber ? parsed.cardNumber.toString().toLowerCase() : 'unknown',
    parsed.variant ? parsed.variant.toLowerCase().replace(/\s+/g, '-') : 'base'
  ];
  return parts.join('|');
}

// Export for use in other modules
module.exports = {
  parseCardName,
  parseBatch,
  normalizePlayerName,
  generateParsedFingerprint
};

// CLI test mode
if (require.main === module) {
  const testCases = [
    '2025 Topps Brandon Williams [Holo Gold Foil] #171',
    '2025 Panini Caitlin Clark Chronicles [Shock and Awe] #30',
    '2025 Panini Origins Caitlin Clark [Blue Ink] #17',
    '2025 Topps #171 Brandon Williams',
    '2025 Topps Stephen Curry [Gold] #30',
    '2025 Panini Select #26 Kelsey Plum',
    '2025 Panini Prizm Paige Bueckers',
    '2025 Panini Select #1 Caitlin Clark [Silver Prizm]',
    '2025 Panini Donruss Elite Aaliyah Edwards',
    '2025 Panini Prizm Cameron Brink',
    '2025 Topps Now Angel Reese',
    '2025 Panini Origins Bronny James [Gold]',
    '2025 Panini Select #15 Victor Wembanyama'
  ];

  console.log('Card Name Parser Test\n');
  console.log('='.repeat(80));

  testCases.forEach(name => {
    const parsed = parseCardName(name);
    console.log('\nInput:', name);
    console.log('Parsed:', JSON.stringify(parsed, null, 2));
    console.log('Fingerprint:', generateParsedFingerprint(parsed));
    console.log('-'.repeat(80));
  });
}
