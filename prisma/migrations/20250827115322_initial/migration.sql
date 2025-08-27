-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" DATE NOT NULL,
    "gender" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guardian" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guidance" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guidance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "incident_date" DATE NOT NULL,
    "details" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "offender" TEXT NOT NULL,
    "offender_identity" TEXT NOT NULL,
    "actionsTaken" TEXT NOT NULL,
    "feelings" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "guidanceId" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiReport" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "toxicity" INTEGER NOT NULL,
    "insult" BOOLEAN NOT NULL,
    "threat" BOOLEAN NOT NULL,
    "profanity" BOOLEAN NOT NULL,
    "bullying_category" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,

    CONSTRAINT "AiReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_email_key" ON "public"."Guardian"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Guidance_email_key" ON "public"."Guidance"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AiReport_report_id_key" ON "public"."AiReport"("report_id");

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_guidanceId_fkey" FOREIGN KEY ("guidanceId") REFERENCES "public"."Guidance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiReport" ADD CONSTRAINT "AiReport_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
