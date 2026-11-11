-- Back-office sign-in (ENG-47): staff credentials, set-up links, and staff-scoped code rows. Additive.
-- AlterTable
ALTER TABLE "AuthCode" ADD COLUMN     "decoy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pendingHash" TEXT,
ADD COLUMN     "scope" TEXT;

-- CreateTable
CREATE TABLE "StaffCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSetAt" TIMESTAMP(3) NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSetupToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffCredential_userId_key" ON "StaffCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffSetupToken_tokenHash_key" ON "StaffSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSetupToken_email_idx" ON "StaffSetupToken"("email");

