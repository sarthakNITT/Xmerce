import { PRODUCTS, type Product } from '../data/products';
import { callDecisionsApi } from './openrouter';

export interface CustomerContext {
  userId?: string;
  previousPurchases?: string[]; // Product IDs
  recentSearches?: string[];    // Search query phrases
  cartItems?: string[];         // Current bag item IDs
}

export interface RecommendationResult {
  product: Product;
  score: number;
  reason: string;
  source: 'vector_search_ready' | 'openrouter_decision' | 'purchase_affinity';
}

/**
 * Vector Database Hook (Interface for pgvector or hosted vector store to be attached)
 */
export interface VectorDbProvider {
  isConfigured: () => boolean;
  searchSimilar: (
    embedding: number[],
    limit: number
  ) => Promise<{ productId: string; score: number }[]>;
}

export const placeholderVectorDb: VectorDbProvider = {
  isConfigured: () => false, // Will return true when vector extension (e.g. pgvector on Neon) is enabled
  searchSimilar: async () => [],
};

/**
 * Generate personalized recommendations based on previous purchases and search history
 */
export async function getPersonalizedRecommendations(
  ctx: CustomerContext,
  limit = 4
): Promise<RecommendationResult[]> {
  const { previousPurchases = [], recentSearches = [], cartItems = [] } = ctx;

  const results: RecommendationResult[] = [];
  const excludedIds = new Set([...previousPurchases, ...cartItems]);

  // 1. Vector Search Pipeline (Prepared for embedding model)
  if (placeholderVectorDb.isConfigured()) {
    // When enabled, embeds `recentSearches.join(' ')` and executes cosine similarity query
  }

  // 2. Heuristic and Purchase-Affinity Scoring
  const scoredProducts = PRODUCTS.map((product) => {
    let score = 0.5;
    let reason = 'Popular in the NovaTech catalogue';

    // Affinity 1: Previous purchase match (e.g. Laptop buyer recommended NovaCare or monitor/desk)
    const hasBoughtLaptop = previousPurchases.some((id) => id.startsWith('LAP'));
    if (hasBoughtLaptop && product.id === 'ADD-501') {
      score += 0.45;
      reason = 'Recommended coverage for your previously purchased NovaBook';
    } else if (hasBoughtLaptop && (product.category === 'Monitors' || product.category === 'All-in-One')) {
      score += 0.25;
      reason = 'Expands your dual-display desk setup';
    }

    // Affinity 2: Recent search match
    const searchBlob = recentSearches.join(' ').toLowerCase();
    if (searchBlob) {
      if (searchBlob.includes('gaming') && product.category === 'Gaming') {
        score += 0.4;
        reason = 'Matches your recent interest in high-performance gaming hardware';
      } else if (
        (searchBlob.includes('coding') || searchBlob.includes('travel') || searchBlob.includes('student')) &&
        product.category === 'Laptops'
      ) {
        score += 0.35;
        reason = 'Matches your search for portable, high-efficiency laptops';
      } else if (searchBlob.includes('desktop') && product.category === 'Desktops') {
        score += 0.35;
        reason = 'Matches your recent desktop workstation search';
      }
    }

    // Affinity 3: Best-sellers boost
    if (product.isBestSeller) {
      score += 0.15;
    }

    return {
      product,
      score: Math.min(score, 1.0),
      reason,
      source: hasBoughtLaptop && product.id === 'ADD-501' ? 'purchase_affinity' : 'vector_search_ready',
    } as RecommendationResult;
  });

  // Filter out already purchased/in-cart items (unless list is too short)
  const available = scoredProducts.filter((sp) => !excludedIds.has(sp.product.id));
  const pool = available.length >= limit ? available : scoredProducts;

  return pool.sort((a, b) => b.score - a.score).slice(0, limit);
}
