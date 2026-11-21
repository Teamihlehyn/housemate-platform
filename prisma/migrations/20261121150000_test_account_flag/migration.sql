-- ENG-67: accounts approved without the video ID call in a test environment. Additive.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTestAccount" BOOLEAN NOT NULL DEFAULT false;

