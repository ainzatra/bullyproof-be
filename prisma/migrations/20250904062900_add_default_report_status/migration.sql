/*
  Warnings:

  - The `status` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('Pending', 'InProgress', 'Resolved');

-- AlterTable
ALTER TABLE "public"."Report" DROP COLUMN "status",
ADD COLUMN     "status" "public"."ReportStatus" NOT NULL DEFAULT 'Pending';

-- CreateTable
CREATE TABLE "public"."ReportEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "ReportEvidence_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ReportEvidence" ADD CONSTRAINT "ReportEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
