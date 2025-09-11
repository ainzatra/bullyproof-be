-- CreateEnum
CREATE TYPE "public"."ReportDocumentType" AS ENUM ('brngy', 'dswd', 'committee', 'council');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "avatar" TEXT;

-- CreateTable
CREATE TABLE "public"."ReportDocument" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "public"."ReportDocumentType" NOT NULL,

    CONSTRAINT "ReportDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ReportDocument" ADD CONSTRAINT "ReportDocument_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
