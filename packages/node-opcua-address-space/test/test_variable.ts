import * as path from "path";
import * as should from "should";
import * as sinon from "sinon";

import { DataTypeIds } from "node-opcua-constants";
import { AttributeIds, makeAccessLevelFlag, NodeClass } from "node-opcua-data-model";
import { DataValue, sameDataValue } from "node-opcua-data-value";
import { NodeId, makeNodeId } from "node-opcua-nodeid";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { NumericRange } from "node-opcua-numeric-range";
import { WriteValue, WriteValueOptions } from "node-opcua-types";
import { StatusCodeCallback } from "node-opcua-status-code";

const nodeset_filename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");

import {
    AddressSpace,
    BindVariableOptionsVariation2,
    Namespace,
    PseudoSession,
    UARootFolder,
    SessionContext,
    UAVariable
} from "..";
import { generateAddressSpace } from "../nodeJS";

import { create_minimalist_address_space_nodeset } from "../testHelpers";

const context = SessionContext.defaultContext;

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Variables ", () => {
    // eslint-disable-next-line max-statements
    it("ZZ1- a variable should return attributes with  the expected data type ", () => {
        const addressSpace = AddressSpace.create();
        create_minimalist_address_space_nodeset(addressSpace);
        const namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);
        const v = namespace.addVariable({
            accessLevel: "CurrentRead",
            arrayDimensions: [1, 2, 3],
            browseName: "some variable",
            dataType: "Double",
            minimumSamplingInterval: 10,
            userAccessLevel: "CurrentRead"
        });

        let value;

        value = v.readAttribute(context, AttributeIds.AccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
        value.value.value.should.eql(makeAccessLevelFlag("CurrentRead"));
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.AccessLevelEx);
        value.value.dataType.should.eql(DataType.UInt32);
        value.value.value.should.eql(makeAccessLevelFlag("CurrentRead"));
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.UserAccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.ValueRank);
        value.value.dataType.should.eql(DataType.Int32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.ArrayDimensions);
        value.value.arrayType.should.eql(VariantArrayType.Array);
        value.value.value.should.eql(new Uint32Array([1, 2, 3]));
        (value.value.value instanceof Uint32Array).should.eql(true);
        value.value.dataType.should.eql(DataType.UInt32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.Historizing);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.BrowseName);
        value.value.dataType.should.eql(DataType.QualifiedName);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.DisplayName);
        value.value.dataType.should.eql(DataType.LocalizedText);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.MinimumSamplingInterval);
        value.value.dataType.should.eql(DataType.Double);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.IsAbstract);
        value.statusCode.name.should.eql("BadAttributeIdInvalid");

        value = v.readAttribute(context, AttributeIds.NodeClass);
        value.value.dataType.should.eql(DataType.Int32);
        value.value.value.should.eql(NodeClass.Variable);
        value.statusCode.should.eql(StatusCodes.Good);

        //https://reference.opcfoundation.org/v104/Core/docs/Part3/8.56/
        should(v.accessRestrictions).eql(undefined);
        value = v.readAttribute(context, AttributeIds.AccessRestrictions);
        value.statusCode.name.should.eql("BadAttributeIdInvalid");
        // value.value.dataType.should.eql(DataType.UInt16);
        //value.value.value.should.eql(0x00);
        // value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(context, AttributeIds.RolePermissions);
        value.statusCode.name.should.eql("BadAttributeIdInvalid");

        value = v.readAttribute(context, AttributeIds.UserRolePermissions);
        value.statusCode.name.should.eql("BadAttributeIdInvalid");

        addressSpace.dispose();
    });
});

type Done = () => void;

describe("Address Space : add Variable :  testing various variations for specifying dataType", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;

    before((done: Done) => {
        addressSpace = AddressSpace.create();
        generateAddressSpace(addressSpace, nodeset_filename, () => {
            namespace = addressSpace.registerNamespace("Private");
            namespace.index.should.eql(1);

            rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            done();
        });
    });

    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("AddressSpace#addVariable should accept a dataType as String", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable1",
            dataType: "ImagePNG",
            organizedBy: rootFolder
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });

    it("AddressSpace#addVariable should accept a dataType as DataTypeId value", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable2",
            dataType: DataTypeIds.ImagePNG,
            organizedBy: rootFolder
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });

    it("AddressSpace#addVariable should accept a dataType as a NodeId object", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable3",
            dataType: makeNodeId(2003, 0),
            organizedBy: rootFolder
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });

    it("AddressSpace#addVariable should accept a dataType as a NodeId string", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable4",
            dataType: "ns=0;i=2003",
            organizedBy: rootFolder
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });

    it("AddressSpace#addVariable({propertyOf:..}) should accept a typeDefinition as a String", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable5",
            dataType: "Double",
            propertyOf: rootFolder,
            typeDefinition: "PropertyType"
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");
    });

    it("AddressSpace#addVariable should accept a typeDefinition as a VariableTypeId value", () => {
        const VariableTypeIds = require("node-opcua-constants").VariableTypeIds;

        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable6",
            dataType: "Double",
            organizedBy: rootFolder,
            typeDefinition: VariableTypeIds.PropertyType
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");
    });

    it("AddressSpace#addVariable should accept a typeDefinition as a NodeId object", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable7",
            dataType: "Double",
            organizedBy: rootFolder,
            typeDefinition: makeNodeId(68)
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");
    });

    it("AddressSpace#addVariable should accept a typeDefinition as a NodeId string", () => {
        const nodeVar = namespace.addVariable({
            browseName: "SomeVariable8",
            dataType: "Double",
            organizedBy: rootFolder,
            typeDefinition: "ns=0;i=68"
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");
    });

    it("AddressSpace#addVariable should throw if typeDefinition is invalid", () => {
        should(() => {
            const nodeVar = namespace.addVariable({
                browseName: "SomeVariable9",
                dataType: "Double",
                organizedBy: rootFolder,
                typeDefinition: "ns=0;i=2003" // << 2003 is a DataType not a VariableType
            });
        }).throwError();
    });
});

describe("testing Variable#bindVariable", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;

    before(async () => {
        addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, nodeset_filename);

        addressSpace.registerNamespace("Private");
        namespace = addressSpace.getOwnNamespace();
        namespace.index.should.eql(1);
        rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;
    });
    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it(
        "T1 - testing Variable#bindVariable -> Getter - " +
            "should create a static read only variable (static value defined at construction time)",
        async () => {
            const variable = namespace.addVariable({
                accessLevel: "CurrentRead",
                browseName: "SomeVariableT1",
                dataType: "Double",
                organizedBy: rootFolder,
                typeDefinition: makeNodeId(68),
                value: {
                    dataType: DataType.Double,
                    value: 5678
                }
            });

            variable.isWritable(context).should.eql(false);

            (typeof (variable as any).refreshFunc).should.eql("undefined");

            const dataValueCheck1 = await variable.readAttribute(context, AttributeIds.Value);
            dataValueCheck1.should.be.instanceOf(DataValue);
            dataValueCheck1.statusCode.should.eql(StatusCodes.Good);

            // xx console.log("dataValue_check =",dataValue_check.toString());
            dataValueCheck1.value.value.should.eql(5678);

            const dataValue = new DataValue({
                value: {
                    dataType: DataType.Double,
                    value: 200
                }
            });

            const statusCode = await variable.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.BadNotWritable);

            const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
            dataValueCheck2.should.be.instanceOf(DataValue);
            dataValueCheck2.value.value.should.eql(5678);
        }
    );

    it(
        "T2 - testing Variable#bindVariable -> Getter - " +
            "should create a variable with synchronous get, dataValue shall change only if 'get' returns a different value",
        async () => {
            const variable = namespace.addVariable({
                browseName: "Variable37",
                dataType: "Double",
                organizedBy: rootFolder,
                typeDefinition: makeNodeId(68)
            });

            let value = 100.0;

            const getFunc = sinon.spy(() => {
                return new Variant({
                    dataType: DataType.Double,
                    value
                });
            });

            const options = {
                get: getFunc,
                set: (variant: Variant) => {
                    variant.should.be.instanceOf(Variant);
                    value = variant.value;
                    return StatusCodes.Good;
                }
            };
            variable.bindVariable(options);

            const base = options.get.callCount;

            const dataValue1 = variable.readValue();

            options.get.callCount.should.eql(1 + base);

            const dataValue2 = variable.readValue();
            options.get.callCount.should.eql(2 + base);

            sameDataValue(dataValue1, dataValue2).should.eql(true);
            dataValue1.serverTimestamp!.getTime().should.eql(dataValue2.serverTimestamp!.getTime());

            // now change data value
            value = value + 200;

            const dataValue3 = variable.readValue();
            options.get.callCount.should.eql(3 + base);
            sameDataValue(dataValue1, dataValue3).should.eql(false); // dataValue must have changed

            dataValue1.serverTimestamp!.getTime().should.be.belowOrEqual(dataValue3.serverTimestamp!.getTime());
        }
    );

    it(
        "T3 - testing Variable#bindVariable -> Getter - " + "should create a variable with synchronous get and set functor",
        async () => {
            const variable = namespace.addVariable({
                browseName: "SomeVariable",
                dataType: "Double",
                organizedBy: rootFolder,
                typeDefinition: makeNodeId(68)
            });

            let value = 100.0;

            const options = {
                get() {
                    return new Variant({
                        dataType: DataType.Double,
                        value
                    });
                },
                set(variant: Variant) {
                    variant.should.be.instanceOf(Variant);
                    value = variant.value;
                    return StatusCodes.Good;
                }
            };
            variable.bindVariable(options);

            await variable.readValueAsync(context);

            const dataValueCheck1 = variable.readAttribute(context, AttributeIds.Value);
            dataValueCheck1.should.be.instanceOf(DataValue);
            dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
            dataValueCheck1.value.value.should.eql(100);

            // When we write a different value
            const dataValue = new DataValue({
                value: {
                    dataType: DataType.Double,
                    value: 200
                }
            });

            const statusCode = await variable.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);
            value.should.eql(200);

            const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
            dataValueCheck2.should.be.instanceOf(DataValue);
            dataValueCheck2.value.value.should.eql(200);
        }
    );

    it(
        "T4 - testing Variable#bindVariable -> Getter - " + "should create a read only variable with a timestamped_get",
        async () => {
            const variable = namespace.addVariable({
                browseName: "SomeVariableT3",
                dataType: "Double",
                organizedBy: rootFolder,
                typeDefinition: makeNodeId(68)
            });

            const value_with_timestamp = new DataValue({
                sourcePicoseconds: 0,
                sourceTimestamp: new Date(1789, 7, 14),
                value: new Variant({ dataType: DataType.Double, value: 987654.0 })
            });

            let counter = 0;
            const options = {
                timestamped_get() {
                    counter += 1;
                    return value_with_timestamp;
                }
            };
            variable.bindVariable(options);

            counter = 0;
            const dataValueCheck1 = await variable.readValueAsync(context);
            counter.should.eql(1, "expecting timestamped_get to have been called");

            dataValueCheck1.should.be.instanceOf(DataValue);
            dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
            dataValueCheck1.value.value.should.eql(987654);
            dataValueCheck1.sourceTimestamp!.should.eql(new Date(1789, 7, 14));

            // write_simple_value
            const dataValue = new DataValue({
                value: {
                    dataType: DataType.Double,
                    value: 200
                }
            });
            const statusCode = await variable.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.BadNotWritable);

            // read_simple_value

            const dataValueCheck2 = await variable.readValueAsync(context);
            dataValueCheck2.should.be.instanceOf(DataValue);
            dataValueCheck2.value.value.should.eql(987654);
            dataValueCheck2.sourceTimestamp!.should.eql(new Date(1789, 7, 14));
        }
    );

    it("T5 - testing Variable#bindVariable -> Getter - " + "should create a read only variable with a refreshFunc", async () => {
        const variable = namespace.addVariable({
            browseName: "SomeVariableT4",
            dataType: "Double",
            organizedBy: rootFolder,
            typeDefinition: makeNodeId(68)
        });

        const options = {
            refreshFunc(callback: (err: Error | null, dataValue?: DataValue) => void) {
                setTimeout(() => {
                    const dataValue = new DataValue({
                        sourceTimestamp: new Date(),
                        value: {
                            dataType: DataType.Double,
                            value: 2468
                        }
                    });
                    callback(null, dataValue);
                }, 10);
            }
        };

        variable.bindVariable(options);

        // read_simple_value
        const dataValueCheck1 = variable.readValue();
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.UncertainInitialValue);

        // call_refresh
        await variable.asyncRefresh(new Date());

        // read_simple_value_after_refresh
        const dataValueCheck2 = variable.readValue();
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck2.value.value.should.eql(2468);
    });

    async function read_double_and_check(variable: UAVariable, expected_value: any, expected_date?: Date): Promise<void> {
        const dataValue = await variable.readValueAsync(context);
        dataValue.should.be.instanceOf(DataValue);
        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.value.should.eql(expected_value);
        if (expected_date) {
            dataValue.sourceTimestamp!.should.eql(expected_date);
        }
    }

    it("Q1 - testing Variable#bindVariable -> Setter -" + " should create a variable with a sync  setter", async () => {
        const variable = namespace.addVariable({
            browseName: "SomeVariableQ1",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        const value_with_timestamp = new DataValue({
            sourcePicoseconds: 100,
            sourceTimestamp: new Date(),
            value: new Variant({
                dataType: DataType.Double,
                value: 100
            })
        });

        const options = {
            get() {
                return value_with_timestamp.value;
            },
            set(value: Variant) {
                value_with_timestamp.value = value;
                return StatusCodes.Good;
            }
        };
        variable.bindVariable(options);

        await read_double_and_check(variable, 100);

        // write_simple_value
        const dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                value: 200
            }
        });
        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        await read_double_and_check(variable, 200);
    });

    it("Q2 - testing Variable#bindVariable -> Setter - " + "should create a variable with a async setter", async () => {
        const variable = namespace.addVariable({
            browseName: "SomeVariableQ1",
            dataType: "Double",
            organizedBy: rootFolder,
            typeDefinition: makeNodeId(68)
        });

        const value_with_timestamp = {
            sourcePicoseconds: 100,
            sourceTimestamp: new Date(),
            value: new Variant({ dataType: DataType.Double, value: 100 })
        };

        const options = {
            get() {
                return value_with_timestamp.value;
            },
            set(value: Variant, callback: (err: Error | null, statusCode: StatusCode) => void) {
                setTimeout(() => {
                    value_with_timestamp.value = value;
                    callback(null, StatusCodes.Good);
                }, 10);
            }
        };
        variable.bindVariable(options);

        await read_double_and_check(variable, 100);

        // write_simple_value
        const dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                value: 200
            }
        });
        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        await read_double_and_check(variable, 200);
    });

    it("Q3 - testing Variable#bindVariable -> Setter - " + "should create a variable with a sync timestamped setter", async () => {
        const variable = namespace.addVariable({
            browseName: "SomeVariableQ1",
            dataType: "Double",
            organizedBy: rootFolder,
            typeDefinition: makeNodeId(68)
        });

        const value_with_timestamp = new DataValue({
            sourcePicoseconds: 100,
            sourceTimestamp: new Date(1999, 9, 9),
            value: new Variant({ dataType: DataType.Double, value: 100 })
        });

        const options = {
            timestamped_get() {
                return value_with_timestamp;
            },
            timestamped_set(dataValue1: DataValue, callback: CallbackT<StatusCode>) {
                value_with_timestamp.value = dataValue1.value;
                value_with_timestamp.sourceTimestamp = dataValue1.sourceTimestamp;
                value_with_timestamp.sourcePicoseconds = dataValue1.sourcePicoseconds;
                callback(null, StatusCodes.Good);
            }
        };
        variable.bindVariable(options);

        const expected_date1 = new Date(1999, 9, 9);
        const expected_date2 = new Date(2010, 9, 9);

        await read_double_and_check(variable, 100, expected_date1);

        // write_simple_value(
        const dataValue = new DataValue({
            sourceTimestamp: expected_date2,
            value: {
                dataType: DataType.Double,
                value: 200
            }
        });
        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        await read_double_and_check.bind(null, variable, 200, expected_date2);
    });

    it(
        "Q4 - testing Variable#bindVariable -> Setter - " +
            "issue#332 should create a variable with async setter and an async getter",
        async () => {
            const value_with_timestamp = new DataValue({
                sourcePicoseconds: 100,
                sourceTimestamp: new Date(1999, 9, 9),
                value: new Variant({ dataType: DataType.Double, value: 100 })
            });

            const value_options: BindVariableOptionsVariation2 = {
                timestamped_get(callback: CallbackT<DataValue>) {
                    setTimeout(() => {
                        callback(null, value_with_timestamp);
                    }, 100);
                },
                timestamped_set(dataValue1: DataValue, callback: StatusCodeCallback): void {
                    setTimeout(() => {
                        value_with_timestamp.value = dataValue1.value;
                        value_with_timestamp.sourceTimestamp = dataValue1.sourceTimestamp;
                        value_with_timestamp.sourcePicoseconds = dataValue1.sourcePicoseconds;
                        callback(null, StatusCodes.Good);
                    }, 100);
                }
            };

            const variable = namespace.addVariable({
                browseName: "SomeVariableQ1",
                dataType: "Double",
                organizedBy: rootFolder,
                typeDefinition: makeNodeId(68),
                value: value_options
            });

            // , now use it ....
            const expected_date1 = new Date(1999, 9, 9);
            const expected_date2 = new Date(2010, 9, 9);

            await read_double_and_check(variable, 100, expected_date1);

            // write_simple_value
            const dataValue = new DataValue({
                sourceTimestamp: expected_date2,
                value: {
                    dataType: DataType.Double,
                    value: 200
                }
            });
            const statusCode = await variable.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);
            await read_double_and_check(variable, 200, expected_date2);
        }
    );
});

describe("testing Variable#writeValue Scalar", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;
    let variable: UAVariable;

    before((done: (err?: Error) => void) => {
        addressSpace = AddressSpace.create();

        generateAddressSpace(addressSpace, nodeset_filename, () => {
            namespace = addressSpace.registerNamespace("Private");
            namespace.index.should.eql(1);

            namespace = addressSpace.getOwnNamespace();

            rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            variable = namespace.addVariable({
                accessLevel: "CurrentRead | CurrentWrite",
                browseName: "some variable",
                dataType: "Duration",
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",
                value: new Variant({
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.Double,
                    value: 100.0
                })
            });

            done();
        });
    });

    beforeEach((done: (err?: Error) => void) => {
        const dataValue = new DataValue({
            value: {
                arrayType: VariantArrayType.Scalar,
                dataType: DataType.Double,
                value: 10.0
            }
        });

        variable.writeValue(context, dataValue, (err: Error | null, statusCode?: StatusCode) => {
            if (err || !statusCode) {
                return done(err || new Error("Internal Error"));
            }
            statusCode.should.eql(StatusCodes.Good);
            const dataValue_check = variable.readAttribute(context, AttributeIds.Value);
            dataValue_check.value.value.should.eql(10.0);
            done(err || undefined);
        });
    });

    after(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should write a double in a Duration ", async () => {
        const dataValue = new DataValue({
            value: {
                arrayType: VariantArrayType.Scalar,
                dataType: DataType.Double,
                value: 12.0
            }
        });

        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        const dataValue_check = variable.readAttribute(context, AttributeIds.Value);
        dataValue_check.value.value.should.eql(12.0);
    });
});

describe("testing Variable#writeValue Array", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;
    let variable: UAVariable;

    before((done: (err?: Error) => void) => {
        addressSpace = AddressSpace.create();
        generateAddressSpace(addressSpace, nodeset_filename, () => {
            addressSpace.registerNamespace("Private");
            namespace = addressSpace.getOwnNamespace();

            rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            variable = addressSpace.getOwnNamespace().addVariable({
                accessLevel: "CurrentRead | CurrentWrite",
                arrayDimensions: [1, 2, 3],
                browseName: "some variable",
                dataType: "Double",
                minimumSamplingInterval: 100,
                userAccessLevel: "CurrentRead | CurrentWrite",

                value: new Variant({
                    arrayType: VariantArrayType.Array,
                    dataType: DataType.Double,
                    value: []
                })
            });
            done();
        });
    });
    beforeEach(async () => {
        const dataValue = new DataValue({
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Double,
                value: [1, 2, 3, 4, 5, 6]
            }
        });

        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        const dataValue_check = variable.readAttribute(context, AttributeIds.Value);
        dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
    });

    after((done: (err?: Error) => void) => {
        if (addressSpace) {
            addressSpace.dispose();
        }
        done();
    });

    it("A1 should write an array ", async () => {
        const dataValueCheck1 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck1.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));

        const dataValue = new DataValue({
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Double,
                value: [2, 3, 4, 5, 6, 7]
            }
        });

        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck2.value.value.should.eql(new Float64Array([2, 3, 4, 5, 6, 7]));
    });

    it("A2 should write an portion of an array ", async () => {
        const dataValueCheck1 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck1.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));

        const dataValue = new DataValue({
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Double,
                value: [500]
            }
        });

        should(dataValue.value.value instanceof Float64Array).be.eql(true);

        const statusCode = await variable.writeValue(context, dataValue, NumericRange.coerce("1"));
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck2.value.value.should.eql(new Float64Array([1, 500, 3, 4, 5, 6]));
    });

    it("A3 should write statusCode= GoodClamped and retrieve statusCode GoodClamped", async () => {
        const dataValueCheck1 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck1.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));

        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodClamped,
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Double,
                value: [1, 2, 3, 4, 5, 6]
            }
        });

        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.statusCode.should.eql(StatusCodes.GoodClamped);
        dataValueCheck2.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
    });

    it("A4 should write statusCode= GoodClamped and retrieve statusCode GoodClamped with index range", async () => {
        const dataValueCheck1 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck1.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));

        const dataValue = new DataValue({
            statusCode: StatusCodes.GoodClamped,
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Double,
                value: [200]
            }
        });

        const statusCode = await variable.writeValue(context, dataValue, NumericRange.coerce("1"));
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.statusCode.should.eql(StatusCodes.GoodClamped);
        dataValueCheck2.value.value.should.eql(new Float64Array([1, 200, 3, 4, 5, 6]));
    });

    it("A5 should write sourceTimestamp and retrieve sourceTimestamp", async () => {
        const dataValueCheck1 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck1.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));

        const dataValue = new DataValue({
            sourcePicoseconds: 1234,
            sourceTimestamp: new Date(1789, 7, 14),
            statusCode: StatusCodes.GoodClamped,
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Double,
                value: [200]
            }
        });

        const statusCode = await variable.writeValue(context, dataValue, NumericRange.coerce("1"));
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck2 = variable.readAttribute(context, AttributeIds.Value);
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.statusCode.should.eql(StatusCodes.GoodClamped);
        dataValueCheck2.value.value.should.eql(new Float64Array([1, 200, 3, 4, 5, 6]));
        dataValueCheck2.sourceTimestamp!.should.eql(new Date(1789, 7, 14));
    });

    it("A6 - should write a ByteString into a Array of Byte", async () => {
        // as  per CTT write Attribute test 007

        const variable2 = namespace.addVariable({
            browseName: "SomeArrayOfByte",
            dataType: "Byte",
            organizedBy: rootFolder,
            typeDefinition: makeNodeId(68),
            value: {
                arrayType: VariantArrayType.Array,
                dataType: DataType.Byte,
                value: Buffer.from([1, 2, 3, 4, 5, 6, 7])
            },
            valueRank: 1 // Array !!!
        });

        const dataValueCheck1 = variable2.readAttribute(context, AttributeIds.Value);
        dataValueCheck1.should.be.instanceOf(DataValue);
        dataValueCheck1.statusCode.should.eql(StatusCodes.Good);
        dataValueCheck1.value.dataType.should.eql(DataType.Byte);
        dataValueCheck1.value.arrayType.should.eql(VariantArrayType.Array);
        dataValueCheck1.value.value.should.eql(Buffer.from([1, 2, 3, 4, 5, 6, 7]));

        const dataValue = new DataValue({
            statusCode: StatusCodes.Good,
            value: {
                arrayType: VariantArrayType.Scalar,
                dataType: DataType.ByteString,
                value: Buffer.from([11, 12, 13, 14, 15, 16, 17])
            }
        });

        const statusCode = await variable2.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);

        const dataValueCheck2 = variable2.readAttribute(context, AttributeIds.Value);
        dataValueCheck2.should.be.instanceOf(DataValue);
        dataValueCheck2.value.dataType.should.eql(DataType.Byte);
        dataValueCheck2.value.arrayType.should.eql(VariantArrayType.Array);
        dataValueCheck2.value.value.should.eql(Buffer.from([11, 12, 13, 14, 15, 16, 17]));
    });
});

describe("testing Variable#writeValue on Integer", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;
    let variableNotInteger: UAVariable;
    let variableInt32: UAVariable;

    before((done: (err?: Error) => void) => {
        addressSpace = AddressSpace.create();
        generateAddressSpace(addressSpace, nodeset_filename, () => {
            addressSpace.registerNamespace("Private");
            namespace = addressSpace.getOwnNamespace();

            rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

            variableNotInteger = namespace.addVariable({
                accessLevel: "CurrentRead | CurrentWrite",
                arrayDimensions: [1, 2, 3],
                browseName: "some  Variable",
                dataType: "String",
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",

                value: new Variant({
                    dataType: DataType.String,
                    value: "1"
                })
            });

            variableInt32 = namespace.addVariable({
                accessLevel: "CurrentRead | CurrentWrite",
                arrayDimensions: [1, 2, 3],
                browseName: "some Int32 Variable",
                dataType: "Int32",
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",

                value: new Variant({
                    dataType: DataType.Int32,
                    value: 1
                })
            });

            done();
        });
    });
    beforeEach((done: (err?: Error) => void) => {
        done();
    });

    after((done: (err?: Error) => void) => {
        if (addressSpace) {
            addressSpace.dispose();
        }
        done();
    });

    async function verify_badTypeMismatch(variable: UAVariable, dataType: DataType, value: any) {
        // same as CTT test write582err021 Err-011.js
        const dataValue = new DataValue({
            value: {
                dataType,
                value
            }
        });

        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.BadTypeMismatch);
    }

    async function verify_writeOK(variable: UAVariable, dataType: DataType, value: any) {
        // same as CTT test write582err021 Err-011.js
        const dataValue = new DataValue({
            value: {
                dataType,
                value
            }
        });
        const statusCode = await variable.writeValue(context, dataValue);
        statusCode.should.eql(StatusCodes.Good);
    }

    it("DZ1 should not be possible to write a Byte Value into a none integer Variable", async () => {
        await verify_badTypeMismatch(variableNotInteger, DataType.Byte, 36);
    });
    it("DZ2 should not be possible to write a UInt16 Value into a none integer Variable", async () => {
        await verify_badTypeMismatch(variableNotInteger, DataType.UInt16, 36);
    });
    it("DZ3 should not be possible to write a UInt32 Value into a none integer Variable", async () => {
        await verify_badTypeMismatch(variableNotInteger, DataType.UInt32, 36);
    });

    it("DZ2 should not be possible to write a UInt16 Value into a none Integer Variable", async () => {
        await verify_badTypeMismatch(variableNotInteger, DataType.UInt16, 36);
    });
    it("DZ3 should not be possible to write a UInt64 Value into a none integer Variable", async () => {
        await verify_badTypeMismatch(variableNotInteger, DataType.UInt64, 36);
    });

    it("DZ4 should not be possible to write a Byte Value into a none Integer Variable", async () => {
        await verify_badTypeMismatch(variableNotInteger, DataType.Byte, 36);
    });

    it("DZ5 should not be possible to write a Byte Value into a Int32 Variable", async () => {
        await verify_badTypeMismatch(variableInt32, DataType.Byte, 36);
    });
    it("DZ6 should not be possible to write a UInt16 Value into a Int32 Variable", async () => {
        await verify_badTypeMismatch(variableInt32, DataType.UInt16, 36);
    });
    it("DZ7 should not be possible to write a UInt32 Value into a Int32 Variable", async () => {
        await verify_badTypeMismatch(variableInt32, DataType.UInt32, 36);
    });
    it("DZ8 should not be possible to write a SByte Value into a Int32 Variable", async () => {
        await verify_badTypeMismatch(variableInt32, DataType.SByte, 36);
    });
    it("DZ9 should not be possible to write a Int16 Value into a Int32 Variable", async () => {
        await verify_badTypeMismatch(variableInt32, DataType.Int16, 36);
    });
    it("DZA should not be possible to write a UInt32 Value into a Int32 Variable", async () => {
        await verify_badTypeMismatch(variableInt32, DataType.UInt32, 36);
    });
    it("DZB should  possible to write a Int32 Value into a Int32 Variable", async () => {
        await verify_writeOK(variableInt32, DataType.Int32, 36);
    });
});

describe("testing UAVariable ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let rootFolder: UARootFolder;
    let variableInteger: UAVariable;
    let notReadableVariable: UAVariable;

    before((done: (err?: Error) => void) => {
        addressSpace = AddressSpace.create();
        generateAddressSpace(addressSpace, nodeset_filename, (err?: Error) => {
            addressSpace.registerNamespace("Private");

            namespace = addressSpace.getOwnNamespace();

            if (!err) {
                addressSpace.registerNamespace("Private");
                rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

                variableInteger = namespace.addVariable({
                    accessLevel: "CurrentRead | CurrentWrite",
                    arrayDimensions: [1, 2, 3],
                    browseName: "some INTEGER Variable",
                    dataType: "Integer",
                    minimumSamplingInterval: 10,
                    organizedBy: rootFolder,
                    userAccessLevel: "CurrentRead | CurrentWrite",
                    value: new Variant({
                        dataType: DataType.Int32,
                        value: 1
                    })
                });

                notReadableVariable = namespace.addVariable({
                    accessLevel: "CurrentWrite",
                    browseName: "NotReadableVariable",
                    dataType: "Integer",
                    organizedBy: rootFolder,
                    userAccessLevel: "CurrentWrite",
                    value: new Variant({
                        dataType: DataType.Int32,
                        value: 2
                    })
                });
            }
            done(err);
        });
    });
    after((done: (err?: Error) => void) => {
        if (addressSpace) {
            addressSpace.dispose();
        }
        done();
    });

    it("UAVariable#clone should clone a variable", () => {
        variableInteger.browseName.toString().should.eql("1:some INTEGER Variable");
        variableInteger.readValue().value.dataType.should.eql(DataType.Int32);
        variableInteger.readValue().value.value.should.eql(1);

        const variableIntegerClone = variableInteger.clone({ namespace: variableInteger.namespace! });
        variableIntegerClone.nodeId.toString().should.not.eql(variableInteger.nodeId.toString());

        variableIntegerClone.browseName.toString().should.eql("1:some INTEGER Variable");

        variableIntegerClone.readValue().value.dataType.should.eql(DataType.Int32);
        variableIntegerClone.readValue().value.value.should.eql(1);
        variableIntegerClone.readValue().value.should.eql(variableInteger.readValue().value);
    });

    interface UAVariablePrivate extends UAVariable {
        $dataValue: DataValue;
    }
    it("UAVariable#readValue should return an error if value is not readable", () => {
        (notReadableVariable as UAVariablePrivate).$dataValue.value.dataType.should.eql(DataType.Int32);
        (notReadableVariable as UAVariablePrivate).$dataValue.value.value.should.eql(2);
        (notReadableVariable as UAVariablePrivate).$dataValue.statusCode.should.eql(StatusCodes.Good);

        const dataValue = notReadableVariable.readValue();

        dataValue.statusCode.should.eql(StatusCodes.BadNotReadable);
        if (dataValue.value) {
            should(dataValue.value.dataType).eql(DataType.Null);
        }
        should(dataValue.serverTimestamp).eql(null);
        should(dataValue.sourceTimestamp).eql(null);
    });

    it("UAVariable#readValueAsync should return an error if value is not readable", async () => {
        (notReadableVariable as UAVariablePrivate).$dataValue.value.dataType.should.eql(DataType.Int32);
        (notReadableVariable as UAVariablePrivate).$dataValue.value.value.should.eql(2);
        (notReadableVariable as UAVariablePrivate).$dataValue.statusCode.should.eql(StatusCodes.Good);

        const dataValue = await notReadableVariable.readValueAsync(context);

        dataValue.statusCode.should.eql(StatusCodes.BadNotReadable);
        if (dataValue.value) {
            should(dataValue.value.dataType).eql(DataType.Null);
        }
        should(dataValue.serverTimestamp).eql(null);
        should(dataValue.sourceTimestamp).eql(null);
    });

    it("UAVariable#readValueAsync should cope with faulty refreshFunc -- calling callback with an error", async () => {
        rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

        const temperatureVar = namespace.addVariable({
            browseName: "BadVar",
            dataType: "Double",
            nodeId: "ns=1;s=BadVar",
            organizedBy: rootFolder,

            value: {
                refreshFunc(callback) {
                    const temperature = 20 + 10 * Math.sin(Date.now() / 10000);
                    const value = new Variant({ dataType: DataType.Double, value: temperature });
                    const sourceTimestamp = new Date();
                    // simulate a asynchronous behaviour
                    setTimeout(() => {
                        callback(new Error("Something goes wrong here"));
                    }, 100);
                }
            }
        });

        let _err: any;
        try {
            const dataValue = await temperatureVar.readValueAsync(context);
        } catch (err) {
            _err = err as Error;
        }
        should.exist(_err);
    });

    it("UAVariable#readValueAsync should cope with faulty refreshFunc - crashing inside refreshFunc", async () => {
        rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;
        const temperatureVar = namespace.addVariable({
            browseName: "BadVar2",
            dataType: "Double",
            nodeId: "ns=1;s=BadVar2",
            organizedBy: rootFolder,
            value: {
                refreshFunc(callback: CallbackT<DataValue>) {
                    throw new Error("Something goes wrong here");
                }
            }
        });

        let _err: Error;
        try {
            await temperatureVar.readValueAsync(context);
        } catch (err) {
            _err = err as Error;
        }
        should.exist(_err);
    });

    it("UAVariable#readValueAsync  should be re-entrant", async () => {
        rootFolder = addressSpace.findNode("RootFolder")! as UARootFolder;

        const temperatureVar = namespace.addVariable({
            browseName: "Temperature",
            dataType: "Double",
            nodeId: "ns=1;s=Temperature",
            organizedBy: rootFolder,

            value: {
                refreshFunc(callback) {
                    const temperature = 20 + 10 * Math.sin(Date.now() / 10000);
                    const value = new Variant({ dataType: DataType.Double, value: temperature });
                    const sourceTimestamp = new Date();
                    // simulate a asynchronous behaviour
                    setTimeout(() => {
                        callback(null, new DataValue({ value, sourceTimestamp }));
                    }, 100);
                }
            }
        });

        let counter = 0;
        let refValue: DataValue;

        let _resolve: any = null;
        const promise = new Promise((resolve) => {
            _resolve = resolve;
        });

        function my_callback(err: Error | null, value?: DataValue) {
            should.not.exist(err);
            counter = counter + 1;
            if (counter === 1) {
                refValue = value!;
            } else {
                refValue.should.eql(value);
            }
            if (counter === 4) {
                _resolve();
            }
        }

        // calling 4 times readValueAsync in parallel should cause the callback
        temperatureVar.readValueAsync(context, my_callback);
        temperatureVar.readValueAsync(context, my_callback);
        temperatureVar.readValueAsync(context, my_callback);
        temperatureVar.readValueAsync(context, my_callback);

        return promise;
    });

    it("UAVariable#writeAttribute ", async () => {
        const v = new WriteValue({
            attributeId: AttributeIds.Description,
            value: new DataValue({
                statusCode: StatusCodes.Good,
                value: {
                    dataType: DataType.String,
                    value: "New Description"
                }
            })
        });
        // trying to write a string value into a integer variable shall return
        // an statusCode

        const statusCode = await variableInteger.writeAttribute(context, v);
        statusCode.should.eql(StatusCodes.BadNotWritable);
    });

    it("UAVariable#setValueFromSource should cause 'value_changed' event to be raised", async () => {
        const objectsFolder = addressSpace.findNode("ObjectsFolder")!;

        const temperatureVar = namespace.addVariable({
            browseName: "Testing#setValueFromSource",
            dataType: "Double",
            organizedBy: objectsFolder,
            value: {
                dataType: DataType.Double,
                value: 0.0
            }
        });
        temperatureVar.minimumSamplingInterval.should.eql(0);

        let changeDetected = 0;
        temperatureVar.on("value_changed", (dataValue: DataValue) => {
            changeDetected += 1;
        });

        async function wait_a_little_bit() {
            return new Promise((resolve) => setTimeout(resolve, 10));
        }

        temperatureVar.setValueFromSource({ dataType: DataType.Double, value: 3.14 }, StatusCodes.Good);
        changeDetected.should.equal(1);

        await wait_a_little_bit();

        // calling setValueFromSource with same variant will cause change event, as in fact timestamps are also updated
        temperatureVar.setValueFromSource({ dataType: DataType.Double, value: 3.14 }, StatusCodes.Good);
        changeDetected.should.equal(2);

        await wait_a_little_bit();

        temperatureVar.setValueFromSource({ dataType: DataType.Double, value: 6.28 }, StatusCodes.Good);
        changeDetected.should.equal(3);
    });

    it("%%% should create a UAVariable with default value and be writable", async () => {
        const objectsFolder = addressSpace.findNode("ObjectsFolder")!;

        const temperatureVar = namespace.addVariable({
            browseName: "TestingNoValue",
            dataType: "Double",
            organizedBy: objectsFolder,
            value: undefined // undefined here !!!! {               dataType: DataType.Double, value: 0.0 }
        });

        const nodeId = temperatureVar.nodeId;
        const dataValue = await temperatureVar.readAttribute(context, AttributeIds.Value);
        dataValue.statusCode.should.eql(StatusCodes.UncertainInitialValue);

        const writeValue: WriteValueOptions = {
            attributeId: AttributeIds.Value,
            value: {
                value: {
                    dataType: "Double",
                    value: 32
                }
            },
            nodeId
        };
        const statusCode1 = await temperatureVar.writeAttribute(context, writeValue);
        statusCode1.should.eql(StatusCodes.Good);
    });
});
