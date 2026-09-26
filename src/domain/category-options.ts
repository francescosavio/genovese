import { CATEGORIES, type Category, type Subcategory } from './categories'

export type CategoryOption = {
  category: Category
  subcategory: Subcategory | null
  label: string
}

// Flattened and category only is showed as an option
export const CATEGORY_OPTIONS: CategoryOption[] = Object.entries(
  CATEGORIES,
).flatMap(([category, { subcategories }]): CategoryOption[] => {
  const parent = category as Category
  return [
    { category: parent, subcategory: null, label: parent },
    ...(subcategories as readonly Subcategory[]).map((subcategory) => ({
      category: parent,
      subcategory,
      label: `${parent} › ${subcategory}`,
    })),
  ]
})

type Score = { tier: number; at: number }

const NO_MATCH: Score = { tier: 2, at: 0 }

// Two tiers. A run of letters typed together beats the same letters scattered,
// otherwise "trai" ranks Train and Bike equally and the tie breaks on spelling.
function score(haystack: string, needle: string): Score {
  const run = haystack.indexOf(needle)
  if (run !== -1) return { tier: 0, at: run }

  let at = 0
  for (const char of needle) {
    at = haystack.indexOf(char, at)
    if (at === -1) return NO_MATCH
    at += 1
  }
  return { tier: 1, at }
}

export function searchCategories(query: string): CategoryOption[] {
  const needle = query
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  if (needle === '') return CATEGORY_OPTIONS

  return CATEGORY_OPTIONS.map((option, index) => ({
    option,
    index,
    score: score(option.label.toLowerCase().replace(/[^a-z]/g, ''), needle),
  }))
    .filter(({ score }) => score !== NO_MATCH)
    .sort(
      (a, b) =>
        a.score.tier - b.score.tier ||
        a.score.at - b.score.at ||
        // Ties keep the order the categories were declared in, which is the
        // order they matter in
        a.index - b.index,
    )
    .map(({ option }) => option)
}
