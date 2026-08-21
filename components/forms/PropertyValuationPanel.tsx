"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CurrencyInput from "@/components/ui/CurrencyInput";
import FormField from "@/components/ui/FormField";
import { useToast } from "@/components/ui/Toast";
import ReportImportButton, { type ExtractedReport } from "@/components/forms/ReportImportButton";
import type { PropertyValuation, PropertyValuationBasis } from "@/types";
import { hasMeaningfulPropertyValuation } from "@/lib/propertyValuation";

interface TxnLocal {
  id: string;
  transferDate: string;
  purchasePrice: number | null;
  buyerName: string;
  sellerName: string;
}

interface BondLocal {
  id: string;
  registrationDate: string;
  bondAmount: number | null;
  bondHolder: string;
  bondType: string;
}

interface CompLocal {
  id: string;
  address: string;
  saleDate: string;
  salePrice: number | null;
  extentSqm: number | null;
  pricePerSqm: number | null;
  distanceKm: number | null;
}

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function genId() {
  return `local-${Date.now()}-${Math.random()}`;
}

interface PropertyValuationPanelProps {
  dealId: string;
  initial: PropertyValuation | null;
  purchasePrice: number;
}

export default function PropertyValuationPanel({
  dealId,
  initial,
  purchasePrice,
}: PropertyValuationPanelProps) {
  const { showToast } = useToast();
  // Start expanded only when the row actually carries evidence — an empty
  // stub (created the moment this panel was first opened) shouldn't look
  // like there's something here to review.
  const [expanded, setExpanded] = useState(hasMeaningfulPropertyValuation(initial));
  const [saving, setSaving] = useState(false);

  const [estimatedValue, setEstimatedValue] = useState<number | null>(initial?.estimatedValue ?? null);
  const [valueConfidenceLow, setValueConfidenceLow] = useState<number | null>(initial?.valueConfidenceLow ?? null);
  const [valueConfidenceHigh, setValueConfidenceHigh] = useState<number | null>(initial?.valueConfidenceHigh ?? null);
  const [valuationConfidence, setValuationConfidence] = useState(initial?.valuationConfidence ?? "");
  const [valuationBasis, setValuationBasis] = useState<PropertyValuationBasis>(initial?.valuationBasis ?? "unknown");
  const [extentSqm, setExtentSqm] = useState<number | null>(initial?.extentSqm ?? null);
  const [buildingSizeSqm, setBuildingSizeSqm] = useState<number | null>(initial?.buildingSizeSqm ?? null);
  const [zoning, setZoning] = useState(initial?.zoning ?? "");
  const [sgCode, setSgCode] = useState(initial?.sgCode ?? "");
  const [reportDate, setReportDate] = useState(toDateInput(initial?.reportDate));
  const [ownerAgeBand, setOwnerAgeBand] = useState(initial?.ownerAgeBand ?? "");
  const [currentOwnerSince, setCurrentOwnerSince] = useState(toDateInput(initial?.currentOwnerSince));

  const [transactions, setTransactions] = useState<TxnLocal[]>(
    (initial?.transactions ?? []).map((t) => ({
      id: t.id,
      transferDate: toDateInput(t.transferDate),
      purchasePrice: t.purchasePrice ?? null,
      buyerName: t.buyerName ?? "",
      sellerName: t.sellerName ?? "",
    }))
  );

  const [bonds, setBonds] = useState<BondLocal[]>(
    (initial?.bonds ?? []).map((b) => ({
      id: b.id,
      registrationDate: toDateInput(b.registrationDate),
      bondAmount: b.bondAmount ?? null,
      bondHolder: b.bondHolder ?? "",
      bondType: b.bondType ?? "",
    }))
  );

  const [comparables, setComparables] = useState<CompLocal[]>(
    (initial?.comparables ?? []).map((c) => ({
      id: c.id,
      address: c.address ?? "",
      saleDate: toDateInput(c.saleDate),
      salePrice: c.salePrice ?? null,
      extentSqm: c.extentSqm ?? null,
      pricePerSqm: c.pricePerSqm ?? null,
      distanceKm: c.distanceKm ?? null,
    }))
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, 900);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    estimatedValue,
    valueConfidenceLow,
    valueConfidenceHigh,
    valuationConfidence,
    valuationBasis,
    extentSqm,
    buildingSizeSqm,
    zoning,
    sgCode,
    reportDate,
    ownerAgeBand,
    currentOwnerSince,
    transactions,
    bonds,
    comparables,
  ]);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/deals/${dealId}/valuation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimatedValue,
        valueConfidenceLow,
        valueConfidenceHigh,
        valuationConfidence: valuationConfidence || null,
        valuationBasis,
        extentSqm,
        buildingSizeSqm,
        zoning: zoning || null,
        sgCode: sgCode || null,
        reportDate: reportDate || null,
        ownerAgeBand: ownerAgeBand || null,
        currentOwnerSince: currentOwnerSince || null,
        transactions: transactions.map((t) => ({
          transferDate: t.transferDate || null,
          purchasePrice: t.purchasePrice,
          buyerName: t.buyerName || null,
          sellerName: t.sellerName || null,
        })),
        bonds: bonds.map((b) => ({
          registrationDate: b.registrationDate || null,
          bondAmount: b.bondAmount,
          bondHolder: b.bondHolder || null,
          bondType: b.bondType || null,
        })),
        comparables: comparables.map((c) => ({
          address: c.address || null,
          saleDate: c.saleDate || null,
          salePrice: c.salePrice,
          extentSqm: c.extentSqm,
          pricePerSqm: c.pricePerSqm,
          distanceKm: c.distanceKm,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      showToast("error", "Could not save property valuation.");
    }
  }

  const avmVsAsking =
    estimatedValue && purchasePrice > 0
      ? ((estimatedValue - purchasePrice) / purchasePrice) * 100
      : null;

  async function handleExtracted(extracted: ExtractedReport) {
    if (extracted.reportType !== "valuation") {
      showToast(
        "error",
        "That looks like a suburb or province report — import it from the Suburb Profiles page instead."
      );
      return;
    }

    setExpanded(true);
    const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
    const str = (v: unknown): string => (typeof v === "string" ? v : "");

    if (num(extracted.estimatedValue) !== null) setEstimatedValue(num(extracted.estimatedValue));
    if (num(extracted.valueConfidenceLow) !== null) setValueConfidenceLow(num(extracted.valueConfidenceLow));
    if (num(extracted.valueConfidenceHigh) !== null) setValueConfidenceHigh(num(extracted.valueConfidenceHigh));
    if (extracted.valuationConfidence) setValuationConfidence(str(extracted.valuationConfidence));
    if (num(extracted.extentSqm) !== null) setExtentSqm(num(extracted.extentSqm));
    if (num(extracted.buildingSizeSqm) !== null) setBuildingSizeSqm(num(extracted.buildingSizeSqm));
    if (extracted.zoning) setZoning(str(extracted.zoning));
    if (extracted.sgCode) setSgCode(str(extracted.sgCode));
    if (extracted.reportDate) setReportDate(toDateInput(str(extracted.reportDate)));
    if (extracted.ownerAgeBand) setOwnerAgeBand(str(extracted.ownerAgeBand));

    if (Array.isArray(extracted.transactions)) {
      setTransactions(
        (extracted.transactions as Record<string, unknown>[]).map((t) => ({
          id: genId(),
          transferDate: toDateInput(str(t.transferDate)),
          purchasePrice: num(t.purchasePrice),
          buyerName: str(t.buyerName),
          sellerName: str(t.sellerName),
        }))
      );
    }
    if (Array.isArray(extracted.bonds)) {
      setBonds(
        (extracted.bonds as Record<string, unknown>[]).map((b) => ({
          id: genId(),
          registrationDate: toDateInput(str(b.registrationDate)),
          bondAmount: num(b.bondAmount),
          bondHolder: str(b.bondHolder),
          bondType: str(b.bondType),
        }))
      );
    }
    if (Array.isArray(extracted.comparables)) {
      setComparables(
        (extracted.comparables as Record<string, unknown>[]).map((c) => ({
          id: genId(),
          address: str(c.address),
          saleDate: toDateInput(str(c.saleDate)),
          salePrice: num(c.salePrice),
          extentSqm: num(c.extentSqm),
          pricePerSqm: num(c.pricePerSqm),
          distanceKm: num(c.distanceKm),
        }))
      );
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-av-navy">
          Property Valuation (AVM)
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs font-body text-av-slate">
            {saving ? "Saving..." : ""}
          </span>
          <ReportImportButton label="Import from PDF" onExtracted={handleExtracted} />
          <Button type="button" variant="secondary" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "Hide" : "Add valuation data"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Estimated Value (AVM)">
              <CurrencyInput
                value={estimatedValue ?? ""}
                onChange={(e) => setEstimatedValue(e.target.value === "" ? null : Number(e.target.value))}
              />
            </FormField>
            <FormField label="Confidence">
              <select
                value={valuationConfidence}
                onChange={(e) => setValuationConfidence(e.target.value)}
                className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
              >
                <option value="">Unspecified</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </FormField>
            <FormField label="Valuation Basis" helperText="What condition of the property does this valuation describe?">
              <select
                value={valuationBasis}
                onChange={(e) => setValuationBasis(e.target.value as PropertyValuationBasis)}
                className="w-full rounded-md border border-av-light-grey bg-white px-3 py-2.5 min-h-[44px] font-body text-sm text-av-navy focus:outline-none focus:border-av-gold focus:ring-1 focus:ring-av-gold"
              >
                <option value="unknown">Unknown</option>
                <option value="current_condition">Current condition</option>
                <option value="post_renovation">Post-renovation / completed condition</option>
              </select>
            </FormField>
            <FormField label="Confidence Range Low">
              <CurrencyInput
                value={valueConfidenceLow ?? ""}
                onChange={(e) => setValueConfidenceLow(e.target.value === "" ? null : Number(e.target.value))}
              />
            </FormField>
            <FormField label="Confidence Range High">
              <CurrencyInput
                value={valueConfidenceHigh ?? ""}
                onChange={(e) => setValueConfidenceHigh(e.target.value === "" ? null : Number(e.target.value))}
              />
            </FormField>
            <FormField label="Extent (sqm)">
              <Input
                type="number"
                value={extentSqm ?? ""}
                onChange={(e) => setExtentSqm(e.target.value === "" ? null : Number(e.target.value))}
              />
            </FormField>
            <FormField label="Building Size (sqm)">
              <Input
                type="number"
                value={buildingSizeSqm ?? ""}
                onChange={(e) => setBuildingSizeSqm(e.target.value === "" ? null : Number(e.target.value))}
              />
            </FormField>
            <FormField label="Zoning">
              <Input value={zoning} onChange={(e) => setZoning(e.target.value)} />
            </FormField>
            <FormField label="SG Code">
              <Input value={sgCode} onChange={(e) => setSgCode(e.target.value)} />
            </FormField>
            <FormField label="Report Date">
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </FormField>
            <FormField label="Owner Since">
              <Input type="date" value={currentOwnerSince} onChange={(e) => setCurrentOwnerSince(e.target.value)} />
            </FormField>
            <FormField label="Owner Age Band">
              <Input
                value={ownerAgeBand}
                onChange={(e) => setOwnerAgeBand(e.target.value)}
                placeholder="e.g. 36-45"
              />
            </FormField>
          </div>

          {avmVsAsking !== null && (
            <div className="rounded-md bg-av-light-grey p-4 font-body text-sm text-av-navy flex justify-between">
              <span>AVM vs. Purchase Price</span>
              <span className="font-mono font-semibold text-av-navy">
                {avmVsAsking >= 0 ? "+" : ""}
                {avmVsAsking.toFixed(1)}%
              </span>
            </div>
          )}

          <ListSection
            title="Transaction History"
            addLabel="+ Add Transaction"
            onAdd={() =>
              setTransactions((prev) => [
                ...prev,
                { id: genId(), transferDate: "", purchasePrice: null, buyerName: "", sellerName: "" },
              ])
            }
          >
            {transactions.map((t) => (
              <div key={t.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border-b border-av-light-grey py-2">
                <Input
                  type="date"
                  value={t.transferDate}
                  onChange={(e) =>
                    setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, transferDate: e.target.value } : x)))
                  }
                />
                <CurrencyInput
                  value={t.purchasePrice ?? ""}
                  onChange={(e) =>
                    setTransactions((prev) =>
                      prev.map((x) => (x.id === t.id ? { ...x, purchasePrice: e.target.value === "" ? null : Number(e.target.value) } : x))
                    )
                  }
                />
                <Input
                  placeholder="Buyer"
                  value={t.buyerName}
                  onChange={(e) => setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, buyerName: e.target.value } : x)))}
                />
                <Input
                  placeholder="Seller"
                  value={t.sellerName}
                  onChange={(e) => setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, sellerName: e.target.value } : x)))}
                />
                <button
                  type="button"
                  aria-label="Remove transaction"
                  onClick={() => setTransactions((prev) => prev.filter((x) => x.id !== t.id))}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate hover:text-av-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </ListSection>

          <ListSection
            title="Bond Information"
            addLabel="+ Add Bond"
            onAdd={() =>
              setBonds((prev) => [
                ...prev,
                { id: genId(), registrationDate: "", bondAmount: null, bondHolder: "", bondType: "" },
              ])
            }
          >
            {bonds.map((b) => (
              <div key={b.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border-b border-av-light-grey py-2">
                <Input
                  type="date"
                  value={b.registrationDate}
                  onChange={(e) => setBonds((prev) => prev.map((x) => (x.id === b.id ? { ...x, registrationDate: e.target.value } : x)))}
                />
                <CurrencyInput
                  value={b.bondAmount ?? ""}
                  onChange={(e) =>
                    setBonds((prev) => prev.map((x) => (x.id === b.id ? { ...x, bondAmount: e.target.value === "" ? null : Number(e.target.value) } : x)))
                  }
                />
                <Input
                  placeholder="Bond Holder"
                  value={b.bondHolder}
                  onChange={(e) => setBonds((prev) => prev.map((x) => (x.id === b.id ? { ...x, bondHolder: e.target.value } : x)))}
                />
                <Input
                  placeholder="Type (e.g. First Bond)"
                  value={b.bondType}
                  onChange={(e) => setBonds((prev) => prev.map((x) => (x.id === b.id ? { ...x, bondType: e.target.value } : x)))}
                />
                <button
                  type="button"
                  aria-label="Remove bond"
                  onClick={() => setBonds((prev) => prev.filter((x) => x.id !== b.id))}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate hover:text-av-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </ListSection>

          <ListSection
            title="Comparable Sales"
            addLabel="+ Add Comparable"
            onAdd={() =>
              setComparables((prev) => [
                ...prev,
                { id: genId(), address: "", saleDate: "", salePrice: null, extentSqm: null, pricePerSqm: null, distanceKm: null },
              ])
            }
          >
            {comparables.map((c) => (
              <div key={c.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center border-b border-av-light-grey py-2">
                <Input
                  placeholder="Address"
                  value={c.address}
                  onChange={(e) => setComparables((prev) => prev.map((x) => (x.id === c.id ? { ...x, address: e.target.value } : x)))}
                  className="md:col-span-2"
                />
                <Input
                  type="date"
                  value={c.saleDate}
                  onChange={(e) => setComparables((prev) => prev.map((x) => (x.id === c.id ? { ...x, saleDate: e.target.value } : x)))}
                />
                <CurrencyInput
                  value={c.salePrice ?? ""}
                  onChange={(e) =>
                    setComparables((prev) => prev.map((x) => (x.id === c.id ? { ...x, salePrice: e.target.value === "" ? null : Number(e.target.value) } : x)))
                  }
                />
                <Input
                  type="number"
                  placeholder="sqm"
                  value={c.extentSqm ?? ""}
                  onChange={(e) => setComparables((prev) => prev.map((x) => (x.id === c.id ? { ...x, extentSqm: e.target.value === "" ? null : Number(e.target.value) } : x)))}
                />
                <button
                  type="button"
                  aria-label="Remove comparable"
                  onClick={() => setComparables((prev) => prev.filter((x) => x.id !== c.id))}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate hover:text-av-red transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </ListSection>
        </div>
      )}
    </section>
  );
}

function ListSection({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-body text-sm font-semibold text-av-navy">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-body px-3 py-1.5 min-h-[32px] rounded-full border border-av-gold text-av-navy hover:bg-av-gold/10 transition-colors"
        >
          {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}
