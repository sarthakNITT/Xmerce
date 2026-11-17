# AI-A example responses

Responses of `POST /api/ai/assistant` for the four example requests in the brief, produced on 17 November 2026 against the seeded catalogue with the live model (`mode: "ai"`). Regenerate with `bun run ask "<message>"` in `packages/assistant`.

## "I need a laptop under INR 70,000 for coding and light video editing. Battery life matters; I travel a lot."

```json
{
  "interpretedRequirement": "Laptop for coding and light video editing, long battery life, light and easy to carry, strong performance",
  "budget": 70000,
  "recommendations": [
    {
      "productId": "LAP-101",
      "productName": "NovaBook Air 14",
      "reason": "18 hr battery, 1.3 kg, Intel Core Ultra 5, 16 GB RAM, 512 GB SSD, 14-inch 2.2K display (INR 64,990, within budget)",
      "availability": "IN_STOCK",
      "sku": "LAP-101-U5-16-512-SLV",
      "price": 64990,
      "aboveBudget": false
    },
    {
      "productId": "LAP-102",
      "productName": "NovaBook Air 15",
      "reason": "15 hr battery, 1.5 kg, Intel Core Ultra 5, 16 GB RAM, 512 GB SSD, 15.3-inch FHD+ display (INR 69,990, within budget)",
      "availability": "LOW_STOCK",
      "sku": "LAP-102-U5-16-512-SLV",
      "price": 69990,
      "aboveBudget": false
    },
    {
      "productId": "LAP-107",
      "productName": "NovaBook Flex 14",
      "reason": "13 hr battery, 1.5 kg, Intel Core Ultra 5, 16 GB RAM, 512 GB SSD, 14-inch FHD+ display (INR 68,990, within budget)",
      "availability": "IN_STOCK",
      "sku": "LAP-107-U5-16-512-BLU",
      "price": 68990,
      "aboveBudget": false
    }
  ],
  "clarifyingQuestion": null,
  "message": null,
  "mode": "ai"
}
```

## "Suggest a desktop for my home office under INR 60,000."

```json
{
  "interpretedRequirement": "Desktop for home office",
  "budget": 60000,
  "recommendations": [
    {
      "productId": "DSK-301",
      "productName": "NovaDesk Tower T5",
      "reason": "Intel Core i5, 16 GB RAM, 1 TB SSD, 24-inch FHD monitor included (INR 54,990, within budget)",
      "availability": "IN_STOCK",
      "sku": "DSK-301-I5-16-1TB-BLK",
      "price": 54990,
      "aboveBudget": false
    },
    {
      "productId": "DSK-304",
      "productName": "Zenith Cube C5",
      "reason": "AMD Ryzen 5, 16 GB RAM, 512 GB SSD (INR 46,990, within budget)",
      "availability": "LOW_STOCK",
      "sku": "DSK-304-R5-16-512-WHT",
      "price": 46990,
      "aboveBudget": false
    },
    {
      "productId": "DSK-302",
      "productName": "NovaDesk Mini M3",
      "reason": "Intel Core i3, 8 GB RAM, 512 GB SSD, 1.2 kg (INR 34,990, within budget)",
      "availability": "IN_STOCK",
      "sku": "DSK-302-I3-8-512-BLK",
      "price": 34990,
      "aboveBudget": false
    }
  ],
  "clarifyingQuestion": null,
  "message": null,
  "mode": "ai"
}
```

## "Show me a gaming laptop under INR 1,00,000."

```json
{
  "interpretedRequirement": "Gaming laptop",
  "budget": 100000,
  "recommendations": [
    {
      "productId": "LAP-201",
      "productName": "Nova Gaming X17",
      "reason": "AMD Ryzen 9, RTX 5070 graphics, 32 GB RAM, 1 TB SSD, 17.3-inch QHD 165 Hz display, 6 hr battery, 2.7 kg (INR 1,49,990, above budget)",
      "availability": "IN_STOCK",
      "sku": "LAP-201-R9-32-1TB-BLK",
      "price": 149990,
      "aboveBudget": true
    }
  ],
  "clarifyingQuestion": null,
  "message": "Nothing in our catalogue matches a gaming laptop at or under INR 1,00,000. The closest option is shown below, marked as above budget. Would you like to raise your budget?",
  "mode": "ai"
}
```

## "I need a good laptop."

```json
{
  "interpretedRequirement": "Laptop",
  "budget": null,
  "recommendations": [],
  "clarifyingQuestion": "To recommend the right product, could you tell me your budget and what you will mainly use the laptop for?",
  "message": null,
  "mode": "ai"
}
```
