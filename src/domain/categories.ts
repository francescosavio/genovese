export const CATEGORIES = {
  Car: ['Fuel', 'Tyres', 'Road Tax', 'Insurance'],
  Home: ['Rent', 'Bills', 'Furniture', 'Kitchen'],
  Food: ['Groceries', 'Lunch', 'Dinner', 'Beverages'],
  Transportation: ['Train', 'Subway', 'Bus', 'Bike', 'Flight'],
  Health: ['Medicine'],
  Sport: ['Swimming', 'Skiing'],
  Shopping: ['Clothing', 'Shoes', 'Tech'],
  'Social Life': ['Bar', 'Friends', 'Restaurant'],
  Culture: ['Books'],
  Vacation: [],
  Subscription: [],
  Gift: [],
  Work: [],
  Games: [],
  Taxes: [],
  Other: [],
} as const satisfies Record<string, readonly string[]>

export type Category = keyof typeof CATEGORIES
export type Subcategory = (typeof CATEGORIES)[Category][number]
export type SubcategoryOf<C extends Category> = (typeof CATEGORIES)[C][number]
