export { availabilityOf, LOW_STOCK_MAX, type Availability } from "./availability";
export {
  getCandidates,
  getProduct,
  listBrands,
  listCategories,
  pickVariant,
  type Candidate,
  type CandidateFilters,
  type ProductDetail,
} from "./catalogue";
export { disconnect, getPrisma } from "./db";
export { makeSpecs, SPEC_KEYS, type ProductSpecs } from "./specs";
