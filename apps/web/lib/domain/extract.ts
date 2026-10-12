import type { Clock } from "./clock";
import { parseDeadline, parseNumber, removeSpans } from "./dates";
import {
  extractionProposalSchema,
  type ExtractionProposal,
  type ItemKind,
  type ProposedItem,
} from "./proposal";

// The zero-dependency extraction path (ADR-007): always available, no
// network, no API key. Emits exactly the schema the AI path emits
// (lib/domain/proposal.ts), so the review screen never knows or cares
// which one ran beyond the `engine` label it shows the user.
//
// Everything here is a heuristic — keyword and pattern rules, not language
// understanding. The rules are written to be readable and individually
// testable rather than clever, so a wrong classification can be traced to
// the one rule that caused it.

export interface ExtractOptions {
  clock: Clock;
  timeZone?: string;
}

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";

// ------------------------------------------------------------- splitting

export function splitFragments(raw: string): string[] {
  const protectedText = raw
    // "December 25, 2026" — the comma belongs to the date, not the list.
    .replace(
      new RegExp(String.raw`\b(${MONTHS})\.?\s+(\d{1,2})(st|nd|rd|th)?,\s*(\d{4})`, "gi"),
      "$1 $2$3 $4"
    );

  // Lines first, so a list marker ("2. ", "- ") is stripped before the
  // sentence splitter can mistake its full stop for the end of a sentence.
  return protectedText
    .split(/\r?\n|•/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""))
    .flatMap((line) => line.split(/;|(?<=[.!?])\s+|,\s*/))
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

// ---------------------------------------------------------------- filler

const CONJUNCTION_FILLER = /^(?:and|also|then|plus|oh|so|ok|okay|um|uh|right|but)\b[,\s]*/i;

// "I need to", "must", "should"... — filler in front of a task, but
// meaning-bearing in a question ("should I switch banks?"), so notes only
// get the conjunction pass.
const OBLIGATION_FILLER =
  /^(?:i\s+(?:really\s+|also\s+|still\s+|definitely\s+|just\s+)*(?:need|have|want|ought|got)\s+to|i(?:'ve|\s+have)\s+got\s+to|i\s+(?:must|should)|(?:really\s+)?(?:need|have|got)\s+to|gotta|must|should|(?:don'?t\s+)?forget\s+to|remember\s+to|make\s+sure\s+(?:i|to)|i'?ll|i\s+will)\s+/i;

// Sentences that carry feeling, not work.
const NOISE =
  /^(?:i'?ve\s+got|i\s+have\s+got|i\s+have|there'?s|i'?m|so)\s+(?:so\s+much|loads|a\s+lot|lots|too\s+much|tons|a\s+ton|swamped|overwhelmed)(?:\s+(?:going\s+on|to\s+do|on\s+my\s+plate|happening))?$|^(?:that'?s\s+(?:it|all)|thanks|anyway|etc)$/i;

function stripFiller(fragment: string, kind: ItemKind): string {
  const patterns =
    kind === "note" ? [CONJUNCTION_FILLER] : [CONJUNCTION_FILLER, OBLIGATION_FILLER];
  let result = fragment;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const next = result.replace(pattern, "");
      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }
  return result.replace(/[\s.!;,]+$/, "").trim();
}

// ------------------------------------------------------------ recurrence

interface RecurrenceMatch {
  frequency: "daily" | "weekly" | "monthly";
  timesPerPeriod: number;
  span: [number, number];
}

const PERIOD: Record<string, "daily" | "weekly" | "monthly"> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
};

export function matchRecurrence(text: string): RecurrenceMatch | null {
  // "three times this week", "3x a week", "twice a month", "once a day"
  const counted =
    /\b(\d+|one|two|three|four|five|six|seven|once|twice)\s*(?:times?|x|×)?\s+(?:a|per|each|every|this)\s+(day|week|month)\b/i.exec(
      text
    );
  if (counted) {
    const token = counted[1].toLowerCase();
    const times =
      token === "once" ? 1 : token === "twice" ? 2 : (parseNumber(token) as number);
    return {
      frequency: PERIOD[counted[2].toLowerCase()],
      timesPerPeriod: times,
      span: [counted.index, counted.index + counted[0].length],
    };
  }

  // "every day", "every Monday", "every morning", "daily", "weekly"
  const every =
    /\bevery\s+(day|morning|evening|night|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday)\b|\b(daily|nightly|weekly|monthly)\b/i.exec(
      text
    );
  if (every) {
    const word = (every[1] ?? every[2]).toLowerCase();
    const frequency: "daily" | "weekly" | "monthly" =
      /^(day|morning|evening|night|weekday|daily|nightly)$/.test(word)
        ? "daily"
        : /^(month|monthly)$/.test(word)
          ? "monthly"
          : "weekly";
    return {
      frequency,
      timesPerPeriod: 1,
      span: [every.index, every.index + every[0].length],
    };
  }

  return null;
}

// --------------------------------------------------------- classification

const NOTE =
  /^(?:idea|note|thought|fyi|random\s+thought)\s*[:\-]|^(?:what\s+if|i\s+wonder|wonder\s+if|it\s+would\s+be\s+(?:nice|cool|good|great)\s+(?:to|if))\b|\?\s*$/i;

const GOAL =
  /\b(?:goal|long[- ]term|side\s+(?:business|hustle)|my\s+(?:own\s+)?business|career|get\s+fit|lose\s+weight|run\s+a\s+marathon|learn\s+(?:to|how|a|an|the|spanish|french|german|piano|guitar|code|coding)|become\s+(?:a|an)|save\s+(?:up|for|money))\b/i;

const PROJECT =
  /\b(?:project|launch|redesign|renovate|refurbish|overhaul|start\s+(?:sorting|organi[sz]ing|clearing|decorating|renovating|planning|building|writing)|(?:sort|organi[sz]e|clear|declutter)\s+(?:out\s+)?the\s+(?:garage|attic|loft|house|shed|basement|office|spare\s+room)|plan\s+(?:the|a|my|our)\s+(?:wedding|trip|holiday|party|move|event|launch))\b/i;

export function classify(fragment: string, hasRecurrence: boolean): ItemKind {
  if (hasRecurrence) return "recurring";
  if (NOTE.test(fragment)) return "note";
  if (GOAL.test(fragment)) return "goal";
  if (PROJECT.test(fragment)) return "project";
  return "task";
}

// --------------------------------------------------------- area grouping

// Suggested groupings, mirroring the life areas in the PRD's worked example
// (Work, Personal Admin, Home, Health, Family). A suggestion only — the
// review screen lets the user rename, merge, or clear it.
const AREAS: Array<[string, RegExp]> = [
  [
    "Work",
    /\b(?:report|client|meeting|deck|presentation|proposal|invoice|boss|colleague|quarterly|slides|standup|manager)\b/i,
  ],
  [
    "Personal admin",
    /\b(?:dentist|doctor|gp|appointment|insurance|renew|bank|tax|taxes|bill|bills|passport|licence|license|mot|council|pension|vet)\b/i,
  ],
  [
    "Home",
    /\b(?:garage|house|kitchen|garden|laundry|shed|attic|loft|plumber|boiler|hoover|vacuum|dishes|bins?|groceries|shopping)\b/i,
  ],
  ["Health", /\b(?:gym|run|running|workout|exercise|yoga|swim|swimming|physio|walk)\b/i],
  [
    "Family",
    /\b(?:mum|mom|dad|mother|father|family|kids|son|daughter|sister|brother|grandma|gran|grandad|grandpa|wife|husband|partner|parents)\b/i,
  ],
];

export function suggestArea(title: string): string | null {
  for (const [area, pattern] of AREAS) {
    if (pattern.test(title)) return area;
  }
  return null;
}

// -------------------------------------------------------------- estimates

const ESTIMATE_LEAD = String.raw`(?:\b(?:takes?|taking|about|around|roughly|approx(?:imately)?\.?|for)\s+|~\s*)`;

// Needs a lead-in word, "~", or parentheses — a bare "2 hours" is more
// often a deadline ("call back in 2 hours") than a duration.
const ESTIMATE = new RegExp(
  String.raw`\s*(?:\(\s*${ESTIMATE_LEAD}?|${ESTIMATE_LEAD})(?:(\d+)\s*(min(?:ute)?s?|h(?:ou)?rs?|h)\b|(half\s+an\s+hour|an\s+hour))\s*\)?`,
  "i"
);

export function matchEstimate(
  text: string
): { minutes: number; span: [number, number] } | null {
  const m = ESTIMATE.exec(text);
  if (!m) return null;
  let minutes: number;
  if (m[3]) {
    minutes = m[3].toLowerCase().startsWith("half") ? 30 : 60;
  } else {
    const n = Number(m[1]);
    minutes = m[2].toLowerCase().startsWith("h") ? n * 60 : n;
  }
  if (minutes < 1 || minutes > 24 * 60) return null;
  return { minutes, span: [m.index, m.index + m[0].length] };
}

// ------------------------------------------------------------------ public

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function extractItem(fragment: string, options: ExtractOptions): ProposedItem | null {
  if (NOISE.test(fragment.replace(/[.!]+$/, "").trim())) return null;

  const recurrence = matchRecurrence(fragment);
  const kind = classify(fragment, Boolean(recurrence));

  let working = fragment;
  const spans: Array<[number, number]> = [];

  if (recurrence) spans.push(recurrence.span);

  // A recurring item's "every Monday" is its cadence, not a deadline.
  const deadline = recurrence ? null : parseDeadline(working, options);
  if (deadline) spans.push(...deadline.spans);

  working = removeSpans(working, spans);

  const estimate = matchEstimate(working);
  if (estimate) working = removeSpans(working, [estimate.span]);

  const isQuestion = kind === "note" && /\?\s*$/.test(working);
  let title = stripFiller(working.replace(/\?\s*$/, ""), kind);
  if (isQuestion) title += "?";
  title = capitalise(title);

  if (title.length < 2) return null;

  return {
    kind,
    title: title.slice(0, 500),
    deadline: deadline
      ? {
          at: deadline.at.toISOString(),
          confidence: deadline.confidence,
          source: deadline.source,
        }
      : null,
    recurrence: recurrence
      ? { frequency: recurrence.frequency, timesPerPeriod: recurrence.timesPerPeriod }
      : null,
    estimatedMinutes: estimate?.minutes ?? null,
    project: kind === "goal" || kind === "note" ? null : suggestArea(title),
  };
}

export function extract(rawText: string, options: ExtractOptions): ExtractionProposal {
  const seen = new Set<string>();
  const items: ProposedItem[] = [];

  for (const fragment of splitFragments(rawText)) {
    const item = extractItem(fragment, options);
    if (!item) continue;
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length === 200) break;
  }

  // Parsing our own output proves the heuristic honours the same contract
  // the AI path is held to — a schema drift fails loudly here, not in the UI.
  return extractionProposalSchema.parse({ engine: "heuristic", items });
}
