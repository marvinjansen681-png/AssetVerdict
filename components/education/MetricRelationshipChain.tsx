import { getKeyLabel, type RelationshipChain } from "@/lib/education/relationshipChains";

/**
 * A small, deterministic visual for one curated relationship chain — plain
 * vertical steps with arrows, deliberately simple (no diagramming library,
 * no animation) so it stays legible and stacks cleanly on mobile. Steps that
 * are computed independently from the same prior input (not one feeding the
 * other) are rendered side by side rather than implying a false causal link
 * — see lib/education/relationshipChains.ts for why each chain is shaped
 * the way it is.
 */
export default function MetricRelationshipChain({ chain }: { chain: RelationshipChain }) {
  return (
    <div className="rounded-lg border border-av-light-grey bg-white p-4">
      <h4 className="font-body text-sm font-semibold text-av-navy mb-1">{chain.title}</h4>
      <p className="font-body text-xs text-av-slate mb-3 leading-relaxed">{chain.caption}</p>
      <ol className="flex flex-col items-start gap-0">
        {chain.steps.map((step, i) => (
          <li key={i} className="flex flex-col items-start w-full">
            {Array.isArray(step) ? (
              <div className="flex flex-wrap gap-2">
                {step.map((s) => (
                  <span
                    key={s}
                    className="text-xs font-mono font-semibold text-av-navy bg-av-light-grey rounded px-2 py-1"
                  >
                    {getKeyLabel(s)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs font-mono font-semibold text-av-navy bg-av-light-grey rounded px-2 py-1">
                {getKeyLabel(step)}
              </span>
            )}
            {i < chain.steps.length - 1 && (
              <span className="text-av-slate/50 text-sm leading-tight py-1" aria-hidden="true">
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
