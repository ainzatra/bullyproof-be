/*
  Warnings:

  - You are about to drop the column `incident_date` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `offender` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `offender_identity` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Report` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Report" DROP COLUMN "incident_date",
DROP COLUMN "offender",
DROP COLUMN "offender_identity",
DROP COLUMN "type",
ALTER COLUMN "actionsTaken" DROP NOT NULL;
