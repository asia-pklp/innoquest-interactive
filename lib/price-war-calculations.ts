export interface Submission {
  team_id: string
  price: number
  units_available: number
}

export interface RoundResult {
  team_id: string
  units_sold: number
  revenue: number
  profit: number
}

/**
 * Calculate round results for Price War.
 *
 * Rules:
 *  - Customers buy from the cheapest store first.
 *  - If the cheapest store runs out of stock, remaining customers move to the next cheapest.
 *  - Tied prices → customers split proportionally to each team's available units.
 *  - Unsold units earn zero revenue, but fixed_cost still applies.
 *  - profit = revenue - fixed_cost
 */
export function calculatePriceWarRound(
  submissions: Submission[],
  totalCustomers: number,
  fixedCost: number,
  variableCost: number = 0
): RoundResult[] {
  // Initialize results for all teams (even those that sell nothing)
  // total_cost = fixed_cost + variable_cost × units_available (produced upfront)
  const results: Record<string, RoundResult> = {}
  for (const s of submissions) {
    const productionCost = variableCost * s.units_available
    results[s.team_id] = { team_id: s.team_id, units_sold: 0, revenue: 0, profit: -(fixedCost + productionCost) }
  }

  if (submissions.length === 0) return []

  // Sort by price ascending
  const sorted = [...submissions].sort((a, b) => a.price - b.price)

  let customersLeft = totalCustomers
  let i = 0

  while (i < sorted.length && customersLeft > 0) {
    // Collect all teams at this price (the current "price tier")
    const currentPrice = sorted[i].price
    const tier: Submission[] = []
    while (i < sorted.length && sorted[i].price === currentPrice) {
      tier.push(sorted[i])
      i++
    }

    const totalUnitsInTier = tier.reduce((sum, t) => sum + t.units_available, 0)

    // Customers this tier can actually serve
    const customersForTier = Math.min(customersLeft, totalUnitsInTier)

    if (tier.length === 1) {
      // No tie — team sells to as many customers as they have units for
      const t = tier[0]
      const sold = Math.min(t.units_available, customersForTier)
      const productionCost = variableCost * t.units_available
      results[t.team_id].units_sold = sold
      results[t.team_id].revenue = sold * currentPrice
      results[t.team_id].profit = sold * currentPrice - fixedCost - productionCost
      customersLeft -= sold
    } else {
      // Tie — distribute customers proportionally to units available
      let allocated = 0
      for (let j = 0; j < tier.length; j++) {
        const t = tier[j]
        let share: number
        if (j === tier.length - 1) {
          // Last team in the tier gets the remainder to avoid rounding drift
          share = customersForTier - allocated
        } else {
          share = Math.round((t.units_available / totalUnitsInTier) * customersForTier)
        }
        const sold = Math.min(t.units_available, share)
        const productionCost = variableCost * t.units_available
        results[t.team_id].units_sold = sold
        results[t.team_id].revenue = sold * currentPrice
        results[t.team_id].profit = sold * currentPrice - fixedCost - productionCost
        customersLeft -= sold
        allocated += sold
      }
    }
  }

  return Object.values(results)
}

export interface PriceWarConfig {
  total_customers: number
  products_per_team: number
  fixed_cost: number
  variable_cost: number
  min_price: number
  max_price: number
}

export const DEFAULT_PRICE_WAR_CONFIG: PriceWarConfig = {
  total_customers: 10,
  products_per_team: 5,
  fixed_cost: 1000,
  variable_cost: 0,
  min_price: 1,
  max_price: 9999,
}
