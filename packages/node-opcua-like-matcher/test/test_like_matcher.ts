import should from "should";
import { DEFAULT_MAX_PATTERN_LENGTH, InvalidLikePatternError, isValidLikePattern, LikePattern, like } from "../source";

/**
 * OPC 10000-4 clause 7.4.4, Table 120 - "Wildcard characters".
 *
 * Every row of the table gets its own describe block, and every example the
 * table itself gives is asserted verbatim, so a row cannot silently go
 * untested.
 */
describe("OPC 10000-4: the Like operator (Table 120)", () => {
    describe("row '%' - match any string of zero or more characters", () => {
        it("should match the table's example: 'main%' matches any string starting with 'main'", () => {
            like("main", "main%").should.eql(true);
            like("maintenance", "main%").should.eql(true);
            like("mainstream", "main%").should.eql(true);
            like("domain", "main%").should.eql(false);
        });

        it("should match the table's example: '%en%' matches 'entail', 'green' and 'content'", () => {
            like("entail", "%en%").should.eql(true);
            like("green", "%en%").should.eql(true);
            like("content", "%en%").should.eql(true);
            like("aardvark", "%en%").should.eql(false);
        });

        it("should match zero characters", () => {
            like("main", "main%").should.eql(true);
            like("", "%").should.eql(true);
        });

        it("should be anchored: a pattern without % must match the whole subject", () => {
            like("main", "main").should.eql(true);
            like("maintenance", "main").should.eql(false);
            like("domain", "main").should.eql(false);
        });

        it("should match the table's example for the list-operand escape: '5[%]' matches '5%'", () => {
            like("5%", "5[%]").should.eql(true);
            like("5x", "5[%]").should.eql(false);
            like("5", "5[%]").should.eql(false);
        });

        it("should handle several % in one pattern", () => {
            like("TI101-temperature-sensor", "TI%temp%sensor").should.eql(true);
            like("TI101-temperature-sensor", "TI%pressure%sensor").should.eql(false);
        });

        it("should treat a run of % as a single %", () => {
            like("abc", "a%%%c").should.eql(true);
            like("ac", "a%%%c").should.eql(true);
        });
    });

    describe("row '_' - match any single character", () => {
        it("should match the table's example: '_ould' matches 'would' and 'could'", () => {
            like("would", "_ould").should.eql(true);
            like("could", "_ould").should.eql(true);
            like("should", "_ould").should.eql(false);
        });

        it("should require exactly one character, not zero", () => {
            like("ould", "_ould").should.eql(false);
        });

        it("should match the table's example for the list-operand escape: '5[_]' matches '5_'", () => {
            like("5_", "5[_]").should.eql(true);
            like("5x", "5[_]").should.eql(false);
        });

        it("should combine with %", () => {
            like("TI101", "TI___").should.eql(true);
            like("TI10", "TI___").should.eql(false);
        });
    });

    describe("row '\\' - escape character allows literal interpretation", () => {
        it("should match the table's examples: \\\\ is \\, \\% is %, \\_ is _", () => {
            like("\\", "\\\\").should.eql(true);
            like("%", "\\%").should.eql(true);
            like("_", "\\_").should.eql(true);
        });

        it("should stop an escaped % behaving as a wildcard", () => {
            like("100%", "100\\%").should.eql(true);
            like("100 percent", "100\\%").should.eql(false);
            // unescaped, the same pattern is a wildcard
            like("100 percent", "100%").should.eql(true);
        });

        it("should stop an escaped _ behaving as a wildcard", () => {
            like("a_c", "a\\_c").should.eql(true);
            like("abc", "a\\_c").should.eql(false);
        });

        it("should allow an escaped [", () => {
            like("[abc]", "\\[abc\\]").should.eql(true);
        });
    });

    describe("row '[]' - match any single character in a list", () => {
        it("should match the table's example: 'abc[13-68]' matches abc1, abc3..abc6 and abc8", () => {
            for (const s of ["abc1", "abc3", "abc4", "abc5", "abc6", "abc8"]) {
                like(s, "abc[13-68]").should.eql(true, `${s} should match`);
            }
            for (const s of ["abc2", "abc7", "abc9", "abc0"]) {
                like(s, "abc[13-68]").should.eql(false, `${s} should not match`);
            }
        });

        it("should match the table's example: 'xyz[c-f]' matches xyzc, xyzd, xyze and xyzf", () => {
            for (const s of ["xyzc", "xyzd", "xyze", "xyzf"]) {
                like(s, "xyz[c-f]").should.eql(true, `${s} should match`);
            }
            for (const s of ["xyzb", "xyzg", "xyza"]) {
                like(s, "xyz[c-f]").should.eql(false, `${s} should not match`);
            }
        });

        it("should match exactly one character, never zero or two", () => {
            like("abc", "abc[13-68]").should.eql(false);
            like("abc13", "abc[13-68]").should.eql(false);
        });

        it("should treat a trailing or leading '-' inside a list as a literal", () => {
            like("a-", "a[-]").should.eql(true);
            like("a-", "a[x-]").should.eql(true);
            like("ax", "a[x-]").should.eql(true);
            like("a-", "a[-x]").should.eql(true);
        });

        it("should treat regular expression metacharacters inside a list literally", () => {
            like("a.", "a[.]").should.eql(true);
            like("ax", "a[.]").should.eql(false);
            // '^' is the negation marker only in first position, so here both
            // '$' and '^' are ordinary members of the list
            like("a$", "a[$^]").should.eql(true);
            like("a^", "a[$^]").should.eql(true);
            like("ax", "a[$^]").should.eql(false);
        });
    });

    describe("row '[^]' - not matching any single character in a list", () => {
        it("should match the table's example: 'ABC[^13-5]' does not match ABC1, ABC3, ABC4, ABC5", () => {
            for (const s of ["ABC1", "ABC3", "ABC4", "ABC5"]) {
                like(s, "ABC[^13-5]").should.eql(false, `${s} should NOT match`);
            }
            for (const s of ["ABC2", "ABC6", "ABC9", "ABCx"]) {
                like(s, "ABC[^13-5]").should.eql(true, `${s} should match`);
            }
        });

        it("should match the table's example: 'xyz[^dgh]' does not match xyzd, xyzg, xyzh", () => {
            for (const s of ["xyzd", "xyzg", "xyzh"]) {
                like(s, "xyz[^dgh]").should.eql(false, `${s} should NOT match`);
            }
            for (const s of ["xyza", "xyzz", "xyz1"]) {
                like(s, "xyz[^dgh]").should.eql(true, `${s} should match`);
            }
        });

        it("should still require exactly one character to be present", () => {
            like("xyz", "xyz[^dgh]").should.eql(false);
        });

        it("should treat '^' as an ordinary member when it is not first", () => {
            like("a^", "a[b^]").should.eql(true);
            like("ab", "a[b^]").should.eql(true);
            like("ac", "a[b^]").should.eql(false);
        });
    });

    describe("combining wildcards (the specification's own combined example)", () => {
        it("should match 'Th[ia][ts]%' against the strings the prose lists", () => {
            for (const s of ["That is fine", "This is fine", "That as one", "This it is"]) {
                like(s, "Th[ia][ts]%").should.eql(true, `${s} should match`);
            }
        });

        it("should NOT match 'Then at any', which is an erratum in the OPC 10000-4 prose", () => {
            // The paragraph above Table 120 lists 'Then at any' among the strings
            // 'Th[ia][ts]%' would match, but its third character is 'e', which is
            // not in [ia]. The normative rules in the table itself win; the list
            // in the prose is illustrative and wrong on this entry. Asserted here
            // so nobody "fixes" the matcher to agree with the erratum.
            like("Then at any", "Th[ia][ts]%").should.eql(false);
        });

        it("should reject strings the combined pattern does not describe", () => {
            like("Those are fine", "Th[ia][ts]%").should.eql(false);
            like("The is fine", "Th[ia][ts]%").should.eql(false);
        });
    });

    describe("regular expression metacharacters are literal", () => {
        // This is the failure mode of every implementation that builds a RegExp
        // by substituting % and _ and leaving the rest of the pattern alone.
        it("should NOT let '.' match an arbitrary character", () => {
            like("axb", "a.b").should.eql(false);
            like("a.b", "a.b").should.eql(true);
        });

        it("should treat '*' and '+' literally", () => {
            like("aaa", "a*").should.eql(false);
            like("a*", "a*").should.eql(true);
            like("a+", "a+").should.eql(true);
            like("aa", "a+").should.eql(false);
        });

        it("should treat anchors literally", () => {
            like("^abc$", "^abc$").should.eql(true);
            like("abc", "^abc$").should.eql(false);
        });

        it("should treat grouping and alternation literally", () => {
            like("(a|b)", "(a|b)").should.eql(true);
            like("a", "(a|b)").should.eql(false);
        });

        it("should treat a quantifier brace literally", () => {
            like("a{2}", "a{2}").should.eql(true);
            like("aa", "a{2}").should.eql(false);
        });

        it("should treat ']' outside a list literally", () => {
            like("a]b", "a]b").should.eql(true);
        });

        it("should treat a '?' literally", () => {
            like("a?", "a?").should.eql(true);
            like("a", "a?").should.eql(false);
        });
    });

    describe("invalid patterns", () => {
        // A binding can map this to Bad_InvalidArgument (OPC 10000-17
        // clause 6.3.2 Table 4) instead of guessing what was meant.
        it("should throw a typed error on an unterminated '['", () => {
            should(() => like("abc", "abc[13")).throw(InvalidLikePatternError);
        });

        it("should throw a typed error on a dangling escape", () => {
            should(() => like("abc", "abc\\")).throw(InvalidLikePatternError);
        });

        it("should throw a typed error on an empty list", () => {
            should(() => like("abc", "abc[]")).throw(InvalidLikePatternError);
            should(() => like("abc", "abc[^]")).throw(InvalidLikePatternError);
        });

        it("should throw a typed error on a reversed range", () => {
            should(() => like("abc", "abc[f-c]")).throw(InvalidLikePatternError);
        });

        it("should carry the pattern and the failing index on the error", () => {
            try {
                like("abc", "abc[13");
                throw new Error("should have thrown");
            } catch (err) {
                should(err).be.instanceOf(InvalidLikePatternError);
                const typed = err as InvalidLikePatternError;
                typed.pattern.should.eql("abc[13");
                typed.index.should.eql(3);
            }
        });

        it("should report validity without throwing", () => {
            isValidLikePattern("abc[13-68]").should.eql(true);
            isValidLikePattern("%").should.eql(true);
            isValidLikePattern("").should.eql(true);
            isValidLikePattern("abc[13").should.eql(false);
            isValidLikePattern("abc\\").should.eql(false);
        });
    });

    describe("the escape character inside a character list", () => {
        // Table 120 defines both '\' and '[...]' but says nothing about '\'
        // *inside* a list, so this is a reading, not a requirement. We honour the
        // escape: the table describes the escape unconditionally as allowing
        // "literal interpretation", and it is otherwise impossible to put a
        // literal ']' in a list at all. Built from char codes so no quoting layer
        // can mangle the backslash.
        const BS = String.fromCharCode(92);

        it("should let an escaped ']' be a member instead of closing the list", () => {
            like("]", `[a${BS}]b]`).should.eql(true);
            like("a", `[a${BS}]b]`).should.eql(true);
            like("b", `[a${BS}]b]`).should.eql(true);
            like("c", `[a${BS}]b]`).should.eql(false);
        });

        it("should accept a list whose only member is an escaped ']'", () => {
            // without the escape this parses as the empty list "[]" and throws
            like("]", `[${BS}]]`).should.eql(true);
            like("x", `[${BS}]]`).should.eql(false);
        });

        it("should let an escaped '-' be a literal member in the middle of a list", () => {
            // unescaped this would be the range a..z
            like("-", `[a${BS}-z]`).should.eql(true);
            like("a", `[a${BS}-z]`).should.eql(true);
            like("z", `[a${BS}-z]`).should.eql(true);
            like("m", `[a${BS}-z]`).should.eql(false, "not a range");
        });

        it("should still treat an unescaped '-' between two atoms as a range", () => {
            like("m", "[a-z]").should.eql(true);
        });

        it("should let an escaped backslash be a member", () => {
            like(BS, `[${BS}${BS}]`).should.eql(true);
            like("x", `[${BS}${BS}]`).should.eql(false);
        });

        it("should reject a dangling escape inside a list", () => {
            should(() => like("a", `[a${BS}`)).throw(InvalidLikePatternError);
        });

        it("should treat an escaped wildcard inside a list as that character", () => {
            like("%", `[${BS}%]`).should.eql(true);
            like("_", `[${BS}_]`).should.eql(true);
        });
    });

    describe("pattern length limit", () => {
        // The pattern arrives from the network and parsing allocates one element
        // per character, so this cap is what stops a single FindAlias call from
        // turning a 16 MB String (the transport maximum) into ~1 GB of objects.
        it("should accept a pattern at the limit", () => {
            const atLimit = "a".repeat(DEFAULT_MAX_PATTERN_LENGTH);
            isValidLikePattern(atLimit).should.eql(true);
        });

        it("should reject a pattern one character over the limit", () => {
            const overLimit = "a".repeat(DEFAULT_MAX_PATTERN_LENGTH + 1);
            should(() => like("a", overLimit)).throw(InvalidLikePatternError);
            isValidLikePattern(overLimit).should.eql(false);
        });

        it("should say why it refused", () => {
            should(() => like("a", "a".repeat(DEFAULT_MAX_PATTERN_LENGTH + 1))).throw(/exceeds the 2048 character limit/);
        });

        it("should not copy a huge pattern into the error message", () => {
            // quoting the pattern whole would put megabytes into the message and
            // into every log line that records it
            try {
                like("a", "a".repeat(100_000));
                throw new Error("should have thrown");
            } catch (err) {
                should(err).be.instanceOf(InvalidLikePatternError);
                (err as Error).message.length.should.be.below(300);
            }
        });

        it("should allow the limit to be raised deliberately", () => {
            const long = "a".repeat(DEFAULT_MAX_PATTERN_LENGTH + 1);
            isValidLikePattern(long, { maxPatternLength: 8192 }).should.eql(true);
            like(long, long, { maxPatternLength: 8192 }).should.eql(true);
        });

        it("should refuse before allocating, so the cost of a rejection is flat", () => {
            // a rejected pattern must not be parsed at all
            const started = Date.now();
            for (let i = 0; i < 50; i++) {
                should(() => like("a", "%".repeat(1_000_000))).throw(InvalidLikePatternError);
            }
            (Date.now() - started).should.be.below(1000);
        });
    });

    describe("case sensitivity", () => {
        it("should be case sensitive by default, as OPC 10000-4 requires", () => {
            like("TI101", "ti101").should.eql(false);
            like("TI101", "TI101").should.eql(true);
            like("TI101", "ti%").should.eql(false);
        });

        it("should compare without case when explicitly opted in", () => {
            like("TI101", "ti101", { caseInsensitive: true }).should.eql(true);
            like("TI101", "ti%", { caseInsensitive: true }).should.eql(true);
            like("ti101", "TI%", { caseInsensitive: true }).should.eql(true);
        });

        it("should fold case inside lists and ranges too", () => {
            like("ABC1", "abc[0-9]", { caseInsensitive: true }).should.eql(true);
            like("XYZD", "xyz[c-f]", { caseInsensitive: true }).should.eql(true);
            like("XYZD", "xyz[^c-f]", { caseInsensitive: true }).should.eql(false);
            like("xyzd", "XYZ[C-F]", { caseInsensitive: true }).should.eql(true);
        });

        it("should not let the option change which patterns are valid", () => {
            // folding at parse time made '[a-Z]' reversed when sensitive and
            // valid when insensitive, so isValidLikePattern could disagree with
            // the LikePattern the caller went on to build
            for (const pattern of ["[a-Z]", "[Z-a]", "[A-z]", "[z-A]"]) {
                const sensitive = isValidLikePattern(pattern);
                let insensitive = true;
                try {
                    new LikePattern(pattern, { caseInsensitive: true });
                } catch {
                    insensitive = false;
                }
                insensitive.should.eql(sensitive, `validity disagreement on ${pattern}`);
            }
        });

        it("should not corrupt a range by folding its endpoints", () => {
            // lower-casing '[Z-a]' would give '[z-a]', which matches nothing
            like("Z", "[Z-a]").should.eql(true);
            like("_", "[Z-a]").should.eql(true, "underscore is between Z and a in ASCII");
            like("Z", "[Z-a]", { caseInsensitive: true }).should.eql(true);
            like("_", "[Z-a]", { caseInsensitive: true }).should.eql(true);
        });
    });

    describe("cost guards", () => {
        // A RegExp translation of this pattern takes ~15 seconds: each '%'
        // becomes '.*' and a backtracking engine explores every way to split the
        // subject across them. These fail loudly if anyone "simplifies" the
        // matcher into a RegExp.
        it("should stay fast when the pattern is mostly '%'", () => {
            const subject = "a".repeat(200);
            const started = Date.now();
            like(subject, `${"%".repeat(40)}x`).should.eql(false);
            (Date.now() - started).should.be.below(500);
        });

        it("should stay fast when '%' and '_' alternate", () => {
            const subject = "a".repeat(200);
            const started = Date.now();
            like(subject, `${"%_".repeat(20)}x`).should.eql(false);
            (Date.now() - started).should.be.below(500);
        });
    });

    describe("edge cases", () => {
        it("should match an empty subject only against an empty or %-only pattern", () => {
            like("", "").should.eql(true);
            like("", "%").should.eql(true);
            like("", "_").should.eql(false);
            like("", "a").should.eql(false);
        });

        it("should let a compiled pattern be reused across subjects", () => {
            const pattern = new LikePattern("TI%");
            pattern.test("TI101").should.eql(true);
            pattern.test("TI202").should.eql(true);
            pattern.test("FIT-101").should.eql(false);
        });

        it("should not blow up on a pattern that defeats a naive backtracker", () => {
            // '%_%_%_...' against a long run of the same character reaches the
            // same (element, offset) pair by exponentially many routes. Without
            // memoisation this does not terminate in any useful time.
            const started = Date.now();
            like("a".repeat(60), `${"%_".repeat(20)}b`).should.eql(false);
            like("a".repeat(200), `${"%_".repeat(30)}%`).should.eql(true);
            (Date.now() - started).should.be.below(2000);
        });

        it("should handle a non-ASCII subject", () => {
            like("Température", "Temp%").should.eql(true);
            like("Température", "T_mp%").should.eql(true);
        });
    });
});
