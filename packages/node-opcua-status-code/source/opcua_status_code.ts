"use strict";
/**
 * @module opcua.status-code
 */
import * as  _ from "underscore";
import assert from "node-opcua-assert";
import { BinaryStream } from "node-opcua-binary-stream";

export const StatusCodes = require("node-opcua-constants").StatusCodes;

export const extraStatusCodeBits: any = {

// StatusCode Special bits
//
// StructureChanged 15:15  Indicates that the structure of the associated data value has changed since the last
//                         Notification. Clients should not process the data value unless they re-read the metadata.
//                         Servers shall set this bit if the DataTypeEncoding used for a Variable changes.
//                         7.24 describes how the DataTypeEncoding is specified for a Variable.Servers shall also
//                         set this bit if the EnumStrings Property of the DataType of the Variable changes.
//                         This bit is provided to warn Clients that parse complex data values that their parsing
//                         routines could fail because the serialized form of the data value has changed.
//                         This bit has meaning only for StatusCodes returned as part of a data change Notification
//                         or the HistoryRead. StatusCodes used in other contexts shall always set this bit to zero.
//
    StructureChanged: (0x1 << 15),

// SemanticsChanged 14:14  Semantics of the associated data value have changed. Clients should not process the data
//                         value until they re-read the metadata associated with the Variable. Servers should set
//                         this bit if the metadata has changed in way that could cause application errors if the
//                         Client does not re-read the metadata. For example, a change to the engineering units
//                         could create problems if the Client uses the value to perform calculations.
//                         Part 8 defines the conditions where a Server shall set this bit for a DA Variable.
//                         Other specifications may define additional conditions. A Server may define other
//                         conditions that cause this bit to be set.
//                         This bit has meaning only for StatusCodes returned as part of a data change Notification
//                         or the HistoryRead. StatusCodes used in other contexts shall always set this bit to zero.
    SemanticChanged: (0x1 << 14),

// Reserved         12:13  Reserved for future use. Shall always be zero.

// InfoType         10:11  The type of information contained in the info bits. These bits have the following meanings:
//                         NotUsed    00  The info bits are not used and shall be set to zero.
//                         DataValue  01  The StatusCode and its info bits are associated with a data value
//                                        returned from the Server. This flag is only used in combination with
//                                        StatusCodes defined in Part 8.
//                         Reserved   1X  Reserved for future use. The info bits shall be ignored.
//
    InfoTypeDataValue: (0x1 << 10), // 0x0400,

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
    LimitLow: (0x1 << 8),
    LimitHigh: (0x2 << 8),
    LimitConstant: (0x3 << 8),

// Overflow         7:7    This bit shall only be set if the MonitoredItem queue size is greater than 1.
//                         If this bit is set, not every detected change has been returned since the Server’s
//                         queue buffer for the MonitoredItem reached its limit and had to purge out data.
    Overflow: (0x1 << 7), // 1 << 7


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
    HistorianCalculated: 0x1 << 0,
    HistorianInterpolated: 0x2 << 0,

    HistorianPartial: 0x1 << 2,
    HistorianExtraData: 0x1 << 3,
    HistorianMultiValue: 0x1 << 4,

};


// Release 1.03 144 OPC Unified Architecture, Part 4


StatusCodes.Bad = {
    name: "Bad",
    value: 0x80000000,
    description: "The value is bad but no specific reason is known."
};

StatusCodes.Uncertain = {
    name: "Uncertain",
    value: 0x40000000,
    description: "The value is uncertain but no specific reason is known."
};


/**
 * a particular StatusCode , with it's value , name and description
 *
 * @class  StatusCode
 * @param options
 * @param options.value
 * @param options.description
 * @param options.name
 *
 * @constructor
 */

export abstract class StatusCode {

    abstract get value(): number;
    abstract get name(): string;
    abstract get description(): string;

    get valueOf(): number {
        return this.value;
    }

    toString(): string {
        return this.name + " (0x" + ("0000" + this.value.toString(16)).substr(-8) + ")";
    }

    checkBit(mask: number): boolean {
        return (this.value & mask) === mask;
    }

    get hasOverflowBit(): boolean {
        return this.checkBit(extraStatusCodeBits.Overflow);
    }
    get hasSemanticChangedBit(): boolean {
        return this.checkBit(extraStatusCodeBits.SemanticChanged);
    }
    get hasStructureChangedBit(): boolean {
        return this.checkBit(extraStatusCodeBits.StructureChanged);
    }

    isNot(other: StatusCode): boolean {
        assert(other instanceof StatusCode);
        return this.value !== other.value;
    }

    equals(other: StatusCode): boolean {
        assert(other instanceof StatusCode);
        return this.value === other.value;
    }

    // return a status code that can be modified
    static makeStatusCode(statusCode: StatusCode, optionalBits: string): StatusCode {
        const tmp = new ModifiableStatusCode({
            _base: statusCode
        });
        if (optionalBits) {
            tmp.set(optionalBits);
        }
        return tmp;
    }

    toJSON(): any {
        return { value: this.value, name: this.name, description: this.description  };
    }
}
Object.defineProperty(StatusCode.prototype, "value",{enumerable: true });
Object.defineProperty(StatusCode.prototype, "description",{enumerable: true });
Object.defineProperty(StatusCode.prototype, "name",{enumerable: true });


export class ConstantStatusCode extends StatusCode {

    private _value: number;
    private _description: string;
    private _name: string;

    constructor(options: {value: number, description: string, name: string}) {
        super();
        this._value = options.value;
        this._description = options.description;
        this._name = options.name;
    }

    get value(): number {
        return this._value;
    }

    get name(): string {
        return this._name;
    }

    get description(): string {
        return this._description;
    }

    toJSON(): any {
        return {value: this.value };
    }
}
Object.defineProperty(ConstantStatusCode.prototype, "_value", { enumerable: false, writable: true });
Object.defineProperty(ConstantStatusCode.prototype, "_description", { enumerable: false, writable: true });
Object.defineProperty(ConstantStatusCode.prototype, "_name", { enumerable: false, writable: true });
Object.defineProperty(ConstantStatusCode.prototype, "value", { enumerable: true });
Object.defineProperty(ConstantStatusCode.prototype, "description", { enumerable: true});
Object.defineProperty(ConstantStatusCode.prototype, "name", { enumerable: true });




export function encodeStatusCode(statusCode: StatusCode|ConstantStatusCode, stream: BinaryStream) {
    stream.writeUInt32(statusCode.value);
}


function b(c: number) {
    const tmp = "0000000000000000000000" + (c >>> 0).toString(2);
    return tmp.substr(-32);
}

/* construct status codes fast search indexes */
const statusCodesReversedMap: any = {};
_.forEach(StatusCodes, (code: {value: number, description: string, name: string}) => {
    code = new ConstantStatusCode(code);
    statusCodesReversedMap[code.value.toString()] = code;
    StatusCodes[code.name] = code;
});
StatusCodes.makeStatusCode = StatusCode.makeStatusCode;

export function getStatusCodeFromCode(code: number) {

    const codeWithoutInfoBits = (code & 0xFFFF0000) >>> 0;
    const infoBits = code & 0x0000FFFF;
    let sc = statusCodesReversedMap[codeWithoutInfoBits];
    if (!sc) {
        sc = StatusCodes.Bad;
        console.warn("expecting a known StatusCode but got 0x" + codeWithoutInfoBits.toString(16));
    }
    if (infoBits) {
        const tmp = new ModifiableStatusCode({_base: sc});
        tmp.set(infoBits);
        sc = tmp;
    }
    return sc;
}

export function decodeStatusCode(stream: BinaryStream) {
    const code = stream.readUInt32();
    return getStatusCodeFromCode(code);

}




export class ModifiableStatusCode extends StatusCode {

    private _base: StatusCode;
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

    _getExtraName() {

        const self = this;
        const str: string[] = [];
        _.forEach(extraStatusCodeBits, (value: number, key: string) => {
            if ((self._extraBits & value) === value) {
                str.push(key);
            }
        });
        if (str.length === 0) {
            return "";
        }
        return "#" + str.join("|");
    }

    get value() {
        return this._base.value + this._extraBits;
    }

    get name() {
        return this._base.name + this._getExtraName();
    }

    get description() {
        return this._base.description;
    }

    set(bit: string | number) {

        if (typeof bit === "string") {
            const bitsArray = bit.split(" | ");
            if (bitsArray.length > 1) {
                for (const bitArray of bitsArray) {
                    this.set(bitArray);
                }
                return;
            }
            const tmp = extraStatusCodeBits[bit as string];
            if (!tmp) {
                throw new Error("Invalid StatusCode Bit " + bit);
            }
            bit = tmp;
        }
        this._extraBits = this._extraBits | (bit as number);
    }

    unset(bit: string) {

        if (typeof bit === "string") {

            const bitsArray = bit.split(" | ");
            if (bitsArray.length > 1) {
                for (const bitArray of bitsArray) {

                    console.log(" Unset", this._extraBits.toString(16));
                    this.unset(bitArray);
                    console.log(" Unset", this._extraBits.toString(16));
                }
                return;
            }
            const tmp = extraStatusCodeBits[bit];
            if (!tmp) {
                throw new Error("Invalid StatusCode Bit " + bit);
            }
            bit = tmp;
        }
        this._extraBits = this._extraBits & (~bit >>> 0);

    }

}
Object.defineProperty(ModifiableStatusCode.prototype, "_base", { enumerable: false, writable: true});
Object.defineProperty(ModifiableStatusCode.prototype, "_extraBits", { enumerable: false, writable: true});






StatusCodes.GoodWithOverflowBit = StatusCodes.makeStatusCode(StatusCodes.Good, "Overflow | InfoTypeDataValue");

export function coerceStatusCode(statusCode: any) {
    if (statusCode instanceof StatusCode) {
        return statusCode;
    }
    if (statusCode instanceof ConstantStatusCode) {
        return statusCode;
    }
    if (statusCode.hasOwnProperty("value")) {
        return getStatusCodeFromCode(statusCode.value);
    }
    if (typeof statusCode === "number") {
        return getStatusCodeFromCode(statusCode);
    }
    return StatusCodes[statusCode.name];
}


