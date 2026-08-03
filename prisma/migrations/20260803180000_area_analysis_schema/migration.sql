-- CreateTable
CREATE TABLE "PropertyValuation" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "sgCode" TEXT,
    "reportSource" TEXT NOT NULL DEFAULT 'TPN Property Valuation Report',
    "propertyDescription" TEXT,
    "extentSqm" DOUBLE PRECISION,
    "zoning" TEXT,
    "buildingSizeSqm" DOUBLE PRECISION,
    "bedroomsReported" INTEGER,
    "bathroomsReported" INTEGER,
    "garagesReported" INTEGER,
    "yearBuiltReported" INTEGER,
    "estimatedValue" DOUBLE PRECISION,
    "valueConfidenceLow" DOUBLE PRECISION,
    "valueConfidenceHigh" DOUBLE PRECISION,
    "valuationConfidence" TEXT,
    "pricePerSqm" DOUBLE PRECISION,
    "currentOwnerSince" TIMESTAMP(3),
    "ownerAgeBand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTransaction" (
    "id" TEXT NOT NULL,
    "propertyValuationId" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "buyerName" TEXT,
    "sellerName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PropertyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondRecord" (
    "id" TEXT NOT NULL,
    "propertyValuationId" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3),
    "bondAmount" DOUBLE PRECISION,
    "bondHolder" TEXT,
    "bondType" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BondRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparableSale" (
    "id" TEXT NOT NULL,
    "propertyValuationId" TEXT NOT NULL,
    "address" TEXT,
    "sgCode" TEXT,
    "saleDate" TIMESTAMP(3),
    "salePrice" DOUBLE PRECISION,
    "extentSqm" DOUBLE PRECISION,
    "buildingSizeSqm" DOUBLE PRECISION,
    "pricePerSqm" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComparableSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuburbProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "suburbName" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "reportType" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3),
    "reportYear" INTEGER,
    "reportSource" TEXT NOT NULL DEFAULT 'TPN Investor Report',
    "notes" TEXT,
    "paidOnTimePct" DOUBLE PRECISION,
    "gracePeriodPct" DOUBLE PRECISION,
    "paidLatePct" DOUBLE PRECISION,
    "partialPaymentPct" DOUBLE PRECISION,
    "didNotPayPct" DOUBLE PRECISION,
    "goodStandingPct" DOUBLE PRECISION,
    "provinceGoodStandingPct" DOUBLE PRECISION,
    "nationalGoodStandingPct" DOUBLE PRECISION,
    "stGrossYield" DOUBLE PRECISION,
    "stEffectiveYield" DOUBLE PRECISION,
    "fhGrossYield" DOUBLE PRECISION,
    "fhEffectiveYield" DOUBLE PRECISION,
    "nationalGrossYield" DOUBLE PRECISION,
    "stSmallBedLow" DOUBLE PRECISION,
    "stSmallBedAvg" DOUBLE PRECISION,
    "stSmallBedHigh" DOUBLE PRECISION,
    "st2BedLow" DOUBLE PRECISION,
    "st2BedAvg" DOUBLE PRECISION,
    "st2BedHigh" DOUBLE PRECISION,
    "stLargeBedLow" DOUBLE PRECISION,
    "stLargeBedAvg" DOUBLE PRECISION,
    "stLargeBedHigh" DOUBLE PRECISION,
    "stRentalTrend" TEXT,
    "fhSmallBedLow" DOUBLE PRECISION,
    "fhSmallBedAvg" DOUBLE PRECISION,
    "fhSmallBedHigh" DOUBLE PRECISION,
    "fh3BedLow" DOUBLE PRECISION,
    "fh3BedAvg" DOUBLE PRECISION,
    "fh3BedHigh" DOUBLE PRECISION,
    "fhLargeBedLow" DOUBLE PRECISION,
    "fhLargeBedAvg" DOUBLE PRECISION,
    "fhLargeBedHigh" DOUBLE PRECISION,
    "fhRentalTrend" TEXT,
    "stAvgPurchasePrice" DOUBLE PRECISION,
    "fhAvgPurchasePrice" DOUBLE PRECISION,
    "stTransactionVolume" INTEGER,
    "fhTransactionVolume" INTEGER,
    "investmentPropertyPct" DOUBLE PRECISION,
    "formalSectorPct" DOUBLE PRECISION,
    "unemployedPct" DOUBLE PRECISION,
    "incomeMiddleBandPct" DOUBLE PRECISION,
    "incomeHighBandPct" DOUBLE PRECISION,
    "age17to25Pct" DOUBLE PRECISION,
    "age26to40Pct" DOUBLE PRECISION,
    "age41to60Pct" DOUBLE PRECISION,
    "largeHouseholdPct" DOUBLE PRECISION,
    "singlePersonHouseholdPct" DOUBLE PRECISION,
    "provinceSTGrossYield" DOUBLE PRECISION,
    "provinceFHGrossYield" DOUBLE PRECISION,
    "provinceST2BedAvgRent" DOUBLE PRECISION,
    "provinceFH3BedAvgRent" DOUBLE PRECISION,
    "provinceSTLargeBedAvg" DOUBLE PRECISION,
    "provinceFHLargeBedAvg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuburbProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealSuburb" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "suburbProfileId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealSuburb_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyValuation_dealId_key" ON "PropertyValuation"("dealId");

-- CreateIndex
CREATE INDEX "PropertyValuation_dealId_idx" ON "PropertyValuation"("dealId");

-- CreateIndex
CREATE INDEX "PropertyTransaction_propertyValuationId_idx" ON "PropertyTransaction"("propertyValuationId");

-- CreateIndex
CREATE INDEX "BondRecord_propertyValuationId_idx" ON "BondRecord"("propertyValuationId");

-- CreateIndex
CREATE INDEX "ComparableSale_propertyValuationId_idx" ON "ComparableSale"("propertyValuationId");

-- CreateIndex
CREATE INDEX "SuburbProfile_userId_idx" ON "SuburbProfile"("userId");

-- CreateIndex
CREATE INDEX "SuburbProfile_suburbName_idx" ON "SuburbProfile"("suburbName");

-- CreateIndex
CREATE INDEX "DealSuburb_dealId_idx" ON "DealSuburb"("dealId");

-- CreateIndex
CREATE INDEX "DealSuburb_suburbProfileId_idx" ON "DealSuburb"("suburbProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "DealSuburb_dealId_suburbProfileId_key" ON "DealSuburb"("dealId", "suburbProfileId");

-- AddForeignKey
ALTER TABLE "PropertyValuation" ADD CONSTRAINT "PropertyValuation_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_propertyValuationId_fkey" FOREIGN KEY ("propertyValuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondRecord" ADD CONSTRAINT "BondRecord_propertyValuationId_fkey" FOREIGN KEY ("propertyValuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparableSale" ADD CONSTRAINT "ComparableSale_propertyValuationId_fkey" FOREIGN KEY ("propertyValuationId") REFERENCES "PropertyValuation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSuburb" ADD CONSTRAINT "DealSuburb_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealSuburb" ADD CONSTRAINT "DealSuburb_suburbProfileId_fkey" FOREIGN KEY ("suburbProfileId") REFERENCES "SuburbProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
