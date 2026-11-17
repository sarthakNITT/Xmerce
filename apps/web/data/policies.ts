export interface PolicyExcerpt {
  key: string;
  topicTitle: string;
  documentTitle: string;
  section: string;
  version: string;
  confidence: 'HIGH' | 'LOW';
  followUpRequired: boolean;
  content: string;
}

export const POLICIES: Record<string, PolicyExcerpt> = {
  returns: {
    key: 'returns',
    topicTitle: 'Laptop & Desktop Returns',
    documentTitle: 'Laptop & Desktop Return Policy',
    section: 'Opened products / Unopened products / Custom-configured models',
    version: '2026.1',
    confidence: 'HIGH',
    followUpRequired: false,
    content:
      'Opened laptops and desktops: return within 7 days of delivery, with no physical damage, all accessories and the original box. Unopened products: 15 days. Custom-configured models: returnable only if defective.',
  },
  delivery: {
    key: 'delivery',
    topicTitle: 'Shipping & Delivery',
    documentTitle: 'Shipping & Delivery Policy',
    section: 'Delivery overview & timelines (approved excerpt)',
    version: '2026.2',
    confidence: 'HIGH',
    followUpRequired: false,
    content:
      'Standard delivery: 3–5 business days, free on orders above ₹5,000; otherwise ₹199 flat fee. Express delivery: 1–2 business days for ₹299. Orders can be cancelled at no penalty before they ship.',
  },
  warranty: {
    key: 'warranty',
    topicTitle: 'Hardware Warranty',
    documentTitle: 'Warranty Policy',
    section: 'Standard coverage & exclusions (approved excerpt)',
    version: '2026.1',
    confidence: 'HIGH',
    followUpRequired: false,
    content:
      'Laptops, desktops and all-in-ones carry a 1-year limited manufacturer warranty. Internal battery and charger: 6 months. Liquid spills and accidental damage are covered only when protected with the NovaCare 3-Year Plan.',
  },
  refunds: {
    key: 'refunds',
    topicTitle: 'Refund Timelines',
    documentTitle: 'Refund Policy',
    section: 'Timelines & payout methods',
    version: '2026.1',
    confidence: 'HIGH',
    followUpRequired: false,
    content:
      'Refunds are credited to the original payment method within 5–7 business days after the returned item successfully passes inspection. Cash-on-delivery (COD) orders are refunded via direct bank transfer within 7–10 business days.',
  },
  membership: {
    key: 'membership',
    topicTitle: 'NovaClub Membership Benefits',
    documentTitle: 'NovaClub Membership Benefits',
    section: 'Tier specifications: Standard / Silver / Gold',
    version: '2026.1',
    confidence: 'HIGH',
    followUpRequired: false,
    content:
      'Standard tier: free standard delivery above ₹5,000 and 1× reward points. Silver tier: adds priority support chat and 1.5× points. Gold tier: adds free express delivery on every order, early access to flagship sales, and 2× points. Membership is linked to your verified account profile.',
  },
};

export const INTEGRATION_INFOS = {
  account: {
    title: 'Your NovaTech Account',
    body: 'Sign-in and registration are scheduled for the next backend release. Customer onboarding will securely capture first name, last name, verified email, mobile number, and password authenticated by the Java backend service. This frontend prototype does not harvest credentials.',
  },
  orders: {
    title: 'My Orders Tracking',
    body: 'Order history will track live lifecycle states (Confirmed, Packed, Shipped, Out for Delivery, and Delivered) once connected to the Java order management service. No real orders have been placed in this demonstration environment.',
  },
  checkout: {
    title: 'Checkout Integration Pending',
    body: 'The transactional checkout service is scheduled for the upcoming phase. It will include authenticated customer delivery addresses, server-authoritative GST calculations, mock Card / UPI testing with simulated failure states, Cash on Delivery (COD), and instant order confirmations. Your demo bag contents will remain saved in this browser.',
  },
  support: {
    title: 'NovaTech Support Desk',
    body: 'Support ticketing and live chat routing will be wired to the enterprise support queue in the next deployment. For now, please refer to the approved policy excerpts above.',
  },
};
