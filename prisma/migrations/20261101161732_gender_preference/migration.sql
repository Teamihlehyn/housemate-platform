-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "gender" TEXT,
ADD COLUMN     "genderPreference" TEXT NOT NULL DEFAULT '["woman","man","non_binary"]';
