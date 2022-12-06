/**
 * @module node-opcua-utils
 */
export function buffer_ellipsis(buffer: Buffer, start?: number, end?: number): string {
    start = start || 0;
    end = end || buffer.length;
    if (end - start < 40) {
        return buffer.subarray(start, end).toString("hex");
    }
    return buffer.subarray(start, start + 10).toString("hex") + " ... " + buffer.subarray(end - 10, end).toString("hex");
}

exports.buffer_ellipsis = buffer_ellipsis;
