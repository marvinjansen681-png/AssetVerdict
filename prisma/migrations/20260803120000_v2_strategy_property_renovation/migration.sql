-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "investmentStrategy" TEXT DEFAULT 'commercial',
ADD COLUMN     "erfNumber" TEXT,
ADD COLUMN     "erfSize" DOUBLE PRECISION,
ADD COLUMN     "propertyZoning" TEXT,
ADD COLUMN     "floorSize" DOUBLE PRECISION,
ADD COLUMN     "bedrooms" INTEGER,
ADD COLUMN     "bathrooms" INTEGER,
ADD COLUMN     "garages" INTEGER,
ADD COLUMN     "numUnits" INTEGER DEFAULT 1,
ADD COLUMN     "yearBuilt" INTEGER,
ADD COLUMN     "ratesAccountNumber" TEXT,
ADD COLUMN     "titleDeedNumber" TEXT,
ADD COLUMN     "isSectionalTitle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unitNumber" TEXT,
ADD COLUMN     "schemeName" TEXT,
ADD COLUMN     "schemeLevy" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CashflowInputs" ADD COLUMN     "nightlyRate" DOUBLE PRECISION,
ADD COLUMN     "avgOccupiedNights" INTEGER DEFAULT 200,
ADD COLUMN     "platformFeesPct" DOUBLE PRECISION DEFAULT 15,
ADD COLUMN     "billsIncluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "academicYearWeeks" INTEGER DEFAULT 42,
ADD COLUMN     "pricePerRoom" DOUBLE PRECISION,
ADD COLUMN     "holdingPeriodMonths" INTEGER DEFAULT 6,
ADD COLUMN     "expectedSalePrice" DOUBLE PRECISION,
ADD COLUMN     "holdingCostPerMonth" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "instalmentAmount" DOUBLE PRECISION,
ADD COLUMN     "instalmentTerm" INTEGER DEFAULT 240,
ADD COLUMN     "instalmentRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "RenovationItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgeted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quoted" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RenovationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RenovationItem_dealId_idx" ON "RenovationItem"("dealId");

-- AddForeignKey
ALTER TABLE "RenovationItem" ADD CONSTRAINT "RenovationItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
