import type { Cell, Table as CliTable } from "cli-table3";
import Table from "cli-table3";

function toMarkdownTable(table: { head: string[]; rows: string[][] }): string {
    const t = [];

    t.push(`| ${table.head.join(" | ")} |`);
    t.push(`| ${table.head.map(() => "---").join(" | ")} |`);
    for (const r of table.rows) {
        t.push(`| ${r.join(" | ")} |`);
    }
    return t.join("\n");
}

interface CellWithContent {
    content: string;
}

function extractContent(c: unknown): string {
    if (typeof c === "object" && c !== null && "content" in c) {
        return (c as CellWithContent).content;
    }
    return String(c);
}

export class TableHelper {
    private readonly rows: string[][] = [];
    // the instance type, not `typeof Table` which is the constructor. The old
    // `require()` produced `any`, so the mistake type-checked.
    private readonly table: CliTable;
    private readonly head: string[];
    constructor(head: string[]) {
        this.rows = [];
        // instantiate
        this.table = new Table({
            head
        });
        this.head = head;
    }
    public push(row: unknown[]): void {
        // the public signature stays `unknown[]` so callers are unaffected; cli-table3
        // types a row as Cell[], which is what this always was in practice.
        this.table.push(row as Cell[]);
        const row2 = row.map(extractContent);
        this.rows.push(row2);
    }
    public toString(): string {
        return this.table.toString();
    }
    public toMarkdownTable(): string {
        return toMarkdownTable({ head: this.head, rows: this.rows });
    }
}
