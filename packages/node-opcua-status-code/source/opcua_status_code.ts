/**
 * @module node-opcua-status-code
 */

import { assert } from "node-opcua-assert";
import type { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";

function warnLog(...args: unknown[]) {
    /* c8 ignore next */
    console.warn(...args);
}

/**
 * StatusCode Special bits
 */
export const extraStatusCodeBits: { [key: string]: number } = {
    /**
     *  **StructureChanged** 15:15
     *   Indicates that the structure of the associated data value has changed since the last
     *   Notification.
     *  - Clients should not process the data value unless they re-read the metadata.
     *  - Servers shall set this bit if the DataTypeEncoding used for a Variable changes.
     *  - Servers shall also set this bit if the EnumStrings Property of the DataType of the Variable changes.
     *  - This bit is provided to warn Clients that parse complex data values that their parsing
     *    routines could fail because the serialized form of the data value has changed.
     *  - This bit has meaning only for StatusCodes returned as part of a data change Notification
     *    or the HistoryRead. StatusCodes used in other contexts shall always set this bit to zero.
     */
    StructureChanged: 0x1 << 15,

    /**
     * **SemanticsChanged** 14:14  Semantics of the associated data value have changed. Clients should not process the data
     *   value until they re-read the metadata associated with the Variable.
     * - Servers should set this bit if the metadata has changed in way that could cause application errors if the
     * - Client does not re-read the metadata. For example, a change to the engineering units
     *   could create problems if the Client uses the value to perform calculations.
     * - Part 8 defines the conditions where a Server shall set this bit for a DA Variable.
     * - Other specifications may define additional conditions.
     * - A Server may define other conditions that cause this bit to be set. This bit has meaning only for StatusCodes returned as part of a data change Notification
     *   or the HistoryRead. StatusCodes used in other contexts shall always set this bit to zero.
     */
    SemanticChanged: 0x1 << 14,

    // Reserved         12:13  Reserved for future use. Shall always be zero.

    /**
     * **InfoType**         10:11
     * The type of information contained in the info bits. These bits have the following meanings:
     *
     * | Meaning                           |value | description|
     * |-----------------------------------|------|----------------------------------------------------|
     * |                         NotUsed   | 00   | The info bits are not used and shall be set to zero. |
     * |                         DataValue | 01   | The StatusCode and its info bits are associated with a data value returned from the Server. This flag is only used in combination with StatusCodes defined in Part 8. |
     * |                         Reserved  |1X    | Reserved for future use. The info bits shall be ignored.|
     */
    InfoTypeDataValue: 0x1 << 10, // 0x0400,

    // InfoBits         0:9    Additional information bits that qualify the StatusCode.
    //                         The structure of these bits depends on the Info Type field.
    //
    // LimitBits        8:9    The limit bits associated with the data value. The limits bits have the
    //                         following meanings:
    //                         Limit     Bits   Description
    //                         None      00     The value is free to change.
    //                         Low       01     The value is at the lower limit for the data source.
    //                         High      10     The value is at the higher limit for the data source.
    //                         Constant  11     The value is constant and cannot change.
    LimitLow: 0x1 << 8,

    LimitHigh: 0x2 << 8,

    LimitConstant: 0x3 << 8,

    /**
     * **Overflow**         7:7
     * - This bit shall only be set if the MonitoredItem queue size is greater than 1.
     * - If this bit is set, not every detected change has been returned since the Server’s
     *  queue buffer for the MonitoredItem reached its limit and had to purge out data.
     *
     */
    Overflow: 0x1 << 7, // 1 << 7

    // Reserved         5:6    Reserved for future use. Shall always be zero.

    // HistorianBits    0:4    These bits are set only when reading historical data. They indicate where the data value
    //                         came from and provide information that affects how the Client uses the data value.
    //                         The historian bits have the following meaning:
    //                         Raw            XXX00      A raw data value.
    //                         Calculated     XXX01      A data value which was calculated.
    //                         Interpolated   XXX10      A data value which was interpolated.
    //                         Reserved       XXX11      Undefined.
    //                         Partial        XX1XX      A data value which was calculated with an incomplete interval.
    //                         Extra Data     X1XXX      A raw data value that hides other data at the same timestamp.
    //                         Multi Value    1XXXX      Multiple values match the Aggregate criteria (i.e. multiple
    //                                                   minimum values at different timestamps within the same interval).
    //                         Part 11 describes how these bits are used in more detail.

    /** historical data contains a data value which was calculated. */
    HistorianCalculated: 0x1 << 0,

    /** historical data contains a data value which was interpolated. */
    HistorianInterpolated: 0x2 << 0,

    /** historical data contains a data value which was calculated with an incomplete interval. */
    HistorianPartial: 0x1 << 2,

    /** historical data contains a raw data value that hides other data at the same timestamp. */
    HistorianExtraData: 0x1 << 3,

    /** Multiple values match the Aggregate criteria (i.e. multiple minimum values at different timestamps within the same interval). */
    HistorianMultiValue: 0x1 << 4
};

/**
 * a particular StatusCode , with it's value , name and description
 */

export abstract class StatusCode {
    /**
     *  returns a status code that can be modified
     */
    // `optionalBits` is optional in fact, and always was: the body below skips `set` when
    // it is absent, and callers have been omitting it. It returns a ModifiableStatusCode,
    // never a plain StatusCode, which is what makes `.set`/`.unset` valid on the result.
    // Both were only mis-declared; the test suite was reaching them through require()'s
    // `any` and so never checked.
    public static makeStatusCode(statusCode: StatusCode | string, optionalBits?: string | number): ModifiableStatusCode {
        // The instanceof case is handled here rather than deferred to the injected
        // coerce, because the generated table calls this during its own evaluation
        // (`static GoodWithOverflowBit = StatusCode.makeStatusCode(StatusCodes.Good, ...)`),
        // which is before the registry has installed anything. That call passes a
        // StatusCode, so it needs no table; only the string and number forms do.
        let _base: StatusCode;
        if (statusCode instanceof StatusCode) {
            _base = statusCode;
        } else {
            if (!coerce) {
                throw new Error("node-opcua-status-code: the status code table has not been installed yet");
            }
            _base = coerce(statusCode);
        }
        const tmp = new ModifiableStatusCode({ _base });
        if (optionalBits || typeof optionalBits === "number") {
            tmp.set(optionalBits);
        }
        return tmp;
    }

    /**
     * returns status code value in numerical form, including extra bits
     */
    public abstract get value(): number;

    /***
     * status code by name, (including  extra bits in textual forms)
     */
    public abstract get name(): string;

    /**
     * return the long description of the status code
     */
    public abstract get description(): string;

    public valueOf(): number {
        return this.value;
    }

    public toString(): string {
        return `${this.name} (0x${this.value.toString(16).padStart(8, "0")})`;
    }

    public checkBit(mask: number): boolean {
        return (this.value & mask) === mask;
    }

    /** returns true if the overflow bit is set */
    public get hasOverflowBit(): boolean {
        return this.checkBit(extraStatusCodeBits.Overflow);
    }

    /** returns true if the semanticChange bit is set */
    public get hasSemanticChangedBit(): boolean {
        return this.checkBit(extraStatusCodeBits.SemanticChanged);
    }

    /** returns true if the structureChange bit is set */
    public get hasStructureChangedBit(): boolean {
        return this.checkBit(extraStatusCodeBits.StructureChanged);
    }

    public isNot(other: StatusCode): boolean {
        assert(other instanceof StatusCode);
        return this.value !== other.value;
    }

    public equals(other: StatusCode): boolean {
        assert(other instanceof StatusCode);
        return this.value === other.value;
    }

    public toJSON(): { value: number } {
        return { value: this.value };
    }

    public toJSONFull(): { value: number; name: string; description: string } {
        return { value: this.value, name: this.name, description: this.description };
    }

    public isGood(): boolean {
        return this.value === 0;
    }

    public isNotGood(): boolean {
        return this.value !== 0;
    }

    public isGoodish(): boolean {
        return this.value < 0x10000000;
    }

    public isBad(): boolean {
        return this.value >= 0x80000000;
    }
}

Object.defineProperty(StatusCode.prototype, "value", { enumerable: true });
Object.defineProperty(StatusCode.prototype, "description", { enumerable: true });
Object.defineProperty(StatusCode.prototype, "name", { enumerable: true });

export class ConstantStatusCode extends StatusCode {
    private readonly _value: number;
    private readonly _description: string;
    private readonly _name: string;

    /**
     *
     * @param options
     * @param options
     * @param options.value
     * @param options.description
     * @param options.name
     *
     */
    constructor(options: { value: number; description: string; name: string }) {
        super();
        this._value = options.value;
        this._description = options.description;
        this._name = options.name;
    }

    public get value(): number {
        return this._value;
    }

    public get name(): string {
        return this._name;
    }

    public get description(): string {
        return this._description;
    }
}

Object.defineProperty(ConstantStatusCode.prototype, "_value", { enumerable: false, writable: true });
Object.defineProperty(ConstantStatusCode.prototype, "_description", { enumerable: false, writable: true });
Object.defineProperty(ConstantStatusCode.prototype, "_name", { enumerable: false, writable: true });
Object.defineProperty(ConstantStatusCode.prototype, "value", { enumerable: true });
Object.defineProperty(ConstantStatusCode.prototype, "description", { enumerable: true });
Object.defineProperty(ConstantStatusCode.prototype, "name", { enumerable: true });

export function encodeStatusCode(statusCode: StatusCode | ConstantStatusCode, stream: OutputBinaryStream): void {
    stream.writeUInt32(statusCode.value);
}

/** @internal construct status codes fast search indexes */
const statusCodesReversedMap: Record<string, StatusCode> = {};

/**
 * The status code returned for a code that is not in the table. It is StatusCodes.Bad,
 * but this module must not import the generated table to get it.
 *
 * _generated_status_codes.ts builds its ConstantStatusCode instances while its own module
 * body runs, using the classes declared here. Under ESM an import is hoisted and the
 * imported module is evaluated first, so importing the generated table from this file
 * would evaluate it before these class declarations were initialised, and every one of
 * those 280 constructions would throw a TDZ ReferenceError. It only works under CommonJS
 * because `require()` runs where it is written, which used to be at the foot of this file.
 *
 * So the dependency is inverted: status_codes_registry.ts imports both and injects.
 */
let unknownStatusCodeFallback: StatusCode | undefined;

/** injected for the same reason as the fallback: coerceStatusCode needs the table */
let coerce: ((statusCode: StatusCode | number | string | { value: number }) => StatusCode) | undefined;

/**
 * @internal Called once by status_codes_registry, which is the only module that may
 * import the generated table. Populates the reverse lookup and supplies the two things
 * this module needs from that table.
 */
export function _installStatusCodes(
    codes: Record<string, StatusCode>,
    fallback: StatusCode,
    coerceStatusCode: (statusCode: StatusCode | number | string | { value: number }) => StatusCode
): void {
    for (const name of Object.keys(codes)) {
        const code = codes[name];
        statusCodesReversedMap[code.value.toString()] = code;
    }
    unknownStatusCodeFallback = fallback;
    coerce = coerceStatusCode;
}

/**
 * returns the StatusCode corresponding to the provided value, if any
 * @note: if code is not known , then StatusCodes.Bad will be returned
 * @param code
 */
export function getStatusCodeFromCode(code: number): StatusCode {
    const codeWithoutInfoBits = (code & 0xffff0000) >>> 0;
    const infoBits = code & 0x0000ffff;
    let sc = statusCodesReversedMap[codeWithoutInfoBits];

    /* c8 ignore next */
    if (!sc) {
        if (!unknownStatusCodeFallback) {
            throw new Error("node-opcua-status-code: the status code table has not been installed yet");
        }
        sc = unknownStatusCodeFallback;
        warnLog(`expecting a known StatusCode but got 0x${codeWithoutInfoBits.toString(16)}`, ` code was 0x${code.toString(16)}`);
    }
    if (infoBits) {
        const tmp = new ModifiableStatusCode({ _base: sc });
        tmp.set(infoBits);
        sc = tmp;
    }
    return sc;
}

export function decodeStatusCode(stream: BinaryStream, _value?: StatusCode): StatusCode {
    const code = stream.readUInt32();
    return getStatusCodeFromCode(code);
}

export class ModifiableStatusCode extends StatusCode {
    private readonly _base: StatusCode;
    private _extraBits: number;

    constructor(options: { _base: StatusCode }) {
        super();
        this._base = options._base;
        this._extraBits = 0;
        if (this._base instanceof ModifiableStatusCode) {
            this._extraBits = this._base._extraBits;
            this._base = this._base._base;
        }
    }

    public get value(): number {
        return this._base.value + this._extraBits;
    }

    public get name(): string {
        return this._base.name + this._getExtraName();
    }

    public get description(): string {
        return this._base.description;
    }

    public set(bit: string | number): void {
        if (typeof bit === "string") {
            const bitsArray = bit.split(" | ");
            if (bitsArray.length > 1) {
                for (const bitArray of bitsArray) {
                    this.set(bitArray);
                }
                return;
            }
            const tmp = extraStatusCodeBits[bit as string];

            /* c8 ignore next */
            if (!tmp) {
                throw new Error(`Invalid StatusCode Bit ${bit}`);
            }
            bit = tmp;
        }
        this._extraBits = this._extraBits | (bit as number);
    }

    public unset(bit: string | number): void {
        if (typeof bit === "string") {
            const bitsArray = bit.split(" | ");
            if (bitsArray.length > 1) {
                for (const bitArray of bitsArray) {
                    this.unset(bitArray);
                }
                return;
            }
            const tmp = extraStatusCodeBits[bit];

            /* c8 ignore next */
            if (!tmp) {
                throw new Error(`Invalid StatusCode Bit ${bit}`);
            }
            bit = tmp;
        }
        this._extraBits = this._extraBits & (~bit >>> 0);
    }

    private _getExtraName() {
        const str: string[] = [];
        for (const [key, value] of Object.entries(extraStatusCodeBits)) {
            if ((this._extraBits & value) === value) {
                str.push(key);
            }
        }

        /* c8 ignore next */
        if (str.length === 0) {
            return "";
        }
        return `#${str.join("|")}`;
    }
}

// hide private properties
Object.defineProperty(ModifiableStatusCode.prototype, "_base", { enumerable: false, writable: true });
Object.defineProperty(ModifiableStatusCode.prototype, "_extraBits", { enumerable: false, writable: true });

// StatusCodes, coerceStatusCode and the table installation now live in
// status_codes_registry.ts, which is the only module allowed to import the generated
// table. See the note on unknownStatusCodeFallback above for why.
