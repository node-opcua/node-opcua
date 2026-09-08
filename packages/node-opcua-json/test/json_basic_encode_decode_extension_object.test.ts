/**
 * ==========================================================================
 * Copyright (c) 2021-2026 Sterfive - etienne.rossignon@sterfive.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 * ==========================================================================
 */
import "should";
import { inspect } from "node:util";
import type { ExtensionObject } from "node-opcua-extension-object";
import { NumericRange } from "node-opcua-numeric-range";
import { EventFilter, FilterOperator, Range, SimpleAttributeOperand } from "node-opcua-types";
import should from "should";
import {
    type ExtensionObjectJSON,
    opcuaJsonDecodeExtensionObject,
    opcuaJsonEncodeExtensionObject,
    type Pojo
} from "../source/index.js";
import { JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

// https://reference.opcfoundation.org/v104/Core/docs/Part6/5.4.2/

const NonReversible = JsonEncodingScheme.DeprecatedNonReversible;

const extensionObject = new Range({ low: 10, high: 20 });
const extensionObjectJson = {
    TypeId: { Id: 884 },
    Body: { Low: 10, High: 20 }
};

const extensionObject1 = new EventFilter({
    selectClauses: [],
    whereClause: {
        elements: [
            {
                filterOperands: [],
                filterOperator: FilterOperator.And
            }
        ]
    }
});

const extensionObject1Json = {
    TypeId: { Id: 725 },
    Body: {
        SelectClauses: [],
        WhereClause: { Elements: [{ FilterOperator: 10, FilterOperands: [] }] }
    }
};

const filterOperand = new SimpleAttributeOperand({
    indexRange: new NumericRange("1:3")
});
const filterOperandJson = {
    TypeId: { Id: 601 },
    Body: {
        // note: for some reason those fields in OPCUA, truly starts with a lowercase !
        TypeDefinitionId: { Id: 0 },
        BrowsePath: [],
        AttributeId: 0,
        IndexRange: "1:3"
    }
};
///
describe("JSON encode ExtensionObject", () => {
    describe("Reversible", () => {
        it("should encode a extension object  - Range", () => {
            should(opcuaJsonEncodeExtensionObject(extensionObject, JsonEncodingScheme.DeprecatedReversible)).eql({
                TypeId: {
                    Id: Range.schema.dataTypeNodeId.value
                },
                //  Encoding: 0,
                Body: {
                    Low: 10,
                    High: 20
                }
            });
        });
        it("should encode a extension object  - EventFilter", () => {
            should(opcuaJsonEncodeExtensionObject(extensionObject1, JsonEncodingScheme.DeprecatedReversible)).eql({
                TypeId: {
                    Id: EventFilter.schema.dataTypeNodeId.value
                },
                //  Encoding: 0,
                Body: {
                    SelectClauses: [],
                    WhereClause: {
                        Elements: [
                            {
                                FilterOperands: [],
                                FilterOperator: 10
                            }
                        ]
                    }
                }
            });
        });
        it("should encode a numeric range - FilterOperand", () => {
            should(opcuaJsonEncodeExtensionObject(filterOperand, JsonEncodingScheme.DeprecatedReversible)).eql({
                TypeId: { Id: 601 },
                Body: {
                    AttributeId: 0,
                    IndexRange: "1:3",
                    BrowsePath: [],
                    TypeDefinitionId: {
                        Id: 0
                    }
                }
            });
        });
    });
    describe("Non-Reversible", () => {
        it("should encode a extension object", () => {
            should(opcuaJsonEncodeExtensionObject(extensionObject, NonReversible)).eql({
                Low: 10,
                High: 20
            });
        });
        it("should encode a extension object  - EventFilter", () => {
            should(opcuaJsonEncodeExtensionObject(extensionObject1, NonReversible)).eql({
                SelectClauses: [],
                WhereClause: {
                    Elements: [
                        {
                            FilterOperands: [],
                            FilterOperator: 10
                        }
                    ]
                }
            });
        });
    });
});

const debugLog = console.log;

export function testEncodingDecodingExtensionObject(p: ExtensionObject, expected: Pojo): void {
    const json = opcuaJsonEncodeExtensionObject(p, JsonEncodingScheme.DeprecatedReversible);

    debugLog(inspect(json, { depth: 10 }));
    should(json).eql(expected);

    const extensionObjectReloaded = opcuaJsonDecodeExtensionObject(json as ExtensionObjectJSON, fakeBuilder, []);

    if (Array.isArray(extensionObjectReloaded)) {
        throw new Error("expecting a single ExtensionObject, got an array");
    }
    const json2 = opcuaJsonEncodeExtensionObject(extensionObjectReloaded, JsonEncodingScheme.DeprecatedReversible);
    should(json2).eql(json);
}
describe("JSON decode ExtensionObject", () => {
    it("NumericRange", () => {
        testEncodingDecodingExtensionObject(extensionObject, extensionObjectJson);
    });
    it("EventFilter", () => {
        testEncodingDecodingExtensionObject(extensionObject1, extensionObject1Json);
    });
    it("SimpleAttributeOperand", () => {
        testEncodingDecodingExtensionObject(filterOperand, filterOperandJson);
    });
});
