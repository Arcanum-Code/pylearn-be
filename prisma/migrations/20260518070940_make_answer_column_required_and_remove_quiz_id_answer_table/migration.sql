/*
  Warnings:

  - You are about to drop the column `quizId` on the `QuizAttempt` table. All the data in the column will be lost.
  - Made the column `isCorrect` on table `QuizAnswer` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "QuizAttempt" DROP CONSTRAINT "QuizAttempt_quizId_fkey";

-- AlterTable
ALTER TABLE "QuizAnswer" ALTER COLUMN "isCorrect" SET NOT NULL;

-- AlterTable
ALTER TABLE "QuizAttempt" DROP COLUMN "quizId";
