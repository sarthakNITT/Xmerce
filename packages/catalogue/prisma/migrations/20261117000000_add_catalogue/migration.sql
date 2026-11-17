-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalogue";

-- CreateTable
CREATE TABLE "catalogue"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "mrp" INTEGER,
    "rating" DECIMAL(2,1) NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "images" TEXT[],
    "specs" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogue"."ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "processor" TEXT,
    "ramGb" INTEGER,
    "storageGb" INTEGER,
    "colour" TEXT,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "catalogue"."Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "catalogue"."Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "catalogue"."Category"("parentId");

-- CreateIndex
CREATE INDEX "Product_categoryId_active_idx" ON "catalogue"."Product"("categoryId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "catalogue"."ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "catalogue"."ProductVariant"("productId");

-- CreateIndex
CREATE INDEX "ProductVariant_price_idx" ON "catalogue"."ProductVariant"("price");

-- CreateIndex
CREATE INDEX "ProductVariant_ramGb_idx" ON "catalogue"."ProductVariant"("ramGb");

-- AddForeignKey
ALTER TABLE "catalogue"."Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "catalogue"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalogue"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogue"."ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalogue"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

