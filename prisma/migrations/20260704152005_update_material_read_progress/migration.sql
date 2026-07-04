-- AlterTable
ALTER TABLE "MaterialRead" ADD COLUMN     "scrollPercentage" INTEGER,
ALTER COLUMN "readAt" DROP NOT NULL,
ALTER COLUMN "readAt" DROP DEFAULT;
