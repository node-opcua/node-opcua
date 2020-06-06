/**
 * @module node-opcua-utils
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import { buffer_ellipsis } from "./buffer_ellipsis";

export function compare_buffers(buf1: Buffer, buf2: Buffer, max_length?: number): void {
    max_length = max_length || buf2.length;
    const block_length = 80;
    let cursor = 0;
    while (cursor < max_length) {
        const slice1 = buf1.slice(cursor, cursor + block_length);
        const slice2 = buf2.slice(cursor, cursor + block_length);
        if (slice2.toString("hex") !== slice1.toString("hex")) {
            console.log("pos = ", cursor);
            console.log("slice1 :", chalk.yellow(buffer_ellipsis(slice1)));
            console.log("slice2 :", chalk.blue(buffer_ellipsis(slice2)));
        }
        cursor += block_length;
    }
    // xx buf1.length.should.equal(max_length);
}
