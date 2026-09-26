export type Flow = 'expense' | 'income' | 'transfer'

type CategoryDef = { flow: Flow; subcategories: readonly string[] }

// One line per category reads better than what Prettier would make of it.
// prettier-ignore
export const CATEGORIES = {
  Car: { flow: 'expense', subcategories: ['Fuel', 'Tyres', 'Road Tax', 'Insurance'] },
  Home: { flow: 'expense', subcategories: ['Rent', 'Bills', 'Furniture', 'Kitchen'] },
  Food: { flow: 'expense', subcategories: ['Groceries', 'Lunch', 'Dinner', 'Beverages'] },
  Transportation: { flow: 'expense', subcategories: ['Train', 'Subway', 'Bus', 'Bike', 'Flight'] },
  Health: { flow: 'expense', subcategories: ['Medicine'] },
  Sport: { flow: 'expense', subcategories: ['Swimming', 'Skiing'] },
  Shopping: { flow: 'expense', subcategories: ['Clothing', 'Shoes', 'Tech'] },
  'Social Life': { flow: 'expense', subcategories: ['Bar', 'Friends', 'Restaurant'] },
  Culture: { flow: 'expense', subcategories: ['Books'] },
  Vacation: { flow: 'expense', subcategories: [] },
  Subscription: { flow: 'expense', subcategories: [] },
  Gift: { flow: 'expense', subcategories: [] },
  Work: { flow: 'expense', subcategories: [] },
  Games: { flow: 'expense', subcategories: [] },
  Taxes: { flow: 'expense', subcategories: [] },
  Other: { flow: 'expense', subcategories: [] },
  Salary: { flow: 'income', subcategories: [] },
  Transfers: { flow: 'transfer', subcategories: [] },
} as const satisfies Record<string, CategoryDef>

export type Category = keyof typeof CATEGORIES
export type SubcategoryOf<C extends Category> =
  (typeof CATEGORIES)[C]['subcategories'][number]
export type Subcategory = SubcategoryOf<Category>

// Uncategorised counts as expense, so undecided money stays visible.
export const flowOf = (category: Category | null): Flow =>
  category === null ? 'expense' : CATEGORIES[category].flow

export const EXPENSE_CATEGORIES = (
  Object.keys(CATEGORIES) as Category[]
).filter((c) => flowOf(c) === 'expense')
