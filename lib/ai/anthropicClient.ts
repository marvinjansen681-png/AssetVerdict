/**
 * Minimal server-side Anthropic Messages API wrapper. Mirrors the raw-fetch
 * pattern already used by app/api/deals/[id]/mentor/route.ts and
 * app/api/area/extract/route.ts (no @anthropic-ai/sdk dependency in this
 * codebase) — centralised here now that Deal Coach needs a system prompt,
 * conversation history, tool-forced structured output, and a timeout, which
 * would otherwise mean duplicating this fetch call with more options.
 *
 * Server-only: never import this from a "use client" file. The API key never
 * leaves the server.
 */

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 25_000;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CallAnthropicParams {
  model: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens: number;
  tools?: AnthropicTool[];
  toolChoice?: { type: "tool"; name: string };
  timeoutMs?: number;
}

export type AnthropicCallResult =
  | { ok: true; textBlocks: string[]; toolUse?: { name: string; input: unknown } }
  | { ok: false; kind: "timeout" | "provider_error" | "network_error"; status?: number; detail?: string };

/**
 * Calls the Anthropic Messages API and returns a discriminated result rather
 * than throwing, so route handlers can map failures to clean user-facing
 * errors (Phase 3 brief section 32) without a try/catch pyramid.
 */
export async function callAnthropicMessages(params: CallAnthropicParams): Promise<AnthropicCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, kind: "provider_error", detail: "ANTHROPIC_API_KEY is not configured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: params.messages,
        ...(params.tools ? { tools: params.tools } : {}),
        ...(params.toolChoice ? { tool_choice: params.toolChoice } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, kind: "provider_error", status: res.status, detail: detail.slice(0, 500) };
    }

    const data = await res.json();
    const content: Array<{ type: string; text?: string; name?: string; input?: unknown }> = data.content ?? [];
    const textBlocks = content.filter((b) => b.type === "text" && b.text).map((b) => b.text as string);
    const toolUseBlock = content.find((b) => b.type === "tool_use");

    return {
      ok: true,
      textBlocks,
      toolUse: toolUseBlock ? { name: toolUseBlock.name as string, input: toolUseBlock.input } : undefined,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, kind: "timeout" };
    }
    return { ok: false, kind: "network_error", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

/** The model AssetVerdict's existing AI features (mentor, area extraction) already use — kept as a single named constant rather than a magic string per call site. */
export const DEAL_COACH_MODEL = "claude-sonnet-5";
