/*
  Warnings:

  - A unique constraint covering the columns `[quizId,studentId,attemptNumber]` on the table `QuizAttempt` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "QuizAttempt_quizId_studentId_key";

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "GroupEnrollment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswerItem" (
    "id" BIGSERIAL NOT NULL,
    "quizAnswerId" BIGINT NOT NULL,
    "keywordId" BIGINT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswerItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupEnrollment_groupId_studentId_key" ON "GroupEnrollment"("groupId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswerItem_quizAnswerId_keywordId_key" ON "QuizAnswerItem"("quizAnswerId", "keywordId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_attemptNumber_key" ON "QuizAttempt"("quizId", "studentId", "attemptNumber");

-- AddForeignKey
ALTER TABLE "GroupEnrollment" ADD CONSTRAINT "GroupEnrollment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEnrollment" ADD CONSTRAINT "GroupEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswerItem" ADD CONSTRAINT "QuizAnswerItem_quizAnswerId_fkey" FOREIGN KEY ("quizAnswerId") REFERENCES "QuizAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswerItem" ADD CONSTRAINT "QuizAnswerItem_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "QuestionKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
