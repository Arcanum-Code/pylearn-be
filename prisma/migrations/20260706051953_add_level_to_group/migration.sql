/*
  Warnings:

  - You are about to drop the `QuizPrerequisite` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `endIndex` to the `QuestionKeyword` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startIndex` to the `QuestionKeyword` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GroupLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');

-- DropForeignKey
ALTER TABLE "QuizPrerequisite" DROP CONSTRAINT "QuizPrerequisite_materialId_fkey";

-- DropForeignKey
ALTER TABLE "QuizPrerequisite" DROP CONSTRAINT "QuizPrerequisite_quizId_fkey";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "level" "GroupLevel" NOT NULL DEFAULT 'BASIC';

-- AlterTable
ALTER TABLE "QuestionKeyword" ADD COLUMN     "endIndex" INTEGER NOT NULL,
ADD COLUMN     "startIndex" INTEGER NOT NULL;

-- DropTable
DROP TABLE "QuizPrerequisite";
