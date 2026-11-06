-- AlterTable
ALTER TABLE "vtcs" ADD COLUMN     "banner_url" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discord_url" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "recruiting" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "website" TEXT;
