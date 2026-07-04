/*
  Warnings:

  - You are about to drop the column `materialId` on the `Quiz` table. All the data in the column will be lost.
  - You are about to drop the column `quizLevelId` on the `QuizAttempt` table. All the data in the column will be lost.
  - You are about to drop the column `quizLevelId` on the `QuizQuestion` table. All the data in the column will be lost.
  - You are about to drop the `QuizLevel` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[groupId,levelNumber]` on the table `Quiz` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[quizId,studentId]` on the table `QuizAttempt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[quizId,questionOrder]` on the table `QuizQuestion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `groupId` to the `Quiz` table without a default value. This is not possible if the table is not empty.
  - Added the required column `levelNumber` to the `Quiz` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quizId` to the `QuizAttempt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quizId` to the `QuizQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Quiz" DROP CONSTRAINT "Quiz_materialId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAttempt" DROP CONSTRAINT "QuizAttempt_quizLevelId_fkey";

-- DropForeignKey
ALTER TABLE "QuizLevel" DROP CONSTRAINT "QuizLevel_quizId_fkey";

-- DropForeignKey
ALTER TABLE "QuizQuestion" DROP CONSTRAINT "QuizQuestion_quizLevelId_fkey";

-- DropIndex
DROP INDEX "QuizAttempt_quizLevelId_studentId_key";

-- DropIndex
DROP INDEX "QuizQuestion_quizLevelId_questionOrder_key";

-- AlterTable
ALTER TABLE "Quiz" DROP COLUMN "materialId",
ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "levelNumber" INTEGER NOT NULL,
ADD COLUMN     "passThreshold" DOUBLE PRECISION NOT NULL DEFAULT 70.0;

-- AlterTable
ALTER TABLE "QuizAttempt" DROP COLUMN "quizLevelId",
ADD COLUMN     "quizId" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "QuizQuestion" DROP COLUMN "quizLevelId",
ADD COLUMN     "quizId" BIGINT NOT NULL;

-- DropTable
DROP TABLE "QuizLevel";

-- CreateTable
CREATE TABLE "QuizPrerequisite" (
    "id" TEXT NOT NULL,
    "quizId" BIGINT NOT NULL,
    "materialId" BIGINT NOT NULL,

    CONSTRAINT "QuizPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionKeyword" (
    "id" BIGSERIAL NOT NULL,
    "questionId" BIGINT NOT NULL,
    "blankOrder" INTEGER NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizPrerequisite_quizId_materialId_key" ON "QuizPrerequisite"("quizId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionKeyword_questionId_blankOrder_key" ON "QuestionKeyword"("questionId", "blankOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_groupId_levelNumber_key" ON "Quiz"("groupId", "levelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_key" ON "QuizAttempt"("quizId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizQuestion_quizId_questionOrder_key" ON "QuizQuestion"("quizId", "questionOrder");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizPrerequisite" ADD CONSTRAINT "QuizPrerequisite_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizPrerequisite" ADD CONSTRAINT "QuizPrerequisite_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionKeyword" ADD CONSTRAINT "QuestionKeyword_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
