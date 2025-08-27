/*
  Warnings:

  - A unique constraint covering the columns `[studentId]` on the table `Guardian` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `studentId` to the `Guardian` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Guardian" ADD COLUMN     "studentId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_studentId_key" ON "public"."Guardian"("studentId");

-- AddForeignKey
ALTER TABLE "public"."Guardian" ADD CONSTRAINT "Guardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
