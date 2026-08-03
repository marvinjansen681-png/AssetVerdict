-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyType" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "askingPrice" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "marketValue" DOUBLE PRECISION,
    "transferBondCost" DOUBLE PRECISION,
    "renovationCost" DOUBLE PRECISION,
    "sourcingFee" DOUBLE PRECISION,
    "agentCommission" DOUBLE PRECISION,
    "wantToSell" BOOLEAN NOT NULL DEFAULT false,
    "saleYear" INTEGER,
    "incomeTaxRate" DOUBLE PRECISION DEFAULT 27,
    "capitalGainsTaxRate" DOUBLE PRECISION DEFAULT 22,
    "capitalGrowthRate" DOUBLE PRECISION DEFAULT 3,
    "rentalGrowthRate" DOUBLE PRECISION DEFAULT 8,
    "costInflation" DOUBLE PRECISION DEFAULT 5,
    "sustainableGrowthRate" DOUBLE PRECISION DEFAULT 5,
    "discountRate" DOUBLE PRECISION DEFAULT 10,
    "realGrowthFactor" DOUBLE PRECISION DEFAULT 10,
    "occupationFactor" DOUBLE PRECISION DEFAULT 10,
    "marketCapRate" DOUBLE PRECISION DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSource" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "ltvMode" TEXT NOT NULL DEFAULT 'percent',
    "ltvValue" DOUBLE PRECISION,
    "loanAmount" DOUBLE PRECISION,
    "interestRate" DOUBLE PRECISION,
    "termYears" INTEGER DEFAULT 15,
    "repaymentAmount" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashflowInputs" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "monthlyRent" DOUBLE PRECISION,
    "occupancyRate" DOUBLE PRECISION DEFAULT 88,
    "additionalIncome" DOUBLE PRECISION DEFAULT 0,
    "recoveries" DOUBLE PRECISION DEFAULT 0,
    "managementFeeMode" TEXT NOT NULL DEFAULT 'percent',
    "managementFeeValue" DOUBLE PRECISION DEFAULT 15,
    "maintenanceCostMode" TEXT NOT NULL DEFAULT 'percent',
    "maintenanceCostValue" DOUBLE PRECISION DEFAULT 5,
    "levies" DOUBLE PRECISION DEFAULT 0,
    "ratesAndTaxes" DOUBLE PRECISION,
    "insurance" DOUBLE PRECISION,
    "waterSewerage" DOUBLE PRECISION,
    "securityCleaning" DOUBLE PRECISION,
    "electricity" DOUBLE PRECISION,
    "badDebtsPct" DOUBLE PRECISION DEFAULT 5,

    CONSTRAINT "CashflowInputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapexItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "color" TEXT,

    CONSTRAINT "CapexItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Deal_userId_idx" ON "Deal"("userId");

-- CreateIndex
CREATE INDEX "FinanceSource_dealId_idx" ON "FinanceSource"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "CashflowInputs_dealId_key" ON "CashflowInputs"("dealId");

-- CreateIndex
CREATE INDEX "CapexItem_dealId_idx" ON "CapexItem"("dealId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSource" ADD CONSTRAINT "FinanceSource_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowInputs" ADD CONSTRAINT "CashflowInputs_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapexItem" ADD CONSTRAINT "CapexItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
