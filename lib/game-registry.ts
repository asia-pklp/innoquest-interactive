export interface GameDefinition {
  id: string
  name: string
  description: string
  icon: string
  defaultSettings: Record<string, unknown>
}

// ── Startup Simulation defaults ────────────────────────────────────────────
const DEFAULT_RND_TIER_CONFIG = {
  basic:    { min_cost: 5000,  max_cost: 8000,  success_min: 70, success_max: 70, multiplier_min: 1.05, multiplier_max: 1.15 },
  standard: { min_cost: 12000, max_cost: 18000, success_min: 80, success_max: 80, multiplier_min: 1.15, multiplier_max: 1.35 },
  advanced: { min_cost: 30000, max_cost: 40000, success_min: 90, success_max: 90, multiplier_min: 1.35, multiplier_max: 1.65 },
  premium:  { min_cost: 55000, max_cost: 65000, success_min: 95, success_max: 95, multiplier_min: 1.65, multiplier_max: 2.0  },
}

const DEFAULT_INVESTMENT_CONFIG = {
  seed:     { mean: 50000,  sd: 10000,  sd_percent: 20, main_ratio: 0.7, bonus_ratio: 0.3, bonus_multiplier: 1.5, expected_revenue: 100000,  demand: 500,  rd_count: 1 },
  series_a: { mean: 150000, sd: 30000,  sd_percent: 20, main_ratio: 0.7, bonus_ratio: 0.3, bonus_multiplier: 1.5, expected_revenue: 250000,  demand: 1000, rd_count: 3 },
  series_b: { mean: 300000, sd: 60000,  sd_percent: 20, main_ratio: 0.7, bonus_ratio: 0.3, bonus_multiplier: 1.5, expected_revenue: 500000,  demand: 2000, rd_count: 5 },
  series_c: { mean: 500000, sd: 100000, sd_percent: 20, main_ratio: 0.7, bonus_ratio: 0.3, bonus_multiplier: 1.5, expected_revenue: 1000000, demand: 4000, rd_count: 8 },
}

// ── Registry ───────────────────────────────────────────────────────────────
export const GAME_REGISTRY: Record<string, GameDefinition> = {
  startup_simulation: {
    id: 'startup_simulation',
    name: 'Startup Odyssey',
    description: 'Multi-week business simulation where teams run startups and make weekly decisions on pricing, R&D investment, and analytics.',
    icon: '🚀',
    defaultSettings: {
      total_weeks: 10,
      week_duration_minutes: 5,
      max_teams: 10,
      population_size: 10000,
      initial_capital: 500000,
      analytics_cost: 5000,
      rnd_tier_config: DEFAULT_RND_TIER_CONFIG,
      investment_config: DEFAULT_INVESTMENT_CONFIG,
    },
  },

  price_war: {
    id: 'price_war',
    name: 'Price War',
    description: 'Teams compete as stores selling the same product. Set prices strategically — the cheapest store sells first. Maximize cumulative profit over multiple rounds.',
    icon: '⚔️',
    defaultSettings: {
      total_weeks: 5,        // reused as "total rounds"
      week_duration_minutes: 5,
      max_teams: 8,
      // Price War-specific config stored in game_config JSONB column
      game_config: {
        total_customers: 10,
        products_per_team: 5,
        fixed_cost: 1000,
        variable_cost: 0,
        min_price: 1,
        max_price: 9999,
      },
    },
  },

  // Add future game types here — each entry is self-contained
}

export function getGameDefinition(gameType: string): GameDefinition | undefined {
  return GAME_REGISTRY[gameType]
}

export function listGameTypes(): GameDefinition[] {
  return Object.values(GAME_REGISTRY)
}

export function getStudentBasePath(gameType: string): string {
  return `/student/${gameType}`
}
