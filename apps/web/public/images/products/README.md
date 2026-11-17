# NovaTech Product Imagery

Drop your product photography or renders in this directory to automatically display them in the NovaTech storefront.

## Image Mapping

| Product ID | Product Name | Target File Name | Recommended Dimensions |
|------------|--------------|------------------|------------------------|
| `LAP-101`  | NovaBook Air 14 | `novabook-air-14.webp` (or `.png`) | 1200 × 900 px (contain, transparent or light bg) |
| `LAP-102`  | NovaBook Air 15 | `novabook-air-15.webp` | 1200 × 900 px |
| `LAP-103`  | NovaBook Go 14  | `novabook-go-14.webp`  | 1200 × 900 px |
| `LAP-104`  | NovaBook Pro 15 | `novabook-pro-15.webp` | 1200 × 900 px |
| `LAP-201`  | Nova Gaming X17 | `nova-gaming-x17.webp` | 1200 × 900 px |
| `DSK-301`  | NovaDesk Tower T5 | `novadesk-tower-t5.webp` | 1200 × 900 px |
| `AIO-401`  | NovaDesk One 24 | `novadesk-one-24.webp` | 1200 × 900 px |
| `ADD-501`  | NovaCare 3-Year Plan | `novacare-3yr.webp` | 1200 × 900 px |

## How to Enable Images in Code

In `apps/web/data/products.ts`, update the `image` field for each product from `null` to the relative asset path:
```typescript
{
  id: 'LAP-101',
  name: 'NovaBook Air 14',
  ...
  image: '/images/products/novabook-air-14.webp',
}
```

The UI already reserves exact dimensions and uses `object-fit: contain` so layouts remain pixel-perfect and stable whether images are present or pending.
