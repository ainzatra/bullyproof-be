/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `ConversationParticipant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_userId_key" ON "public"."ConversationParticipant"("userId");

-- AddForeignKey
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_guidanceId_fkey" FOREIGN KEY ("guidanceId") REFERENCES "public"."Guidance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
