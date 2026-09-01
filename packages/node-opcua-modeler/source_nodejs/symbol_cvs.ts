import fs from "node:fs";
import { types } from "node:util";
import { type Parser, parse } from "csv-parse";

import type { Symbols } from "../dist/index.js";
import { toCSV } from "../dist/index.js";

// node 14 onward : import { readFile, writeFile } from "fs/promises";
const { readFile, writeFile } = fs.promises;

export async function saveSymbolsToCSV(csvFilename: string, symbols: Symbols): Promise<void> {
    await writeFile(csvFilename, toCSV(symbols), "utf-8");
}

export async function getPresetSymbolsFromCSV(csvFilename: string): Promise<Symbols> {
    if (!fs.existsSync(csvFilename)) {
        return [];
    }
    try {
        const data = await readFile(csvFilename, "utf-8");

        const records = await new Promise<Symbols>((resolve) => {
            const output: Symbols = [];
            parse(data, {
                cast: (value, context) => {
                    if (context.index === 1) {
                        return parseInt(value, 10);
                    }
                    return value;
                }
            })
                .on("readable", function (this: Parser) {
                    let record = this.read();
                    while (record) {
                        output.push(record);
                        record = this.read();
                    }
                })
                .on("end", () => {
                    resolve(output);
                });
        });
        return records;
    } catch (err) {
        if (types.isNativeError(err)) {
            // tslint:disable-next-line: no-console
            console.log("getPresetSymbols err = ", err.message);
        }
        return [];
    }
}
