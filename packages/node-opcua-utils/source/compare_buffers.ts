/**
 * @module node-opcua-utils
 */
// tslint:disable:no-console

function formatLine(buffer: Buffer): string {
    const hex: string[] = [];
    const ascii: string[] = [];
    for (let i = 0; i < buffer.length; i++) {
        const value = buffer[i];
        hex.push(value.toString(16).padStart(2, "0"));
        ascii.push(value >= 0x20 && value < 0x7f ? String.fromCharCode(value) : ".");
    }
    return `${hex.join(" ")}  |${ascii.join("")}|`;
}

export function compare_buffers(buf1: Buffer, buf2: Buffer, max_length?: number): void {
    const length1 = buf1.length;
    const length2 = buf2.length;
    const limit = max_length !== undefined ? Math.min(max_length, length1, length2) : Math.min(length1, length2);
    const block_length = 16;

    let cursor = 0;
    let differences = 0;

    while (cursor < limit) {
        const end = Math.min(cursor + block_length, limit);
        const slice1 = buf1.subarray(cursor, end);
        const slice2 = buf2.subarray(cursor, end);
        const marker: string[] = [];
        let rowHasDiff = false;

        for (let i = 0; i < slice1.length; i++) {
            if (slice1[i] !== slice2[i]) {
                marker.push("^^");
                rowHasDiff = true;
                differences += 1;
            } else {
                marker.push("  ");
            }
        }

        if (rowHasDiff) {
            console.log(`pos = ${cursor}`);
            console.log(`  buf1: ${formatLine(slice1)}`);
            console.log(`  buf2: ${formatLine(slice2)}`);
            console.log(`  diff: ${marker.join(" ")}`);
        }
        cursor = end;
    }

    if (differences === 0) {
        if (length1 === length2) {
            console.log(`buffers are identical (${length1} bytes)`);
        } else {
            console.log(`buffers match for first ${limit} bytes, but lengths differ: buf1=${length1}, buf2=${length2}`);
        }
    } else if (length1 !== length2) {
        console.log(`length mismatch: buf1=${length1}, buf2=${length2}`);
    }
}
