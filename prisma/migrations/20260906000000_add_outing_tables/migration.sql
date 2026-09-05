-- CreateTable Outing
CREATE TABLE "Outing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Outing_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Outing_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable OutingParticipant
CREATE TABLE "OutingParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutingParticipant_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutingParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable OutingInvitation
CREATE TABLE "OutingInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outingId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutingInvitation_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutingInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutingInvitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable Activity: add outingId, pricingModel, status columns
ALTER TABLE "Activity" ADD COLUMN "outingId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "pricingModel" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Activity" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';

-- AddIndex for Outing
CREATE INDEX "Outing_groupId_idx" ON "Outing"("groupId");
CREATE INDEX "Outing_status_idx" ON "Outing"("status");
CREATE INDEX "OutingParticipant_outingId_idx" ON "OutingParticipant"("outingId");
CREATE INDEX "OutingParticipant_userId_idx" ON "OutingParticipant"("userId");
CREATE INDEX "OutingInvitation_outingId_idx" ON "OutingInvitation"("outingId");
CREATE INDEX "OutingInvitation_status_idx" ON "OutingInvitation"("status");

-- AddIndex for Activity outingId
CREATE INDEX "Activity_outingId_idx" ON "Activity"("outingId");
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateTable ActivityProduct
CREATE TABLE "ActivityProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "pricePerUnitCt" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityProduct_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable UsageRecord
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalCentimes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ActivityProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable UsageParticipant
CREATE TABLE "UsageParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usageRecordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "UsageParticipant_usageRecordId_fkey" FOREIGN KEY ("usageRecordId") REFERENCES "UsageRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable UsageConfirmation
CREATE TABLE "UsageConfirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usageRecordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UsageConfirmation_usageRecordId_fkey" FOREIGN KEY ("usageRecordId") REFERENCES "UsageRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsageConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable LineItem
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCentimes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LineItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LineItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable ActivityPayment
CREATE TABLE "ActivityPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCentimes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityPayment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable CorrectionRequest
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "deciderId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "CorrectionRequest_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CorrectionRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CorrectionRequest_deciderId_fkey" FOREIGN KEY ("deciderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AddIndex for new tables
CREATE INDEX "ActivityProduct_activityId_idx" ON "ActivityProduct"("activityId");
CREATE INDEX "UsageRecord_activityId_idx" ON "UsageRecord"("activityId");
CREATE INDEX "UsageRecord_productId_idx" ON "UsageRecord"("productId");
CREATE INDEX "UsageRecord_status_idx" ON "UsageRecord"("status");
CREATE INDEX "UsageParticipant_usageRecordId_idx" ON "UsageParticipant"("usageRecordId");
CREATE INDEX "UsageParticipant_userId_idx" ON "UsageParticipant"("userId");
CREATE INDEX "UsageConfirmation_usageRecordId_idx" ON "UsageConfirmation"("usageRecordId");
CREATE INDEX "UsageConfirmation_status_idx" ON "UsageConfirmation"("status");
CREATE INDEX "LineItem_activityId_idx" ON "LineItem"("activityId");
CREATE INDEX "LineItem_userId_idx" ON "LineItem"("userId");
CREATE INDEX "ActivityPayment_activityId_idx" ON "ActivityPayment"("activityId");
CREATE INDEX "ActivityPayment_userId_idx" ON "ActivityPayment"("userId");
CREATE INDEX "CorrectionRequest_outingId_idx" ON "CorrectionRequest"("outingId");
CREATE INDEX "CorrectionRequest_status_idx" ON "CorrectionRequest"("status");

-- Add unique constraints
CREATE UNIQUE INDEX "OutingParticipant_outingId_userId_key" ON "OutingParticipant"("outingId", "userId");
CREATE UNIQUE INDEX "OutingInvitation_outingId_inviteeUserId_key" ON "OutingInvitation"("outingId", "inviteeUserId");
CREATE UNIQUE INDEX "UsageParticipant_usageRecordId_userId_key" ON "UsageParticipant"("usageRecordId", "userId");
CREATE UNIQUE INDEX "UsageConfirmation_usageRecordId_userId_key" ON "UsageConfirmation"("usageRecordId", "userId");

-- Add unique index to Settlement for outingId
CREATE UNIQUE INDEX "Settlement_outingId_key" ON "Settlement"("outingId");
ALTER TABLE "Settlement" ADD COLUMN "outingId" TEXT;
CREATE INDEX "Settlement_groupId_idx" ON "Settlement"("groupId");
