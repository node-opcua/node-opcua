// tslint:disable-next-line: no-var-requires
const Table = require("cli-table3");

const chars1 = {
    // tslint:disable-next-line: object-literal-sort-keys
    "top": "-", "top-mid": "+", "top-left": "+", "top-right": "+"
    , "bottom": "-", "bottom-mid": "+", "bottom-left": "+", "bottom-right": "+"
    , "left": "|", "left-mid": "+", "mid": "-", "mid-mid": "+"
    , "right": "|", "right-mid": "+", "middle": "|"
};
const chars2 = {
    // tslint:disable-next-line: object-literal-sort-keys
    "top": " ", "top-mid": "   ", "top-left": "  ", "top-right": "  "
    , "bottom": " ", "bottom-mid": "   ", "bottom-left": "  ", "bottom-right": " "
    , "left": "| ", "left-mid": "| ", "mid": "-", "mid-mid": " | "
    , "right": " |", "right-mid": "| ", "middle": " | "
};
const chars3 = {
    // tslint:disable-next-line: object-literal-sort-keys
    "top": "", "top-mid": "", "top-left": "", "top-right": ""
    , "bottom": "", "bottom-mid": "", "bottom-left": "", "bottom-right": ""
    , "left": "| ", "left-mid": "", "mid": "-", "mid-mid": " | "
    , "right": " |", "right-mid": "", "middle": " | "
};

function toMarkdownTable(table: { head: string[], rows: string[][] }): string {

    const t = [];

    t.push("| " + table.head.join(" | ") + " |");
    t.push("| " + table.head.map(() => "---").join(" | ") + " |");
    for (const r of table.rows) {
        t.push("| " + r.join(" | ") + " |");
    }
    return t.join("\n");
}

export class TableHelper {

    private readonly rows: string[][] = [];
    private readonly table: typeof Table;
    private readonly head: string[];
    constructor(head: string[]) {
        this.rows = [];
        // instantiate
        this.table = new Table({
            // chars,
            head,
            // colWidths: [100, 200, 50, 50,]
        });
        this.head = head;
    }
    public push(row: unknown[]): void {
        this.table.push(row);
        const row2 = row.map((c: any) => (c.content) ? c.content : c);
        this.rows.push(row2);
    }
    public toString(): string {
        return this.table.toString();
    }
    public toMarkdownTable(): string {
        return toMarkdownTable({ head: this.head, rows: this.rows });
    }
}
