/**
 * @module node-opcua-like-matcher
 *
 * The OPC 10000-4 `Like` FilterOperator, clause 7.4.4 Table 120
 * ("Wildcard characters").
 *
 * `Like` is a Part 4 primitive with several unrelated consumers: the
 * `AliasNameSearchPattern` argument of `FindAlias` and `FindAliasVerbose`
 * (OPC 10000-17 clause 6.3.2), the `applicationName` / `applicationUri` /
 * `productUri` filters of `QueryApplications` (OPC 10000-12), and Part 4 event
 * filter ContentFilters. Hence a package of its own, with no dependencies, so
 * none of those has to depend on another's.
 *
 * It is interpreted rather than translated into `RegExp` source, for two
 * reasons. A naive translation lets regular expression metacharacters in the
 * pattern leak through with their regex meaning — `a.b` would match `axb`, which
 * is wrong — and it inherits the backtracking engine's behaviour on patterns
 * with many `%`, which is a denial of service (see the cost note below). Every
 * character that is not one of the five wildcard constructs below is matched
 * literally.
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
 * ## Where the table is silent
 *
 * Table 120 defines `\` and `[...]` separately and never says what `\` means
 * *inside* a list. This implementation **honours the escape there too**, so
 * `[a\]b]` is the list `{a, ], b}` and `[a\-z]` is `{a, -, z}` rather than a
 * range. Two reasons: the table describes the escape unconditionally as allowing
 * "literal interpretation", and without it a literal `]` cannot be put in a list
 * at all. This is a reading, not a requirement — implementations may differ, so
 * it is stated here and pinned by tests rather than left to chance.
 *
 * ## Case sensitivity
 *
 * OPC 10000-4 states it directly, immediately above Table 120: *"The Like
 * operator is case sensitive."* So this is **not** a point the specification
 * leaves open, and {@link like} is case sensitive by default.
 *
 * Individual consumers may leave it open even though Part 4 does not. OPC
 * 10000-17 clause 6.2, for instance, requires only that a Client ignore an
 * AliasName's namespace when comparing, and says nothing about case — and plant
 * tag conventions such as ISA-5.1 are conventionally upper case without being
 * guaranteed to be entered that way. {@link LikeOptions.caseInsensitive} is
 * offered as an explicit opt-in for such a caller. Turning it on is a deliberate
 * deviation from Part 4, so it is off by default.
 *
 * The option affects **comparison only, never parsing**. Whether a pattern is
 * well formed is the same either way, so {@link isValidLikePattern} can never
 * disagree with the {@link LikePattern} a caller goes on to build. Ranges are
 * matched as written rather than case-folded, because folding the endpoints of
 * `[Z-a]` would give `[z-a]`, which matches nothing.
 *
 * ## Cost, and why the pattern length is capped
 *
 * Patterns arrive off the wire. `FindAlias` and `QueryApplications` are both
 * remote calls a Server will typically let an anonymous session make, so the
 * pattern is attacker-supplied and the cost of every stage is bounded
 * deliberately rather than incidentally.
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
 * A caller binding a Method whose argument is a search pattern should map this
 * to `Bad_InvalidArgument` rather than guessing at an intent — that is what
 * OPC 10000-17 clause 6.3.2 Table 4 prescribes for `FindAlias`, for instance.
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
        this.elements = parsePattern(pattern, options?.maxPatternLength ?? DEFAULT_MAX_PATTERN_LENGTH);
    }

    /** True when `subject` matches this pattern in its entirety. */
    public test(subject: string): boolean {
        return matchFrom(this.elements, 0, subject, 0, new Set<number>(), this.caseInsensitive);
    }
}

/**
 * Test `subject` against a OPC 10000-4 `Like` pattern.
 *
 * This parses `pattern` on every call. When testing many subjects against one
 * pattern — filtering a tag list, or the records of a `QueryApplications`
 * response — build a {@link LikePattern} once and call `test` per subject
 * instead. Besides the parsing saved, it reports a malformed pattern once,
 * up front, rather than only if some record happens to be tested: a `like()`
 * in a loop over an empty result set never notices a bad pattern at all.
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
        parsePattern(pattern, options?.maxPatternLength ?? DEFAULT_MAX_PATTERN_LENGTH);
        return true;
    } catch {
        return false;
    }
}

/**
 * Parse a pattern into elements.
 *
 * Case is deliberately **not** folded here. Folding at parse time would make
 * whether a pattern is *well formed* depend on a matching option: `[a-Z]` is a
 * reversed range unfolded but a valid one folded, and `[Z-a]` is the reverse.
 * `isValidLikePattern` would then be able to disagree with the `LikePattern` the
 * caller goes on to build. Folding also silently corrupts ranges — lower-casing
 * the endpoints of `[Z-a]` produces `[z-a]`, which matches nothing. Case is
 * handled at match time instead, where it only affects comparison.
 */
function parsePattern(pattern: string, maxPatternLength: number): PatternElement[] {
    // Checked before a single element is allocated: this is what keeps the
    // O(P) parse allocation bounded for a pattern that arrived from the network.
    if (pattern.length > maxPatternLength) {
        throw new InvalidLikePatternError(
            pattern,
            maxPatternLength,
            `pattern is ${pattern.length} characters, which exceeds the ${maxPatternLength} character limit`
        );
    }
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
            elements.push({ kind: "literal", value: pattern[i + 1] });
            i += 2;
            continue;
        }

        if (c === "[") {
            const { element, next } = parseList(pattern, i);
            elements.push(element);
            i = next;
            continue;
        }

        // Everything else - including ']', '.', '*', '(' and every other regular
        // expression metacharacter - is an ordinary character.
        elements.push({ kind: "literal", value: c });
        i += 1;
    }
    return elements;
}

/** One character inside a list, and whether it arrived escaped. */
interface ListAtom {
    char: string;
    escaped: boolean;
    /** Index in the pattern, for error reporting. */
    index: number;
}

/**
 * Parse a `[...]` list starting at `start` (which indexes the `[`).
 *
 * Table 120 defines `\` as the escape character and `[...]` as a list, but does
 * not say what `\` means *inside* a list. This implementation **honours the
 * escape inside lists**, for two reasons: the table describes the escape
 * unconditionally as allowing "literal interpretation", and it is otherwise
 * impossible to put a literal `]` in a list at all. So `[a\]b]` is the list
 * `{a, ], b}`, and `[\]]` is the list `{]}` rather than a parse error.
 *
 * The list is read into atoms first so that escaping composes properly: an
 * escaped `]` does not close the list, and an escaped `-` cannot act as a range
 * separator, which is what makes a literal `-` expressible in the middle of a
 * list (`[a\-z]` is `{a, -, z}`, not the range `a` to `z`).
 *
 * An unescaped `-` between two atoms forms a range. In first or last position it
 * is a literal, which is what makes `[-a]` and `[a-]` well formed.
 */
function parseList(pattern: string, start: number): { element: ListElement; next: number } {
    let i = start + 1;
    let negated = false;

    if (pattern[i] === "^") {
        // Table 120: "The ^ shall be the first character inside on the []"
        negated = true;
        i += 1;
    }

    const atoms: ListAtom[] = [];
    let closed = false;

    while (i < pattern.length) {
        const c = pattern[i];
        if (c === "]") {
            closed = true;
            i += 1;
            break;
        }
        if (c === "\\") {
            if (i + 1 >= pattern.length) {
                throw new InvalidLikePatternError(pattern, i, "dangling escape character");
            }
            atoms.push({ char: pattern[i + 1], escaped: true, index: i });
            i += 2;
            continue;
        }
        atoms.push({ char: c, escaped: false, index: i });
        i += 1;
    }

    if (!closed) {
        throw new InvalidLikePatternError(pattern, start, "unterminated '[' list");
    }

    const chars: string[] = [];
    const ranges: Array<{ from: string; to: string }> = [];
    let k = 0;
    while (k < atoms.length) {
        // A range is atom, unescaped '-', atom. "abc[13-68]" is therefore
        // literal '1', range '3'-'6', literal '8' - exactly the example in
        // Table 120.
        const isRange = k + 2 < atoms.length && !atoms[k + 1].escaped && atoms[k + 1].char === "-";
        if (isRange) {
            const from = atoms[k].char;
            const to = atoms[k + 2].char;
            // compared unfolded, so validity never depends on caseInsensitive
            if (from > to) {
                throw new InvalidLikePatternError(pattern, atoms[k].index, `range '${from}-${to}' is reversed`);
            }
            ranges.push({ from, to });
            k += 3;
            continue;
        }
        chars.push(atoms[k].char);
        k += 1;
    }

    if (chars.length === 0 && ranges.length === 0) {
        // "[]" and "[^]" have nothing to match against
        throw new InvalidLikePatternError(pattern, start, "empty '[]' list");
    }
    return { element: { kind: "list", negated, chars, ranges }, next: i };
}

/** True when two characters are equal, honouring the case-sensitivity setting. */
function charEquals(a: string, b: string, caseInsensitive: boolean): boolean {
    if (a === b) {
        return true;
    }
    return caseInsensitive && a.toLowerCase() === b.toLowerCase();
}

/** True when `c` is literally a member of the list, ignoring case folding. */
function isMember(element: ListElement, c: string): boolean {
    if (element.chars.includes(c)) {
        return true;
    }
    for (const range of element.ranges) {
        if (c >= range.from && c <= range.to) {
            return true;
        }
    }
    return false;
}

/**
 * True when the single character `c` satisfies the list element.
 *
 * Case insensitivity is applied by trying the other case of the *subject*
 * character rather than by folding the list. Folding a range's endpoints would
 * corrupt it — `[Z-a]` lower-cased becomes `[z-a]`, which matches nothing —
 * whereas testing `c`, `c.toLowerCase()` and `c.toUpperCase()` leaves the range
 * exactly as written.
 */
function listMatches(element: ListElement, c: string, caseInsensitive: boolean): boolean {
    let inList = isMember(element, c);
    if (!inList && caseInsensitive) {
        const lower = c.toLowerCase();
        const upper = c.toUpperCase();
        inList = (lower !== c && isMember(element, lower)) || (upper !== c && isMember(element, upper));
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
function matchFrom(
    elements: PatternElement[],
    ei: number,
    text: string,
    ti: number,
    failed: Set<number>,
    caseInsensitive: boolean
): boolean {
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
                if (matchFrom(elements, elementIndex + 1, text, skip, failed, caseInsensitive)) {
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
                if (!charEquals(text[textIndex], element.value, caseInsensitive)) {
                    return false;
                }
                break;
            case "list":
                if (!listMatches(element, text[textIndex], caseInsensitive)) {
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
