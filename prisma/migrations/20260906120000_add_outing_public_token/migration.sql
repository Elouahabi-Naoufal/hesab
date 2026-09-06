-- AlterTable Outing: add publicToken column
ALTER TABLE "Outing" ADD COLUMN "publicToken" TEXT;

-- CreateIndex for unique constraint
CREATE UNIQUE INDEX "Outing_publicToken_key" ON "Outing"("publicToken");
