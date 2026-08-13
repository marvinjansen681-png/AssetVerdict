-- AlterTable
ALTER TABLE "CashflowInputs" ADD COLUMN     "singleRoomCount" INTEGER DEFAULT 0,
ADD COLUMN     "singleRoomRent" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "singleRoomNsfasBeds" INTEGER DEFAULT 0,
ADD COLUMN     "sharingRoomCount" INTEGER DEFAULT 0,
ADD COLUMN     "sharingBedsPerRoom" INTEGER DEFAULT 2,
ADD COLUMN     "sharingRoomRent" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "sharingRoomNsfasBeds" INTEGER DEFAULT 0,
ADD COLUMN     "nsfasCycleMonths" INTEGER DEFAULT 10,
ADD COLUMN     "privateCycleMonths" INTEGER DEFAULT 12;
