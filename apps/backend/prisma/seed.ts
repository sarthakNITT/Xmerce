import { prisma } from "../src/config/db";

async function main() {
  console.log("Seeding sample products for search testing...");

  const footwear = await prisma.category.upsert({
    where: { slug: "footwear" },
    update: {},
    create: {
      name: "Footwear",
      slug: "footwear",
      description: "Shoes, sneakers, sandals, and boots",
    },
  });

  const electronics = await prisma.category.upsert({
    where: { slug: "electronics" },
    update: {},
    create: {
      name: "Electronics",
      slug: "electronics",
      description: "Gadgets, audio, and mobile accessories",
    },
  });

  const products = [
    {
      title: "Nike Air Max 270 Red Running Shoes",
      slug: "nike-air-max-270-red",
      description: "Comfortable and breathable lightweight red running shoes with responsive cushioning.",
      price: 159.99,
      brand: "Nike",
      color: "Red",
      rating: 4.8,
      reviewCount: 320,
      inStock: true,
      stockCount: 45,
      images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff"],
      tags: ["shoes", "running", "red", "sneakers", "nike", "sport"],
      categoryId: footwear.id,
    },
    {
      title: "Adidas Ultraboost Light Red Shoes",
      slug: "adidas-ultraboost-light-red",
      description: "High performance energetic red cushioning shoes designed for marathon and everyday running.",
      price: 189.99,
      brand: "Adidas",
      color: "Red",
      rating: 4.7,
      reviewCount: 215,
      inStock: true,
      stockCount: 20,
      images: ["https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2"],
      tags: ["shoes", "running", "red", "adidas", "ultraboost"],
      categoryId: footwear.id,
    },
    {
      title: "Puma Classic Suede Black & White Sneakers",
      slug: "puma-classic-suede-black-white",
      description: "Timeless suede low-top sneakers in classic black and white style.",
      price: 74.99,
      brand: "Puma",
      color: "Black",
      rating: 4.5,
      reviewCount: 98,
      inStock: true,
      stockCount: 15,
      images: ["https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77"],
      tags: ["shoes", "sneakers", "black", "puma", "lifestyle"],
      categoryId: footwear.id,
    },
    {
      title: "Sony WH-1000XM5 Noise Cancelling Headphones",
      slug: "sony-wh-1000xm5-headphones",
      description: "Industry leading noise canceling wireless over-ear headphones with crystal clear hands-free calling.",
      price: 399.99,
      brand: "Sony",
      color: "Black",
      rating: 4.9,
      reviewCount: 1420,
      inStock: true,
      stockCount: 60,
      images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e"],
      tags: ["headphones", "audio", "sony", "electronics", "wireless"],
      categoryId: electronics.id,
    },
  ];

  for (const prod of products) {
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: prod,
      create: prod,
    });
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
