/*
  Warnings:

  - A unique constraint covering the columns `[device_id]` on the table `PushToken` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PushToken_device_id_key" ON "public"."PushToken"("device_id");
