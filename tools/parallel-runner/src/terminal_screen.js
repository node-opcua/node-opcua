"use strict";
/**
 * terminal_screen.js
 *
 * Two-window terminal layout for parallel_test.js:
 *
 *   rows 1 .. (R - H)    scroll window  (normal output, scrolls, goes to scrollback)
 *   rows (R - H + 1) .. R footer window (H fixed lines, repainted in place)
 *
 * Uses the VT100 scroll region (DECSTBM, ESC[top;bottom r). Once the region is
 * set, ANY write at the cursor (console.log, piped worker stdout, mocha noise)
 * lands inside the scroll window and can no longer clobber the footer. Only the
 * footer painter ever leaves the region, and it always does so inside a
 * save-cursor / restore-cursor pair.
 *
 * Invariant: outside of paintFooter(), the cursor is always inside the scroll
 * window. Nothing else in the program needs to know the footer exists.
 *
 * When stdout is not a TTY (CI, pipe, TERM=dumb) the class degrades to plain
 * line output and emits the footer as an ordinary line at a throttled rate.
 */

const CSI = "\x1b[";
const SAVE = "\x1b7"; // DECSC: save cursor position + attributes
const RESTORE = "\x1b8"; // DECRC
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const RESET_REGION = `${CSI}r`;
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b[78]/g;

/** visible width, ignoring ANSI escapes (good enough for the glyphs we print) */
function visibleWidth(s) {
    return [...s.replace(ANSI_RE, "")].length;
}

/** cut a styled string to `max` visible columns, keeping escapes intact */
function truncate(s, max) {
    if (visibleWidth(s) <= max) {
        return s;
    }
    let out = "";
    let width = 0;
    let i = 0;
    while (i < s.length && width < max) {
        ANSI_RE.lastIndex = i;
        const m = ANSI_RE.exec(s);
        if (m && m.index === i) {
            out += m[0];
            i += m[0].length;
            continue;
        }
        const ch = String.fromCodePoint(s.codePointAt(i));
        out += ch;
        i += ch.length;
        width++;
    }
    return `${out}${CSI}0m`;
}

class TerminalScreen {
    /**
     * @param {object}  [opts]
     * @param {NodeJS.WriteStream} [opts.stream]  defaults to process.stdout
     * @param {number}  [opts.footerHeight]       number of fixed lines (default 1)
     * @param {boolean} [opts.tty]                force TTY / non TTY behaviour
     * @param {number}  [opts.plainFooterEveryMs] non TTY: min interval between footer lines
     */
    constructor(opts = {}) {
        this.stream = opts.stream || process.stdout;
        this.footerHeight = Math.max(1, opts.footerHeight || 1);
        this.tty = opts.tty !== undefined ? opts.tty : this.stream.isTTY === true && process.env.TERM !== "dumb";
        this.plainFooterEveryMs = opts.plainFooterEveryMs ?? 30_000;

        this.active = false;
        this.footer = [];
        this._lastPlainFooter = 0;
        this._rows = 0;
        this._cols = 0;

        this._onResize = () => this._applyLayout(true);
        this._onExit = () => this.stop();
    }

    get rows() {
        return this.stream.rows || 24;
    }

    get columns() {
        return this.stream.columns || 80;
    }

    /** reserve the footer area and install the scroll region */
    start() {
        if (this.active) {
            return;
        }
        this.active = true;
        process.once("exit", this._onExit);
        if (!this.tty) {
            return;
        }
        if (this.rows < this.footerHeight + 3) {
            // terminal too small for a split, behave like a plain stream
            this.tty = false;
            return;
        }
        // Make room: push H blank lines, then come back up. This guarantees the
        // cursor sits at or above row R - H, so the region never starts with the
        // cursor stranded in the footer area, and existing text is not covered.
        const h = this.footerHeight;
        this._write(`${"\n".repeat(h)}${CSI}${h}A`);
        this._write(HIDE_CURSOR);
        this._applyLayout(false);
        this.stream.on("resize", this._onResize);
    }

    /**
     * (re)install the scroll region for the current terminal size.
     * DECSTBM homes the cursor on most terminals, hence SAVE / RESTORE.
     */
    _applyLayout(isResize) {
        const rows = this.rows;
        const h = this.footerHeight;
        if (isResize) {
            // Terminal reflowed. Wipe the old footer zone wherever it ended up,
            // install the new region and park the cursor on a fresh bottom line.
            this._write(
                `${RESET_REGION}${CSI}${Math.max(1, rows - h)};1H${CSI}J` +
                    `${CSI}1;${rows - h}r${CSI}${rows - h};1H\n`
            );
        } else {
            this._write(`${SAVE}${CSI}1;${rows - h}r${RESTORE}`);
        }
        this._rows = rows;
        this._cols = this.columns;
        this.paintFooter();
    }

    /** write text in the scroll window (a trailing newline is added) */
    log(...parts) {
        this._write(`${parts.join(" ")}\n`);
    }

    /** replace footer content; array of lines or a single string */
    setFooter(lines) {
        this.footer = Array.isArray(lines) ? lines : [lines];
        if (this.active && !this.tty) {
            const now = Date.now();
            if (now - this._lastPlainFooter >= this.plainFooterEveryMs) {
                this._lastPlainFooter = now;
                this._write(`${this.footer.join("\n")}\n`);
            }
            return;
        }
        this.paintFooter();
    }

    paintFooter() {
        if (!this.active || !this.tty) {
            return;
        }
        const rows = this.rows;
        const h = this.footerHeight;
        // leave the last column free: writing into it arms the pending wrap flag
        const max = Math.max(1, this.columns - 1);
        let buf = SAVE;
        for (let i = 0; i < h; i++) {
            const line = this.footer[i] || "";
            buf += `${CSI}${rows - h + 1 + i};1H${CSI}2K${truncate(line, max)}`;
        }
        buf += RESTORE;
        this._write(buf);
    }

    /**
     * tear down: clear the footer, drop the region, print `finalLines` where the
     * scroll window ended. Safe to call several times and from an exit handler.
     */
    stop(finalLines) {
        if (!this.active) {
            return;
        }
        this.active = false;
        process.removeListener("exit", this._onExit);
        this.stream.removeListener("resize", this._onResize);
        if (this.tty) {
            const rows = this.rows;
            const h = this.footerHeight;
            let buf = SAVE;
            for (let i = 0; i < h; i++) {
                buf += `${CSI}${rows - h + 1 + i};1H${CSI}2K`;
            }
            buf += `${RESTORE}${SAVE}${RESET_REGION}${RESTORE}${SHOW_CURSOR}`;
            this._write(buf);
        }
        if (finalLines) {
            const lines = Array.isArray(finalLines) ? finalLines : [finalLines];
            this._write(`${lines.join("\n")}\n`);
        }
    }

    _write(s) {
        // fd writes to a TTY are synchronous in Node on Linux, so each call
        // reaches the terminal as one block and sequences never interleave
        this.stream.write(s);
    }
}

module.exports = { TerminalScreen, visibleWidth, truncate };

// ---------------------------------------------------------------------------
// demo: node terminal_screen.js   (try resizing the terminal while it runs)
// ---------------------------------------------------------------------------
if (require.main === module) {
    const screen = new TerminalScreen({ footerHeight: 2 });
    screen.start();
    const t0 = Date.now();
    let n = 0;
    const total = 120;
    const timer = setInterval(() => {
        n++;
        // plain console.log on purpose: it lands in the scroll window untouched
        console.log(`test ${String(n).padStart(3)}  \x1b[32m[PASS]\x1b[0m  some/package/test_${n}.ts`);
        const pct = Math.round((n / total) * 100);
        const done = Math.round((n / total) * 30);
        screen.setFooter([
            `\x1b[32m${"█".repeat(done)}\x1b[90m${"░".repeat(30 - done)}\x1b[0m ${n}/${total} files  ${pct}%  ${((Date.now() - t0) / 1000).toFixed(1)}s`,
            `\x1b[90mworkers: w1 test_${n}.ts  w2 test_${n + 1}.ts  w3 test_${n + 2}.ts\x1b[0m`
        ]);
        if (n >= total) {
            clearInterval(timer);
            screen.stop("\x1b[42;37m ✓ ALL TESTS PASSED \x1b[0m");
        }
    }, 40);
}
