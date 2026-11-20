-- CreateSchema

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'TAILOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_TIMELINE_APPROVAL', 'PICKUP_SCHEDULED', 'IN_TRANSIT_TO_TAILOR', 'STITCHING', 'READY_FOR_DELIVERY', 'DELIVERED_PENDING_APPROVAL', 'ALTERATION_REQUESTED', 'ALTERATION_IN_TRANSIT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED');

-- CreateEnum
CREATE TYPE "Leg" AS ENUM ('FABRIC_PICKUP', 'FINAL_DELIVERY', 'ALTERATION_PICKUP', 'ALTERATION_RETURN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "Installment" AS ENUM ('PICKUP', 'DELIVERY', 'APPROVAL', 'DESIGN');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('PROFILE', 'ORDER_SPECIFICATION', 'MESSAGE', 'ALTERATION', 'REVIEW', 'IMAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "location" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TailorProfile" (
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "publishedBio" TEXT NOT NULL DEFAULT '',
    "expertise" JSONB NOT NULL DEFAULT '[]',
    "publishedExpertise" JSONB NOT NULL DEFAULT '[]',
    "garmentCatalog" JSONB NOT NULL DEFAULT '[]',
    "publishedGarmentCatalog" JSONB NOT NULL DEFAULT '[]',
    "workshopAddress" JSONB NOT NULL DEFAULT '{}',
    "publishedWorkshopAddress" JSONB NOT NULL DEFAULT '{}',
    "portfolioUploadIds" JSONB NOT NULL DEFAULT '[]',
    "publishedPortfolioUploadIds" JSONB NOT NULL DEFAULT '[]',
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "approvalStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "subscriptionPaid" BOOLEAN NOT NULL DEFAULT false,
    "monthlyFeeAmount" INTEGER NOT NULL DEFAULT 49900,
    "nextBillingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TailorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "commissionPercent" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tailorId" TEXT NOT NULL,
    "conversationId" TEXT,
    "garmentType" TEXT NOT NULL,
    "measurementMode" TEXT NOT NULL,
    "measurements" JSONB NOT NULL,
    "requiredMeasurements" JSONB NOT NULL,
    "measurementStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "hasReferenceCloth" BOOLEAN NOT NULL DEFAULT false,
    "designSpecifications" TEXT NOT NULL,
    "publishedDesignSpecifications" TEXT NOT NULL DEFAULT '',
    "contentStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "referenceUploadIds" JSONB NOT NULL DEFAULT '[]',
    "basePrice" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "platformFeePercent" INTEGER NOT NULL,
    "platformFeeAmount" INTEGER NOT NULL,
    "tailorPayout" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "pickupPaid" BOOLEAN NOT NULL DEFAULT false,
    "deliveryPaid" BOOLEAN NOT NULL DEFAULT false,
    "approvalPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_TIMELINE_APPROVAL',
    "pickupAddress" JSONB NOT NULL,
    "deliveryAddress" JSONB NOT NULL,
    "tailorAddress" JSONB NOT NULL,
    "agreedCompletionDays" INTEGER NOT NULL,
    "proposedCompletionDays" INTEGER,
    "customerAgreedToTimeline" BOOLEAN NOT NULL DEFAULT false,
    "timelineConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "checkoutKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerRating" INTEGER,
    "customerReview" TEXT,
    "publishedReview" TEXT,
    "reviewStatus" "ReviewStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tailorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "orderId" TEXT,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedContent" TEXT NOT NULL DEFAULT '',
    "contentStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "uploadId" TEXT,
    "clientKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "installment" "Installment" NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "eventId" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "leg" "Leg" NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "courier" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "tracking" TEXT NOT NULL DEFAULT '',
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alteration" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "alterationType" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "publishedNotes" TEXT NOT NULL DEFAULT '',
    "contentStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER,
    "quoteVersion" INTEGER NOT NULL DEFAULT 1,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "publishedText" TEXT NOT NULL DEFAULT '',
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationItem" (
    "id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "orderId" TEXT,
    "authorId" TEXT NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL DEFAULT '',
    "publishedText" TEXT NOT NULL DEFAULT '',
    "uploadId" TEXT,
    "replacementUploadId" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orderId" TEXT,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "publicUse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadData" (
    "uploadId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "UploadData_pkey" PRIMARY KEY ("uploadId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_conversationId_key" ON "Order"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_tailorId_status_idx" ON "Order"("tailorId", "status");

-- CreateIndex
CREATE INDEX "Conversation_tailorId_createdAt_idx" ON "Conversation"("tailorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_uploadId_key" ON "Message"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_clientKey_key" ON "Message"("clientKey");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_eventId_key" ON "Payment"("eventId");

-- CreateIndex
CREATE INDEX "Payment_orderId_installment_cycle_idx" ON "Payment"("orderId", "installment", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_idempotencyKey_key" ON "SubscriptionPayment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_leg_cycle_key" ON "Shipment"("orderId", "leg", "cycle");

-- CreateIndex
CREATE INDEX "Alteration_orderId_cycle_idx" ON "Alteration"("orderId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "ModerationItem_status_createdAt_idx" ON "ModerationItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationItem_kind_targetId_contentVersion_idx" ON "ModerationItem"("kind", "targetId", "contentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_key_key" ON "Upload"("key");

-- CreateIndex
CREATE INDEX "Upload_ownerId_createdAt_idx" ON "Upload"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "TailorProfile" ADD CONSTRAINT "TailorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alteration" ADD CONSTRAINT "Alteration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alteration" ADD CONSTRAINT "Alteration_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationItem" ADD CONSTRAINT "ModerationItem_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadData" ADD CONSTRAINT "UploadData_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
