import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const MAX_PDF_BYTES = 15 * 1024 * 1024; // Anthropic's per-file limit is 32MB; keep well under it.

const EXTRACTION_TOOL = {
  name: "extract_report_data",
  description:
    "Extract structured data from a TPN (or similar credit bureau) property/area intelligence report.",
  input_schema: {
    type: "object",
    properties: {
      reportType: {
        type: "string",
        enum: ["valuation", "suburb", "multiple_suburbs", "province"],
        description:
          "'valuation' for a single-property AVM/valuation report, 'suburb' for a single-suburb investor report, 'multiple_suburbs' for a report covering several suburbs (use the primary/first suburb's data), 'province' for a province-level investor report.",
      },
      suburbName: { type: "string" },
      city: { type: "string" },
      province: { type: "string" },
      reportDate: { type: "string", description: "ISO 8601 date, e.g. 2026-08-03" },
      reportYear: { type: "number" },

      // Valuation report fields
      sgCode: { type: "string" },
      propertyDescription: { type: "string" },
      extentSqm: { type: "number" },
      zoning: { type: "string" },
      buildingSizeSqm: { type: "number" },
      bedroomsReported: { type: "number" },
      bathroomsReported: { type: "number" },
      garagesReported: { type: "number" },
      yearBuiltReported: { type: "number" },
      estimatedValue: { type: "number" },
      valueConfidenceLow: { type: "number" },
      valueConfidenceHigh: { type: "number" },
      valuationConfidence: { type: "string", enum: ["High", "Medium", "Low"] },
      pricePerSqm: { type: "number" },
      currentOwnerSince: { type: "string" },
      ownerAgeBand: { type: "string" },
      transactions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            transferDate: { type: "string" },
            purchasePrice: { type: "number" },
            buyerName: { type: "string" },
            sellerName: { type: "string" },
          },
        },
      },
      bonds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            registrationDate: { type: "string" },
            bondAmount: { type: "number" },
            bondHolder: { type: "string" },
            bondType: { type: "string" },
          },
        },
      },
      comparables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            address: { type: "string" },
            sgCode: { type: "string" },
            saleDate: { type: "string" },
            salePrice: { type: "number" },
            extentSqm: { type: "number" },
            buildingSizeSqm: { type: "number" },
            pricePerSqm: { type: "number" },
            distanceKm: { type: "number" },
          },
        },
      },

      // Suburb / Province report fields
      paidOnTimePct: { type: "number" },
      gracePeriodPct: { type: "number" },
      paidLatePct: { type: "number" },
      partialPaymentPct: { type: "number" },
      didNotPayPct: { type: "number" },
      goodStandingPct: { type: "number" },
      provinceGoodStandingPct: { type: "number" },
      nationalGoodStandingPct: { type: "number" },
      stGrossYield: { type: "number" },
      stEffectiveYield: { type: "number" },
      fhGrossYield: { type: "number" },
      fhEffectiveYield: { type: "number" },
      nationalGrossYield: { type: "number" },
      stSmallBedLow: { type: "number" },
      stSmallBedAvg: { type: "number" },
      stSmallBedHigh: { type: "number" },
      st2BedLow: { type: "number" },
      st2BedAvg: { type: "number" },
      st2BedHigh: { type: "number" },
      stLargeBedLow: { type: "number" },
      stLargeBedAvg: { type: "number" },
      stLargeBedHigh: { type: "number" },
      stRentalTrend: { type: "string", enum: [">10%Up", "Up", "None", "Down", ">10%Down"] },
      fhSmallBedLow: { type: "number" },
      fhSmallBedAvg: { type: "number" },
      fhSmallBedHigh: { type: "number" },
      fh3BedLow: { type: "number" },
      fh3BedAvg: { type: "number" },
      fh3BedHigh: { type: "number" },
      fhLargeBedLow: { type: "number" },
      fhLargeBedAvg: { type: "number" },
      fhLargeBedHigh: { type: "number" },
      fhRentalTrend: { type: "string", enum: [">10%Up", "Up", "None", "Down", ">10%Down"] },
      stAvgPurchasePrice: { type: "number" },
      fhAvgPurchasePrice: { type: "number" },
      stTransactionVolume: { type: "number" },
      fhTransactionVolume: { type: "number" },
      investmentPropertyPct: { type: "number" },
      formalSectorPct: { type: "number" },
      unemployedPct: { type: "number" },
      incomeMiddleBandPct: { type: "number" },
      incomeHighBandPct: { type: "number" },
      age17to25Pct: { type: "number" },
      age26to40Pct: { type: "number" },
      age41to60Pct: { type: "number" },
      largeHouseholdPct: { type: "number" },
      singlePersonHouseholdPct: { type: "number" },
      provinceSTGrossYield: { type: "number" },
      provinceFHGrossYield: { type: "number" },
      provinceST2BedAvgRent: { type: "number" },
      provinceFH3BedAvgRent: { type: "number" },
      provinceSTLargeBedAvg: { type: "number" },
      provinceFHLargeBedAvg: { type: "number" },
    },
    required: ["reportType"],
  },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on this server" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const fileBase64: string | undefined = body.fileBase64;
  if (!fileBase64 || typeof fileBase64 !== "string") {
    return NextResponse.json({ error: "fileBase64 is required" }, { status: 400 });
  }

  const approxBytes = Math.ceil((fileBase64.length * 3) / 4);
  if (approxBytes > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF is too large (max 15MB)" }, { status: 413 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4000,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: "extract_report_data" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
            },
            {
              type: "text",
              text:
                "This is a TPN (or similar credit bureau) property/area intelligence report. " +
                "Identify its type and extract every field you can find, including chart-derived values " +
                "(yields, rental price trends, payment index percentages, demographic breakdowns). " +
                "Use null/omit fields you cannot find — never fabricate numbers. Percentages should be " +
                "plain numbers (e.g. 72.5, not '72.5%'). Dates should be ISO 8601.",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json(
      { error: "Failed to extract report data", detail: errText.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find((block: { type: string }) => block.type === "tool_use");

  if (!toolUse) {
    return NextResponse.json({ error: "Model did not return structured data" }, { status: 502 });
  }

  return NextResponse.json({ extracted: toolUse.input });
}
