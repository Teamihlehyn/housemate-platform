-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privacyConsentAt" TIMESTAMP(3),
ADD COLUMN     "privacyConsentVersion" TEXT;
