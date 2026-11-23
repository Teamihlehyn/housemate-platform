-- ENG-69: "Anywhere in {city}" for the areas question. Additive; existing searches keep their areas.
-- AlterTable
ALTER TABLE "Search" ADD COLUMN     "anyArea" BOOLEAN NOT NULL DEFAULT false;

