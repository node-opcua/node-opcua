/**
 * @module node-opcua-alias-name-common
 *
 * The OPC 10000-4 `Like` FilterOperator, clause 7.4.4 Table 120
 * ("Wildcard characters").
 *
 * `Like` is used by the `AliasNameSearchPattern` argument of `FindAlias` and
 * `FindAliasVerbose` (OPC 10000-17 clause 6.3.2), by `QueryApplications` in
 * OPC 10000-12, and by event filters. It is implemented here rather than with a
 * translation to `RegExp` source, because a naive translation lets regular
 * expression metacharacters in the pattern leak through with their regex
 * meaning: `a.b` would match `axb`, which is wrong. Every character that is not
 * one of the five wildcard constructs below is matched literally.
 *
 * The five constructs of Table 120:
 *
 * | Pattern | Meaning                                                            |
 * |---------|--------------------------------------------------------------------|
 * | `%`     | any string of zero or more characters                              |
 * | `_`     | any single character                                               |
 * | `\`     | escape; `\\` is `\`, `\%` is `%`, `\_` is `_`                      |
 * | `[...]` | any single character in the list; supports ranges (`[c-f]`)        |
 * | `[^...]`| any single character *not* in the list; `^` must come first        |
 *
 * A list can also be used to make a wildcard literal, which is the documented
 * alternative to the escape character: `5[%]` matches `5%` and `5[_]` matches
 * `5_`.
 *
 * The whole subject string must match — the pattern is anchored at both ends.
 * `main%` matches anything starting with `main`, and `%en%` matches anything
 * containing `en`, exactly as Table 120 describes.
 *
 * ## Case sensitivity
 *
 * OPC 10000-4 states it directly, immediately above Table 120: *"The Like
 * operator is case sensitive."* So this is **not** a point the specification
 * leaves open, and {@link like} is case sensitive by default.
 *
 * What OPC 10000-17 does leave open is whether *AliasName* comparison should be
 * case sensitive. Clause 6.2 requires only that a Client ignore the namespace of
 * an AliasName when comparing; it says nothing about case. Since plant tag
 * conventions such as ISA-5.1 are conventionally upper case but are not
 * guaranteed to be entered that way, {@link LikeOptions.caseInsensitive} is
 * offered as an explicit opt-in for a server that wants to relax it. Turning it
 * on is a deliberate deviation from Part 4, so it is off by default.
 *
 * ## Cost, and why the pattern length is capped
 *
 * `AliasNameSearchPattern` is attacker-supplied: `FindAlias` is a remote Method
 * that a Server will typically let an anonymous session call. So the cost of
 * every stage is bounded deliberately rather than incidentally.
 *
 * Writing `P` for the pattern length, `E` for the number of parsed elements
 * (`E <= P`), `A` for the number of `%` elements left after consecutive ones are
 * collapsed (`A <= ceil(E/2)`) and `T` for the subject length:
 *
 * - **Parsing terminates.** The cursor strictly increases on every iteration of
 *   both {@link parsePattern} and {@link parseList}, so parsing costs `O(P)`
 *   steps and cannot loop.
 * - **Recursion depth is `O(T)`, not `O(P)`.** Recursion happens only at `%`.
 *   Consecutive `%` are collapsed during parsing, so between any two `%`
 *   elements there is at least one element that consumes exactly one character.
 *   Each extra nesting level therefore costs at least one character of the
 *   subject, bounding depth at `T + 2` however long the pattern is. A long
 *   pattern cannot overflow the stack.
 * - **Matching is `O(E * T)` time and `O(A * T)` memory.** The `failed` memo
 *   means each `(element, offset)` pair is explored at most once. Without it a
 *   pattern alternating `%` and `_` explores the same pairs by exponentially
 *   many routes and effectively never returns.
 * - **Parsing allocates `O(P)`** — one element object per construct. This is the
 *   only term that grows with attacker input, and the transport allows a String
 *   up to `BinaryStream.maxStringLength` (16 MB by default), which would turn a
 *   single call into roughly a gigabyte of objects.
 *
 * {@link DEFAULT_MAX_PATTERN_LENGTH} closes that last term, and in doing so
 * bounds every other one with it. A real search pattern is a tag glob such as
 * `TI1%`; 2 KB is already orders of magnitude beyond any practical use, so the
 * cap costs nothing and is not worth making generous.
 */

/**
 * Thrown when a search pattern is not a valid `Like` pattern.
 *
 * Callers binding `FindAlias` should map this to `Bad_InvalidArgument`
 * (OPC 10000-17 clause 6.3.2 Table 4) rather than guessing at an intent.
 */
export class InvalidLikePatternError extends Error {
    /** The pattern that could not be parsed. */
    public readonly pattern: string;
    /** Index into `pattern` at which parsing failed. */
    public readonly index: number;

    constructor(pattern: string, index: number, reason: string) {
        // The pattern comes from the network and may be megabytes long; quoting
        // it whole would copy it into the message, and into any log that records
        // the message. An excerpt is enough to identify the problem.
        const excerpt = pattern.length > 64 ? `${pattern.slice(0, 64)}... (${pattern.length} chars)` : pattern;
        super(`invalid Like pattern at index ${index}: ${reason} (pattern: ${JSON.stringify(excerpt)})`);
        this.name = "InvalidLikePatternError";
        this.pattern = pattern;
        this.index = index;
    }
}

/**
 * Longest pattern accepted by default, in characters.
 *
 * Parsing allocates one element per pattern character, and the pattern arrives
 * from the network, so an uncapped pattern is a memory-exhaustion vector — see
 * the cost note on this module. A search pattern in practice is a tag glob a few
 * characters long, so this is already far beyond real use.
 */
export const DEFAULT_MAX_PATTERN_LENGTH = 2048;

export interface LikeOptions {
    /**
     * Compare without regard to case. Off by default: OPC 10000-4 defines the
     * `Like` operator as case sensitive.
     */
    caseInsensitive?: boolean;
    /**
     * Longest pattern accepted, in characters. Defaults to
     * {@link DEFAULT_MAX_PATTERN_LENGTH}. A longer pattern raises
     * {@link InvalidLikePatternError}, which a Method binding reports as
     * `Bad_InvalidArgument`.
     *
     * Raise it only with a reason: the cost of parsing is linear in this value,
     * and it is the only bound standing between a remote caller and unbounded
     * allocation.
     */
    maxPatternLength?: number;
}

/** `%` — any run of zero or more characters. */
interface AnyStringElement {
    kind: "anyString";
}
/** `_` — exactly one character, any character. */
interface AnyCharElement {
    kind: "anyChar";
}
/** A character matched for itself, including an escaped wildcard. */
interface LiteralElement {
    kind: "literal";
    value: string;
}
/** `[abc]` / `[^abc]`, with optional ranges inside. */
interface ListElement {
    kind: "list";
    negated: boolean;
    /** Single characters accepted (or rejected, when negated). */
    chars: string[];
    /** Inclusive ranges accepted (or rejected, when negated). */
    ranges: Array<{ from: string; to: string }>;
}

type PatternElement = AnyStringElement | AnyCharElement | LiteralElement | ListElement;

/** A `Like` pattern parsed into elements, ready to match against many subjects. */
export class LikePattern {
    private readonly elements: PatternElement[];
    private readonly caseInsensitive: boolean;

    /**
     * @throws {@link InvalidLikePatternError} if the pattern is malformed, or
     * longer than {@link LikeOptions.maxPatternLength}.
     */
    constructor(pattern: string, options?: LikeOptions) {
        this.caseInsensitive = options?.caseInsensitive ?? false;
        this.elements = parsePattern(
            pattern,
            this.caseInsensitive,
            options?.maxPatternLength ?? DEFAULT_MAX_PATTERN_LENGTH
        );
    }

    /** True when `subject` matches this pattern in its entirety. */
    public test(subject: string): boolean {
        const text = this.caseInsensitive ? subject.toLowerCase() : subject;
        return matchFrom(this.elements, 0, text, 0, new Set<number>());
    }
}

/**
 * Test `subject` against a OPC 10000-4 `Like` pattern.
 *
 * @throws {@link InvalidLikePatternError} if `pattern` is malformed.
 */
export function like(subject: string, pattern: string, options?: LikeOptions): boolean {
    return new LikePattern(pattern, options).test(subject);
}

/**
 * True when `pattern` is a well-formed `Like` pattern.
 *
 * Useful for validating an argument before doing any work, without having to
 * catch. Note the specification places no restriction on how *broad* a pattern
 * may be — `%` alone is valid and matches everything.
 */
export function isValidLikePattern(pattern: string, options?: LikeOptions): boolean {
    try {
        parsePattern(pattern, false, options?.maxPatternLength ?? DEFAULT_MAX_PATTERN_LENGTH);
        return true;
    } catch {
        return false;
    }
}

/** Parse a pattern into elements, folding case up-front when requested. */
function parsePattern(pattern: string, caseInsensitive: boolean, maxPatternLength: number): PatternElement[] {
    // Checked before a single element is allocated: this is what keeps the
    // O(P) parse allocation bounded for a pattern that arrived from the network.
    if (pattern.length > maxPatternLength) {
        throw new InvalidLikePatternError(
            pattern,
            maxPatternLength,
            `pattern is ${pattern.length} characters, which exceeds the ${maxPatternLength} character limit`
        );
    }
    const fold = (c: string) => (caseInsensitive ? c.toLowerCase() : c);
    const elements: PatternElement[] = [];
    let i = 0;

    while (i < pattern.length) {
        const c = pattern[i];

        if (c === "%") {
            // collapse runs of % so that "%%%" does not cost exponential time
            if (elements[elements.length - 1]?.kind !== "anyString") {
                elements.push({ kind: "anyString" });
            }
            i += 1;
            continue;
        }

        if (c === "_") {
            elements.push({ kind: "anyChar" });
            i += 1;
            continue;
        }

        if (c === "\\") {
            // Table 120: the escape character allows literal interpretation.
            // A trailing backslash has nothing to escape, so it is malformed.
            if (i + 1 >= pattern.length) {
                throw new InvalidLikePatternError(pattern, i, "dangling escape character");
            }
            elements.push({ kind: "literal", value: fold(pattern[i + 1]) });
            i += 2;
            continue;
        }

        if (c === "[") {
            const { element, next } = parseList(pattern, i, fold);
            elements.push(element);
            i = next;
            continue;
        }

        // Everything else - including ']', '.', '*', '(' and every other regular
        // expression metacharacter - is an ordinary character.
        elements.push({ kind: "literal", value: fold(c) });
        i += 1;
    }
    return elements;
}

/**
 * Parse a `[...]` list starting at `start` (which indexes the `[`).
 *
 * Inside a list only `]` is special (it ends the list) and `-` between two
 * characters forms a range. A `-` in first or last position is a literal, which
 * is what makes `[a-]` and `[-a]` well formed.
 */
function parseList(pattern: string, start: number, fold: (c: string) => string): { element: ListElement; next: number } {
    let i = start + 1;
    let negated = false;

    if (pattern[i] === "^") {
        // Table 120: "The ^ shall be the first character inside on the []"
        negated = true;
        i += 1;
    }

    const chars: string[] = [];
    const ranges: Array<{ from: string; to: string }> = [];
    let closed = false;

    while (i < pattern.length) {
        if (pattern[i] === "]") {
            closed = true;
            i += 1;
            break;
        }

        const current = pattern[i];

        // A range needs a '-' followed by a character that is not the closing
        // bracket. "abc[13-68]" is therefore literal '1', range '3'-'6',
        // literal '8', which is exactly the example given in Table 120.
        const isRange = pattern[i + 1] === "-" && i + 2 < pattern.length && pattern[i + 2] !== "]";
        if (isRange) {
            const from = fold(current);
            const to = fold(pattern[i + 2]);
            if (from > to) {
                throw new InvalidLikePatternError(pattern, i, `range '${current}-${pattern[i + 2]}' is reversed`);
            }
            ranges.push({ from, to });
            i += 3;
            continue;
        }

        chars.push(fold(current));
        i += 1;
    }

    if (!closed) {
        throw new InvalidLikePatternError(pattern, start, "unterminated '[' list");
    }
    if (chars.length === 0 && ranges.length === 0) {
        // "[]" and "[^]" have nothing to match against
        throw new InvalidLikePatternError(pattern, start, "empty '[]' list");
    }
    return { element: { kind: "list", negated, chars, ranges }, next: i };
}

/** True when the single character `c` satisfies the list element. */
function listMatches(element: ListElement, c: string): boolean {
    let inList = element.chars.includes(c);
    if (!inList) {
        for (const range of element.ranges) {
            if (c >= range.from && c <= range.to) {
                inList = true;
                break;
            }
        }
    }
    return element.negated ? !inList : inList;
}

/**
 * Match `elements` from `ei` against `text` from `ti`.
 *
 * Backtracking is confined to `%`; everything else consumes exactly one
 * character. A pattern alternating `%` and `_` would still explore the same
 * (element, offset) pair through many different routes, so `failed` records the
 * pairs already known not to match. That caps the work at
 * O(elements x text.length) instead of the exponential blow-up a plain
 * backtracker suffers on a pattern like `%_%_%_...`.
 */
function matchFrom(elements: PatternElement[], ei: number, text: string, ti: number, failed: Set<number>): boolean {
    let elementIndex = ei;
    let textIndex = ti;
    const stride = text.length + 1;

    while (elementIndex < elements.length) {
        const element = elements[elementIndex];

        if (element.kind === "anyString") {
            // A trailing % matches the rest of the subject, whatever it is.
            if (elementIndex === elements.length - 1) {
                return true;
            }
            for (let skip = textIndex; skip <= text.length; skip++) {
                const key = (elementIndex + 1) * stride + skip;
                if (failed.has(key)) {
                    continue;
                }
                if (matchFrom(elements, elementIndex + 1, text, skip, failed)) {
                    return true;
                }
                failed.add(key);
            }
            return false;
        }

        if (textIndex >= text.length) {
            return false;
        }

        switch (element.kind) {
            case "anyChar":
                break;
            case "literal":
                if (text[textIndex] !== element.value) {
                    return false;
                }
                break;
            case "list":
                if (!listMatches(element, text[textIndex])) {
                    return false;
                }
                break;
        }
        elementIndex += 1;
        textIndex += 1;
    }
    // the pattern is exhausted; the subject must be too (both ends are anchored)
    return textIndex === text.length;
}
