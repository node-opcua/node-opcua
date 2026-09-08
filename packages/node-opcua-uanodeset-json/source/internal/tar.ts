/**
 * As much of tar as an Annex I archive needs, and no more.
 *
 * I.3 says a `.uanodeset` is "a TAR.GZ archive" and stops there, so an implementation has to
 * decide what that means. This reads the two flavours that actually occur -- the original V7
 * layout, which is what the reference implementation writes, and POSIX ustar -- and writes ustar,
 * which every reader understands and which V7 readers ignore the extra fields of.
 *
 * It is hand-written rather than taken from a library on purpose: the monorepo has no tar
 * dependency, an archive of a handful of JSON files needs none of what a general tar library
 * carries, and a nodeset reader is not the place to introduce a new supply chain.
 *
 * What it does not do, because an Annex I archive has no use for any of it: directories, symbolic
 * links, sparse files, GNU long names, pax extended headers, ownership, or permissions beyond a
 * fixed mode. A member whose type is not a regular file is skipped rather than guessed at.
 */

const BLOCK = 512;

/** where each field of a header block begins, per the tar format */
const NAME = 0;
const SIZE = 124;
const CHECKSUM = 148;
const TYPEFLAG = 156;
const MAGIC = 257;
const PREFIX = 345;

/** one member of an archive */
export interface TarEntry {
    name: string;
    data: Uint8Array;
}

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

/** a NUL-terminated string field */
function readString(bytes: Uint8Array, offset: number, length: number): string {
    const end = bytes.indexOf(0, offset);
    const stop = end === -1 || end > offset + length ? offset + length : end;
    return decoder.decode(bytes.subarray(offset, stop));
}

/** an octal number field, which tar pads with NULs or spaces at either end */
function readOctal(bytes: Uint8Array, offset: number, length: number): number {
    const text = readString(bytes, offset, length).trim();
    if (text === "") {
        return 0;
    }
    const value = Number.parseInt(text, 8);
    return Number.isFinite(value) ? value : 0;
}

/**
 * the checksum of a header block: every byte summed, with the checksum field itself read as
 * eight spaces. It is the only structural check tar offers, and it is what tells a header block
 * from arbitrary data.
 */
function headerChecksum(block: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) {
        sum += i >= CHECKSUM && i < CHECKSUM + 8 ? 0x20 : block[i];
    }
    return sum;
}

/**
 * whether these bytes begin a tar archive.
 *
 * The magic is not enough: V7 leaves it empty, so an archive written by the reference
 * implementation has nothing there to recognise. The checksum is the reliable test, and it is
 * what the format provides for exactly this purpose.
 */
export function isTar(bytes: Uint8Array): boolean {
    if (bytes.length < BLOCK) {
        return false;
    }
    const block = bytes.subarray(0, BLOCK);
    const stored = readOctal(block, CHECKSUM, 8);
    if (stored === 0) {
        return false;
    }
    return stored === headerChecksum(block);
}

/**
 * the regular files of an archive, in the order they are stored.
 *
 * The order is not authoritative for an Annex I archive: I.3 says the manifest's `Files` list
 * specifies the processing order, and the archive order is free to differ.
 */
export function readTar(bytes: Uint8Array): TarEntry[] {
    const entries: TarEntry[] = [];
    let offset = 0;
    while (offset + BLOCK <= bytes.length) {
        const block = bytes.subarray(offset, offset + BLOCK);
        const name = readString(block, NAME, 100);
        if (name === "") {
            // two zero blocks end an archive; a single one is tolerated as the same thing
            break;
        }
        const stored = readOctal(block, CHECKSUM, 8);
        if (stored !== headerChecksum(block)) {
            throw new Error(`tar: the header at offset ${offset} does not checksum`);
        }
        const size = readOctal(block, SIZE, 12);
        const start = offset + BLOCK;
        if (start + size > bytes.length) {
            throw new Error(`tar: the member ${name} runs past the end of the archive`);
        }
        const type = block[TYPEFLAG];
        // '0' and NUL are a regular file; ustar puts a directory at '5' and links beyond that
        if (type === 0x30 || type === 0) {
            const prefix = readString(block, PREFIX, 155);
            entries.push({ name: prefix ? `${prefix}/${name}` : name, data: bytes.subarray(start, start + size) });
        }
        offset = start + Math.ceil(size / BLOCK) * BLOCK;
    }
    return entries;
}

function writeString(block: Uint8Array, offset: number, length: number, value: string): void {
    const bytes = encoder.encode(value);
    if (bytes.length > length) {
        throw new Error(`tar: "${value}" does not fit in ${length} bytes`);
    }
    block.set(bytes, offset);
}

/** an octal field, right-aligned and NUL-terminated, as tar writes them */
function writeOctal(block: Uint8Array, offset: number, length: number, value: number): void {
    const text = value.toString(8).padStart(length - 1, "0");
    writeString(block, offset, length, text);
}

/**
 * an archive of these members, ustar, with fixed metadata.
 *
 * The mode, ownership and timestamp are constants rather than anything real: an archive of a
 * nodeset should be reproducible, and two runs over the same nodes that differed only in an
 * embedded clock would defeat every byte-level comparison anyone might want to make of them.
 */
export function writeTar(entries: TarEntry[]): Uint8Array {
    const blocks: Uint8Array[] = [];
    for (const entry of entries) {
        const header = new Uint8Array(BLOCK);
        writeString(header, NAME, 100, entry.name);
        writeOctal(header, 100, 8, 0o644); // mode
        writeOctal(header, 108, 8, 0); // uid
        writeOctal(header, 116, 8, 0); // gid
        writeOctal(header, SIZE, 12, entry.data.length);
        writeOctal(header, 136, 12, 0); // mtime
        header[TYPEFLAG] = 0x30; // regular file
        writeString(header, MAGIC, 6, "ustar");
        header.set(encoder.encode("00"), 263); // version, which ustar leaves unterminated
        // the checksum is computed with its own field blank, so it is written last
        header.fill(0x20, CHECKSUM, CHECKSUM + 8);
        const sum = headerChecksum(header);
        writeString(header, CHECKSUM, 8, `${sum.toString(8).padStart(6, "0")}\0 `);

        blocks.push(header);
        const padded = new Uint8Array(Math.ceil(entry.data.length / BLOCK) * BLOCK);
        padded.set(entry.data);
        blocks.push(padded);
    }
    // an archive ends with two zero blocks
    blocks.push(new Uint8Array(BLOCK * 2));

    const total = blocks.reduce((sum, block) => sum + block.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const block of blocks) {
        out.set(block, offset);
        offset += block.length;
    }
    return out;
}
