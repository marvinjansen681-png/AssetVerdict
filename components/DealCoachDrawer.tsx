"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import clsx from "clsx";
import Button from "@/components/ui/Button";
import { getMetricDefinition } from "@/lib/education/metricDefinitions";
import type { DealCoachIntent, DealCoachMessage, ScenarioKey } from "@/lib/ai/dealCoachTypes";

interface QuickAction {
  label: string;
  intent: DealCoachIntent;
  message: string;
}

const RENTAL_QUICK_ACTIONS: QuickAction[] = [
  { label: "Explain this deal simply", intent: "explain_deal_simple", message: "Explain this deal simply." },
  { label: "What worries you most?", intent: "identify_risks", message: "What worries you most about this deal?" },
  { label: "What's strongest about this deal?", intent: "identify_strengths", message: "What is strongest about this deal?" },
  { label: "What assumptions should I verify?", intent: "list_assumptions_to_verify", message: "What assumptions should I verify?" },
  { label: "What could make this deal fail?", intent: "identify_failure_modes", message: "What could make this deal fail?" },
  { label: "Compare Bear, Base and Bull", intent: "compare_scenarios", message: "Compare the Bear, Base, and Bull scenarios." },
  { label: "What should I investigate before buying?", intent: "due_diligence", message: "What should I investigate before buying?" },
  { label: "Teach me this deal", intent: "teach_deal", message: "Teach me this deal." },
];

const FLIP_QUICK_ACTIONS: QuickAction[] = RENTAL_QUICK_ACTIONS.filter((a) => a.intent !== "compare_scenarios");

const LOADING_MESSAGES = ["Reviewing your deal...", "Looking at the numbers..."];

interface ChatEntry extends DealCoachMessage {
  followUps?: string[];
}

export interface DealCoachSelectionRequest {
  metricKey: string;
}

interface DealCoachDrawerProps {
  dealId: string;
  strategyId: string;
  activeScenario: ScenarioKey;
  /** Set by a metric learning card's "Ask Deal Coach about this" — the drawer opens itself and asks on the user's behalf. */
  pendingSelection: DealCoachSelectionRequest | null;
  onPendingSelectionHandled: () => void;
}

export default function DealCoachDrawer({
  dealId,
  strategyId,
  activeScenario,
  pendingSelection,
  onPendingSelectionHandled,
}: DealCoachDrawerProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<{ message: string; intent?: DealCoachIntent; selectedMetric?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isFlip = strategyId === "fix_and_flip";
  const quickActions = isFlip ? FLIP_QUICK_ACTIONS : RENTAL_QUICK_ACTIONS;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, loading]);

  useEffect(() => {
    if (!pendingSelection) return;
    setOpen(true);
    const def = getMetricDefinition(pendingSelection.metricKey);
    const label = def?.shortName ?? def?.name ?? pendingSelection.metricKey;
    void sendMessage(`Tell me about my ${label}.`, "explain_metric", pendingSelection.metricKey);
    onPendingSelectionHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSelection]);

  async function sendMessage(message: string, intent?: DealCoachIntent, selectedMetric?: string) {
    setLoadingLabel(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    setLoading(true);
    setError(null);
    setLastAttempt({ message, intent, selectedMetric });

    const conversationSoFar: DealCoachMessage[] = entries.map(({ role, content }) => ({ role, content }));
    setEntries((prev) => [...prev, { role: "user", content: message }]);

    try {
      const res = await fetch(`/api/deals/${dealId}/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          intent,
          selectedMetric,
          activeScenario,
          conversation: conversationSoFar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Deal Coach couldn't respond right now. Your deal calculations are unaffected.");
        return;
      }
      setEntries((prev) => [...prev, { role: "assistant", content: data.answer, followUps: data.suggestedFollowUps }]);
    } catch {
      setError("Deal Coach couldn't respond right now. Your deal calculations are unaffected.");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput("");
    void sendMessage(trimmed);
  }

  function handleRetry() {
    if (!lastAttempt) return;
    setEntries((prev) => prev.slice(0, -1)); // drop the failed user turn we optimistically added
    void sendMessage(lastAttempt.message, lastAttempt.intent, lastAttempt.selectedMetric);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-6 z-30 inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-full bg-av-navy text-white font-body text-sm font-semibold shadow-lg hover:brightness-110 transition"
      >
        <MessageCircle size={16} />
        Deal Coach
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-av-light-grey shrink-0">
              <div>
                <h2 className="font-display text-lg text-av-navy">AssetVerdict Deal Coach</h2>
                <p className="font-body text-xs text-av-slate mt-0.5">Understand the deal before deciding.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close Deal Coach"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-av-slate hover:text-av-navy shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {entries.length === 0 && !loading && (
                <div className="flex flex-col gap-3">
                  <p className="font-body text-sm text-av-slate leading-relaxed">
                    Deal Coach helps you understand the numbers, assumptions and risks in this deal — it doesn&apos;t
                    replace AssetVerdict&apos;s calculations, and it isn&apos;t a licensed financial adviser.
                  </p>
                  <div className="flex flex-col gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => void sendMessage(action.message, action.intent)}
                        className="text-left font-body text-sm text-av-navy bg-av-light-grey hover:bg-av-light-grey/70 rounded-md px-3 py-2.5 min-h-[44px] transition"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {entries.map((entry, i) => (
                <div key={i} className={clsx("flex flex-col gap-1.5", entry.role === "user" && "items-end")}>
                  <div
                    className={clsx(
                      "font-body text-sm leading-relaxed whitespace-pre-line rounded-md px-3.5 py-2.5 max-w-[90%]",
                      entry.role === "user" ? "bg-av-navy text-white" : "bg-av-light-grey text-av-navy"
                    )}
                  >
                    {entry.content}
                  </div>
                  {entry.role === "assistant" && entry.followUps && entry.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {entry.followUps.map((followUp) => (
                        <button
                          key={followUp}
                          type="button"
                          onClick={() => void sendMessage(followUp)}
                          className="text-xs font-body text-av-navy border border-av-light-grey hover:bg-av-light-grey rounded-full px-3 py-1.5 min-h-[32px] transition"
                        >
                          {followUp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 font-body text-sm text-av-slate">
                  <span className="inline-block w-2 h-2 rounded-full bg-av-gold animate-pulse" />
                  {loadingLabel}
                </div>
              )}

              {error && (
                <div className="flex flex-col gap-2">
                  <p className="font-body text-sm text-av-red">{error}</p>
                  <Button variant="secondary" onClick={handleRetry} className="self-start">
                    Retry
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-av-light-grey p-3 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask about this deal..."
                  rows={1}
                  className="flex-1 resize-none font-body text-sm text-av-navy border border-av-light-grey rounded-md px-3 py-2.5 min-h-[44px] max-h-32 focus:outline-none focus:ring-1 focus:ring-av-navy"
                />
                <Button onClick={handleSend} disabled={loading || !input.trim()} className="shrink-0">
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
