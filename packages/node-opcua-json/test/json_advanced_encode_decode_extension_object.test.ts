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

import { inspect } from "node:util";
import "should";
import { make_debugLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import {
    BrokerWriterGroupTransportDataType,
    JsonWriterGroupMessageDataType,
    NetworkAddressUrlDataType,
    PubSubConfigurationDataType,
    PubSubConnectionDataType
} from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

import { opcuaJsonDecodeVariant, opcuaJsonEncodeVariant, type VariantJSON104, type VariantJSON105 } from "../source/index.js";
import { opcuaJsonDecodeVariant104, opcuaJsonEncodeVariant104 } from "../source/json_basic_encoding_decoding_variant.js";
import { JsonEncoderMode104, JsonEncodingScheme } from "../source/json_encoding_scheme.js";
import { fakeBuilder } from "./helper.js";

const debugLog = make_debugLog("TEST");
// const debugLog = console.log; make_debugLog;

const namespaceArray: string[] = [];
export function testEncodingDecodingExtensionObject104(p: ExtensionObject, expected: VariantJSON104): void {
    const variant = new Variant({ dataType: DataType.ExtensionObject, value: p });

    const json = opcuaJsonEncodeVariant104(variant, JsonEncoderMode104.Reversible, namespaceArray);
    if (!json) throw new Error("json is null");

    debugLog(inspect(json, { depth: 10 }));
    json.should.eql(expected);

    const variantReloaded = opcuaJsonDecodeVariant104(json as VariantJSON104, fakeBuilder, namespaceArray);

    const json2 = opcuaJsonEncodeVariant104(variantReloaded, JsonEncoderMode104.Reversible, namespaceArray);
    json.should.eql(json2);
}

export function testEncodingDecodingExtensionObject105(
    p: ExtensionObject,
    expected: VariantJSON105,
    scheme: JsonEncodingScheme.Compact | JsonEncodingScheme.Verbose = JsonEncodingScheme.Compact
): void {
    const variant = new Variant({ dataType: DataType.ExtensionObject, value: p });

    const json = opcuaJsonEncodeVariant(variant, scheme, []);
    if (!json) throw new Error("json is null");

    debugLog(inspect(json, { depth: 10 }));
    json.should.eql(expected);

    const variantReloaded = opcuaJsonDecodeVariant(json as unknown as VariantJSON105, fakeBuilder, namespaceArray);

    const json2 = opcuaJsonEncodeVariant(variantReloaded, scheme, []);
    json.should.eql(json2);
}

describe("it should encode and decode complex extension objects", () => {
    it("should encode a PubSubConfigurationDataType", () => {
        const p = new PubSubConfigurationDataType({});

        const expected104: VariantJSON104 = {
            Type: 22,
            Body: {
                TypeId: { Id: 15530 },
                Body: { PublishedDataSets: [], Connections: [], Enabled: false }
            }
        };
        testEncodingDecodingExtensionObject104(p, expected104);
        const expected105Verbose: VariantJSON105 = {
            UaType: 22,
            Value: {
                UaTypeId: "i=15530",
                UaBody: { PublishedDataSets: [], Connections: [], Enabled: false }
            }
        };
        testEncodingDecodingExtensionObject105(p, expected105Verbose, JsonEncodingScheme.Verbose);
        const expected105Compact: VariantJSON105 = {
            UaType: 22,
            Value: {
                UaTypeId: "i=15530",
                UaBody: { PublishedDataSets: [], Connections: [], Enabled: false }
            }
        };
        testEncodingDecodingExtensionObject105(p, expected105Compact, JsonEncodingScheme.Verbose);
    });

    it("should encode a PubSubConfigurationDataType-1", () => {
        const p = new PubSubConfigurationDataType({
            publishedDataSets: [
                {
                    dataSetFolder: ["A", "B", "C"]
                }
            ]
        });
        const Body = {
            PublishedDataSets: [
                {
                    DataSetFolder: ["A", "B", "C"],
                    DataSetMetaData: {
                        ConfigurationVersion: {
                            MajorVersion: 0,
                            MinorVersion: 0
                        },
                        DataSetClassId: "00000000-0000-0000-0000-000000000000",
                        EnumDataTypes: [],
                        Description: null,
                        Fields: [],
                        Name: "",
                        Namespaces: [],
                        SimpleDataTypes: [],
                        StructureDataTypes: []
                    },
                    DataSetSource: null,
                    ExtensionFields: [],
                    Name: ""
                }
            ],
            Connections: [],
            Enabled: false
        };
        const expected104 = {
            Type: 22,
            Body: {
                TypeId: { Id: 15530 },
                Body
            }
        };
        testEncodingDecodingExtensionObject104(p, expected104);

        const Body105Verbose = {
            PublishedDataSets: [
                {
                    DataSetFolder: ["A", "B", "C"],
                    DataSetMetaData: {
                        ConfigurationVersion: {
                            MajorVersion: 0,
                            MinorVersion: 0
                        },
                        DataSetClassId: "00000000-0000-0000-0000-000000000000",
                        EnumDataTypes: [],
                        Description: null,
                        Fields: [],
                        Name: "",
                        Namespaces: [],
                        SimpleDataTypes: [],
                        StructureDataTypes: []
                    },
                    DataSetSource: null,
                    ExtensionFields: [],
                    Name: ""
                }
            ],
            Connections: [],
            Enabled: false
        };
        const expected105Verbose = {
            UaType: 22,
            Value: {
                UaTypeId: "i=15530",
                UaBody: Body105Verbose
            }
        };
        testEncodingDecodingExtensionObject105(p, expected105Verbose, JsonEncodingScheme.Verbose);
        const Body105Compact = {
            PublishedDataSets: [
                {
                    DataSetFolder: ["A", "B", "C"]
                }
            ],
            Enabled: false
        };
        const expected105Compact = {
            UaType: 22,
            Value: {
                UaTypeId: "i=15530",
                UaBody: Body105Compact
            }
        };
        testEncodingDecodingExtensionObject105(p, expected105Compact, JsonEncodingScheme.Compact);
    });

    const p = new PubSubConfigurationDataType({
        publishedDataSets: [],
        connections: [
            new PubSubConnectionDataType({
                address: new NetworkAddressUrlDataType({}),
                writerGroups: [
                    {
                        writerGroupId: 1,
                        messageSettings: new JsonWriterGroupMessageDataType({}),
                        transportSettings: new BrokerWriterGroupTransportDataType({})
                    }
                ]
            })
        ]
    });
    it("should encode a PubSubConfigurationDataType-2 - 104", () => {
        const Body104 = {
            TypeId: { Id: 15530 },
            Body: {
                PublishedDataSets: [],
                Connections: [
                    {
                        Name: "",
                        Enabled: false,
                        PublisherId: null,
                        TransportProfileUri: "",
                        Address: {
                            TypeId: { Id: 15510 },
                            Body: {
                                NetworkInterface: "",
                                Url: ""
                            }
                        },
                        ConnectionProperties: [],
                        TransportSettings: null,
                        WriterGroups: [
                            {
                                Enabled: false,
                                GroupProperties: [],
                                MaxNetworkMessageSize: 0,
                                SecurityGroupId: "",
                                SecurityKeyServices: [],
                                SecurityMode: 0,
                                WriterGroupId: 1,
                                PublishingInterval: 0,
                                KeepAliveTime: 0,
                                Priority: 0,
                                LocaleIds: [],
                                HeaderLayoutUri: "",
                                Name: "",
                                TransportSettings: {
                                    TypeId: { Id: 15667 },
                                    Body: {
                                        QueueName: "",
                                        ResourceUri: "",
                                        AuthenticationProfileUri: "",
                                        RequestedDeliveryGuarantee: 0
                                    }
                                },
                                MessageSettings: {
                                    TypeId: { Id: 15657 },
                                    Body: { NetworkMessageContentMask: 0 }
                                },
                                DataSetWriters: []
                            }
                        ],
                        ReaderGroups: []
                    }
                ],
                Enabled: false
            }
        };
        const expected104 = {
            Type: 22,
            Body: Body104
        };

        testEncodingDecodingExtensionObject104(p, expected104);
    });
    it("should encode a PubSubConfigurationDataType-2 - Verbose", () => {
        const Value105Verbose = {
            UaTypeId: "i=15530",
            UaBody: {
                PublishedDataSets: [],
                Connections: [
                    {
                        Name: "",
                        Enabled: false,
                        PublisherId: {
                            UaType: 0,
                            Value: null
                        },
                        TransportProfileUri: "",
                        Address: {
                            UaTypeId: "i=15510",
                            UaBody: {
                                NetworkInterface: "",
                                Url: ""
                            }
                        },
                        ConnectionProperties: [],
                        TransportSettings: null,
                        WriterGroups: [
                            {
                                Enabled: false,
                                GroupProperties: [],
                                MaxNetworkMessageSize: 0,
                                SecurityGroupId: "",
                                SecurityKeyServices: [],
                                SecurityMode: 0,
                                WriterGroupId: 1,
                                PublishingInterval: 0,
                                KeepAliveTime: 0,
                                Priority: 0,
                                LocaleIds: [],
                                HeaderLayoutUri: "",
                                Name: "",
                                TransportSettings: {
                                    UaTypeId: "i=15667",
                                    UaBody: {
                                        QueueName: "",
                                        ResourceUri: "",
                                        AuthenticationProfileUri: "",
                                        RequestedDeliveryGuarantee: 0
                                    }
                                },
                                MessageSettings: {
                                    UaTypeId: "i=15657",
                                    UaBody: { NetworkMessageContentMask: 0 }
                                },
                                DataSetWriters: []
                            }
                        ],
                        ReaderGroups: []
                    }
                ],
                Enabled: false
            }
        };
        const expected105Verbose: VariantJSON105 = {
            UaType: 22,
            Value: Value105Verbose
        };
        testEncodingDecodingExtensionObject105(p, expected105Verbose, JsonEncodingScheme.Verbose);
    });
    it("should encode a PubSubConfigurationDataType-2 - Compact", () => {
        const Value105Compact = {
            UaTypeId: "i=15530",
            UaBody: {
                Connections: [
                    {
                        Address: {
                            UaTypeId: "i=15510"
                        },
                        Enabled: false,
                        PublisherId: { UaType: 0 },
                        WriterGroups: [
                            {
                                Enabled: false,
                                KeepAliveTime: 0,
                                MaxNetworkMessageSize: 0,
                                Priority: 0,
                                PublishingInterval: 0,
                                SecurityMode: 0,
                                WriterGroupId: 1,
                                TransportSettings: {
                                    UaTypeId: "i=15667"
                                },
                                MessageSettings: {
                                    UaTypeId: "i=15657"
                                }
                            }
                        ]
                    }
                ],
                Enabled: false
            }
        };
        const expected105Compact: VariantJSON105 = {
            UaType: 22,
            Value: Value105Compact
        };
        testEncodingDecodingExtensionObject105(p, expected105Compact, JsonEncodingScheme.Compact);
    });
});
