/**
 * Card Fingerprint Rules - Versioned Specification
 * 
 * @version 1.0.0
 * @schema fingerprint-and-indices-schema.sql
 * 
 * PURPOSE:
 * Generate a deterministic, canonical identity string for trading cards
 * that remains stable across data reloads, schema changes, and system migrations.
 * 
 * PRINCIPLES:
 * 1. Deterministic - Same inputs always produce same fingerprint
 * 2. Stable - Fingerprint persists across database reloads
 * 3. Comparable - Enables cross-system card matching
 * 4. Human-readable - Can be debugged by humans
 * 5. Versioned - Changes to logic bump version number
 */

const FingerprintRules = {
  version: '1.0.0',
  
  // ============================================================================
  // INPUT FIELDS (in order of appearance in fingerprint)
  // ============================================================================
  inputs: [
    {
      name: 'sport',
      source: 'sports.slug',
      type: 'TEXT',
      required: false,
      fallback: '',
      position: 1
    },
    {
      name: 'year',
      source: 'sets.year',
      type: 'INTEGER',
      required: false,
      fallback: '',
      position: 2
    },
    {
      name: 'manufacturer',
      source: 'manufacturers.slug',
      type: 'TEXT',
      required: false,
      fallback: '',
      position: 3
    },
    {
      name: 'set_name',
      source: 'sets.slug',
      type: 'TEXT',
      required: false,
      fallback: '',
      position: 4
    },
    {
      name: 'card_number',
      source: 'cards.card_number',
      type: 'TEXT',
      required: false,
      fallback: '',
      position: 5
    },
    {
      name: 'variation',
      source: 'cards.variation',
      type: 'TEXT',
      required: false,
      fallback: 'base',
      position: 6
    },
    {
      name: 'player_name',
      source: 'players.slug',
      type: 'TEXT',
      required: false,
      fallback: '',
      position: 7
    }
  ],

  // ============================================================================
  // NORMALIZATION RULES (applied to each input)
  // ============================================================================
  normalization: {
    text: {
      steps: [
        { name: 'trim', description: 'Remove leading/trailing whitespace' },
        { name: 'lowercase', description: 'Convert to lowercase' }
      ],
      function: 'LOWER(TRIM(value))'
    },
    integer: {
      steps: [
        { name: 'to_string', description: 'Convert to text representation' }
      ],
      function: 'value::TEXT'
    },
    null_handling: {
      description: 'NULL values are replaced with fallback before normalization',
      function: 'COALESCE(value, fallback)'
    }
  },

  // ============================================================================
  // EXCLUSIONS / EDGE CASES
  // ============================================================================
  exclusions: {
    description: 'Values that should be excluded or normalized to empty',
    rules: [
      {
        condition: 'variation IS NULL',
        action: 'Use "base" as fallback',
        reason: 'NULL variation implies base card'
      },
      {
        condition: 'variation = ""',
        action: 'Use "base" as fallback',
        reason: 'Empty string implies base card'
      },
      {
        condition: 'card_number contains only whitespace',
        action: 'Trim to empty string',
        reason: 'Whitespace-only is equivalent to no card number'
      }
    ]
  },

  // ============================================================================
  // FINGERPRINT FORMAT
  // ============================================================================
  format: {
    delimiter: '|',
    structure: 'sport|year|manufacturer|set|card_number|variation|player',
    example: 'basketball|2019|panini|prizm|1|silver|lebron-james',
    max_length: 500,  // TEXT field limit
    hash_algorithm: 'SHA256',
    hash_fallback: 'MD5'  // If pgcrypto not available
  },

  // ============================================================================
  // VERSIONING
  // ============================================================================
  versioning: {
    field: 'fingerprint_version',
    current: 1,
    strategy: 'Bump version when logic changes, trigger re-computation'
  },

  // ============================================================================
  // TEST CASES (for validation)
  // ============================================================================
  test_cases: [
    {
      name: 'Standard card',
      inputs: {
        sport: 'Basketball',
        year: 2019,
        manufacturer: 'Panini',
        set_name: 'Prizm',
        card_number: '1',
        variation: 'Silver',
        player_name: 'LeBron James'
      },
      expected_fingerprint: 'basketball|2019|panini|prizm|1|silver|lebron-james'
    },
    {
      name: 'Base card (null variation)',
      inputs: {
        sport: 'Basketball',
        year: 2020,
        manufacturer: 'Topps',
        set_name: 'Chrome',
        card_number: '100',
        variation: null,
        player_name: 'Mike Trout'
      },
      expected_fingerprint: 'basketball|2020|topps|chrome|100|base|mike-trout'
    },
    {
      name: 'Missing player (rookie checklist)',
      inputs: {
        sport: 'Football',
        year: 2021,
        manufacturer: 'Panini',
        set_name: 'Select',
        card_number: 'RC-1',
        variation: 'Red',
        player_name: null
      },
      expected_fingerprint: 'football|2021|panini|select|rc-1|red|'
    },
    {
      name: 'Whitespace normalization',
      inputs: {
        sport: '  Basketball  ',
        year: 2022,
        manufacturer: 'PANINI',
        set_name: '  Prizm  ',
        card_number: '  50  ',
        variation: '  Gold  ',
        player_name: '  Ja Morant  '
      },
      expected_fingerprint: 'basketball|2022|panini|prizm|50|gold|ja-morant'
    },
    {
      name: 'Empty variation becomes base',
      inputs: {
        sport: 'Baseball',
        year: 2023,
        manufacturer: 'Bowman',
        set_name: 'Chrome',
        card_number: '1',
        variation: '',
        player_name: 'Aaron Judge'
      },
      expected_fingerprint: 'baseball|2023|bowman|chrome|1|base|aaron-judge'
    }
  ],

  // ============================================================================
  // CHANGE LOG
  // ============================================================================
  changelog: [
    {
      version: '1.0.0',
      date: '2025-02-08',
      changes: [
        'Initial fingerprint specification',
        '7-field structure: sport|year|manufacturer|set|number|variation|player',
        'SHA256 hashing with MD5 fallback',
        'NULL variation defaults to "base"'
      ]
    }
  ]
};

module.exports = FingerprintRules;
