/*
  Warnings:

  - Added the required column `senderName` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "senderName" TEXT NOT NULL;
