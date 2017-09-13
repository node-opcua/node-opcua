"use strict";

var _ = require("underscore");
var should = require("should");

var async = require("async");
var path = require("path");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;
var DataValue = require("node-opcua-data-value").DataValue;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;
var AttributeIds = require("node-opcua-data-model").AttributeIds;
var NodeClass = require("node-opcua-data-model").NodeClass;
var NodeId = require("node-opcua-nodeid").NodeId;
var makeNodeId = require("node-opcua-nodeid").makeNodeId;

var nodeset_filename = path.join(__dirname, "../test_helpers/test_fixtures/mini.Node.Set2.xml");


var address_space = require("..");
var UAVariable = address_space.UAVariable;
var SessionContext = address_space.SessionContext;
var generate_address_space = address_space.generate_address_space;
var context = SessionContext.defaultContext;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Variables ", function () {

    it("ZZ1- a variable should return attributes with  the expected data type ", function () {

        var addressSpace = new address_space.AddressSpace();

        var v = new UAVariable({
            browseName: "some variable",
            addressSpace: addressSpace,
            minimumSamplingInterval: 10,
            arrayDimensions: [1, 2, 3],
            userAccessLevel: "CurrentRead",
            accessLevel: "CurrentRead"
        });

        var value;

        value = v.readAttribute(context, AttributeIds.AccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
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
        value.value.value.should.eql(NodeClass.Variable.value);
        value.statusCode.should.eql(StatusCodes.Good);

        addressSpace.dispose();
    });

});


describe("Address Space : add Variable :  testing various variations for specifying dataType", function () {

    var addressSpace;
    var rootFolder;
    before(function (done) {
        addressSpace = new address_space.AddressSpace();
        generate_address_space(addressSpace, nodeset_filename, function () {

            rootFolder = addressSpace.findNode("RootFolder");

            done();
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });

    it("AddressSpace#addVariable should accept a dataType as String", function () {

        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable1",
            dataType: "ImagePNG"
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });
    it("AddressSpace#addVariable should accept a dataType as DataTypeId value", function () {

        var DataTypeIds = require("node-opcua-constants").DataTypeIds;

        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable2",
            dataType: DataTypeIds.ImagePNG
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("AddressSpace#addVariable should accept a dataType as a NodeId object", function () {


        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable3",
            dataType: makeNodeId(2003, 0)
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("AddressSpace#addVariable should accept a dataType as a NodeId string", function () {

        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable4",
            dataType: "ns=0;i=2003"
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("AddressSpace#addVariable({propertyOf:..}) should accept a typeDefinition as a String", function () {

        var nodeVar = addressSpace.addVariable({

            propertyOf: rootFolder,
            typeDefinition: "PropertyType",
            browseName: "SomeVariable5",
            dataType: "Double"
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");

    });
    it("AddressSpace#addVariable should accept a typeDefinition as a VariableTypeId value", function () {

        var VariableTypeIds = require("node-opcua-constants").VariableTypeIds;

        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable6",
            dataType: "Double",
            typeDefinition: VariableTypeIds.PropertyType
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");

    });
    it("AddressSpace#addVariable should accept a typeDefinition as a NodeId object", function () {
        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable7",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");
    });
    it("AddressSpace#addVariable should accept a typeDefinition as a NodeId string", function () {
        var nodeVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable8",
            dataType: "Double",
            typeDefinition: "ns=0;i=68"
        });
        nodeVar.typeDefinition.should.be.instanceOf(NodeId);
        nodeVar.typeDefinition.toString().should.eql("ns=0;i=68");
    });
    it("AddressSpace#addVariable should throw if typeDefinition is invalid", function () {
        should(function () {
            var nodeVar = addressSpace.addVariable({
                organizedBy: rootFolder,
                browseName: "SomeVariable9",
                dataType: "Double",
                typeDefinition: "ns=0;i=2003" // << 2003 is a DataType not a VariableType
            });
        }).throwError();
    });

});

describe("testing Variable#bindVariable", function () {

    var addressSpace, rootFolder;
    before(function (done) {
        addressSpace = new address_space.AddressSpace();
        generate_address_space(addressSpace, nodeset_filename, function () {

            rootFolder = addressSpace.findNode("RootFolder");

            done();
        });
    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        rootFolder = null;
    });

    it("T1 - testing Variable#bindVariable -> Getter - should create a static read only variable ( static value defined at construction time)", function (done) {

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariableT1",
            dataType: "Double",
            typeDefinition: makeNodeId(68),
            value: {
                dataType: DataType.Double,
                value: 5678
            },
            accessLevel: "CurrentRead"
        });
        variable.isWritable(context).should.eql(false);
        (typeof variable.asyncRefresh).should.eql("undefined");

        async.series([
            function read_simple_value(callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);

                //xx console.log("dataValue_check =",dataValue_check.toString());
                dataValue_check.value.value.should.eql(5678);
                callback(null);
            },
            function write_simple_value(callback) {

                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });

                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.BadNotWritable);
                    callback(err);
                });
            },
            function read_simple_value(callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.value.value.should.eql(5678);

                callback(null);
            }
        ], done);

    });

    it("T2 - testing Variable#bindVariable -> Getter - should create a variable with synchronous get, dataValue shall change only if 'get' returns a different value", function (done) {

        var sinon = require("sinon");

        var sameDataValue = require("node-opcua-data-value").sameDataValue;

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "Variable37",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value = 100.0;

        var getFunc = sinon.spy(function () {
            return new Variant({
                dataType: DataType.Double,
                value: value
            });
        });
        var options = {
            get: getFunc,
            set: function (variant) {
                variant.should.be.instanceOf(Variant);
                value = variant.value;
                return StatusCodes.Good;
            }
        };
        variable.bindVariable(options);


        var base = options.get.callCount;

        var dataValue1 = variable.readValue();
        console.log("Value1", dataValue1.toString().green);

        options.get.callCount.should.eql(1 + base);

        var dataValue2 = variable.readValue();
        console.log("Value2", dataValue2.toString().green);
        options.get.callCount.should.eql(2 + base);

        sameDataValue(dataValue1, dataValue2).should.eql(true);
        dataValue1.serverTimestamp.getTime().should.eql(dataValue2.serverTimestamp.getTime());


        // now change data value
        value = value + 200;

        var dataValue3 = variable.readValue();
        console.log("Value3", dataValue3.toString().green);
        options.get.callCount.should.eql(3 + base);
        sameDataValue(dataValue1, dataValue3).should.eql(false); // dataValue must have changed

        dataValue1.serverTimestamp.getTime().should.be.belowOrEqual(dataValue3.serverTimestamp.getTime());


        done();
    });

    it("T3 - testing Variable#bindVariable -> Getter - should create a variable with synchronous get and set functor", function (done) {

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariable",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value = 100.0;

        var options = {
            get: function () {
                return new Variant({
                    dataType: DataType.Double,
                    value: value
                });
            },
            set: function (variant) {
                variant.should.be.instanceOf(Variant);
                value = variant.value;
                return StatusCodes.Good;
            }
        };
        variable.bindVariable(options);


        async.series([
            function read_simple_value(callback) {

                //var
                variable.readValueAsync(context, function (err) {
                    if (!err) {
                        var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                        dataValue_check.should.be.instanceOf(DataValue);
                        dataValue_check.statusCode.should.eql(StatusCodes.Good);
                        //xx console.log("dataValue_check =",dataValue_check.toString());
                        dataValue_check.value.value.should.eql(100);
                    }
                    callback(err);

                });

            },
            function write_simple_value(callback) {

                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });

                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    value.should.eql(200);
                    callback(err);
                });
            },
            function read_simple_value(callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.value.value.should.eql(200);

                callback(null);
            }
        ], done);

    });

    it("T4 - testing Variable#bindVariable -> Getter - should create a read only variable with a timestamped_get", function (done) {

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariableT3",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value_with_timestamp = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 987654.0}),
            sourceTimestamp: new Date(1789, 7, 14),
            sourcePicoseconds: 0
        });
        var counter = 0;
        var options = {
            timestamped_get: function () {
                counter += 1;
                return value_with_timestamp;
            }
        };
        variable.bindVariable(options);

        // xx (_.isFunction(variable.asyncRefresh)).should.be(true);

        async.series([
            function read_simple_value(callback) {

                counter = 0;
                variable.readValueAsync(context, function (err, dataValue_check) {
                    counter.should.eql(1, "expecting timestamped_get to have been called");
                    if (!err) {
                        dataValue_check.should.be.instanceOf(DataValue);
                        dataValue_check.statusCode.should.eql(StatusCodes.Good);
                        dataValue_check.value.value.should.eql(987654);
                        dataValue_check.sourceTimestamp.should.eql(new Date(1789, 7, 14));
                    }
                    callback(err);

                });
            },
            function write_simple_value(callback) {
                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });
                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.BadNotWritable);
                    callback(err);
                });
            },
            function read_simple_value(callback) {

                variable.readValueAsync(context, function (err, dataValue_check) {
                    if (!err) {
                        dataValue_check.should.be.instanceOf(DataValue);
                        dataValue_check.value.value.should.eql(987654);
                        dataValue_check.sourceTimestamp.should.eql(new Date(1789, 7, 14));
                    }
                    callback(err);
                });

            }
        ], done);

    });

    it("T5 - testing Variable#bindVariable -> Getter - should create a read only variable with a refreshFunc", function (done) {

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariableT4",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });
        var options = {
            refreshFunc: function (callback) {
                setTimeout(function () {

                    var dataValue = new DataValue({
                        value: {
                            dataType: DataType.Double,
                            value: 2468
                        },
                        sourceTimestamp: new Date()
                    });
                    callback(null, dataValue);
                }, 10);
            }
        };
        variable.bindVariable(options);

        async.series([


            function read_simple_value(callback) {

                var dataValue_check = variable.readValue();
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.UncertainInitialValue);
                callback();
            },

            function call_refresh(callback) {
                variable.asyncRefresh(callback);
            },

            function read_simple_value_after_refresh(callback) {

                var dataValue_check = variable.readValue();

                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(2468);

                callback();

            }
        ], done);

    });

    function read_double_and_check(variable, expected_value, expected_date, callback) {

        variable.readValueAsync(context, function (err, dataValue_check) {
            if (!err) {
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(expected_value);
                if (expected_date) {
                    dataValue_check.sourceTimestamp.should.eql(expected_date);
                }

            }
            callback(err);
        });
    }

    it("Q1 - testing Variable#bindVariable -> Setter - should create a variable with a sync  setter", function (done) {

        var variable = addressSpace.addVariable({
            browseName: "SomeVariableQ1",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value_with_timestamp = {
            value: new Variant({dataType: DataType.Double, value: 100}),
            sourceTimestamp: new Date(),
            sourcePicoseconds: 100
        };
        var options = {
            get: function () {
                return value_with_timestamp.value;
            },
            set: function (value) {
                value_with_timestamp.value = value;
                return StatusCodes.Good;
            }
        };
        variable.bindVariable(options);

        async.series([

            read_double_and_check.bind(null, variable, 100, null),

            function write_simple_value(callback) {
                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });
                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            read_double_and_check.bind(null, variable, 200, null)
        ], done);
    });

    it("Q2 - testing Variable#bindVariable -> Setter - should create a variable with a async  setter", function (done) {

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariableQ1",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value_with_timestamp = {
            value: new Variant({dataType: DataType.Double, value: 100}),
            sourceTimestamp: new Date(),
            sourcePicoseconds: 100
        };
        var options = {
            get: function () {
                return value_with_timestamp.value;
            },
            set: function (value, callback) {
                setTimeout(function () {
                    value_with_timestamp.value = value;
                    callback(null, StatusCodes.Good);
                }, 10);
            }
        };
        variable.bindVariable(options);

        async.series([

            read_double_and_check.bind(null, variable, 100, null),

            function write_simple_value(callback) {
                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });
                variable.writeValue(context, dataValue, null, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            read_double_and_check.bind(null, variable, 200, null)
        ], done);
    });

    it("Q3 - testing Variable#bindVariable -> Setter - should create a variable with a sync timestamped setter", function (done) {

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariableQ1",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });

        var value_with_timestamp = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 100}),
            sourceTimestamp: new Date(1999, 9, 9),
            sourcePicoseconds: 100
        });
        var options = {
            timestamped_get: function () {
                return value_with_timestamp;
            },
            timestamped_set: function (ts_value, callback) {
                value_with_timestamp.value = ts_value.value;
                value_with_timestamp.sourceTimestamp = ts_value.sourceTimestamp;
                value_with_timestamp.sourcePicoseconds = ts_value.sourcePicoseconds;
                callback(null, StatusCodes.Good);
            }
        };
        variable.bindVariable(options);

        var expected_date1 = new Date(1999, 9, 9);
        var expected_date2 = new Date(2010, 9, 9);
        async.series([

            read_double_and_check.bind(null, variable, 100, expected_date1),

            function write_simple_value(callback) {
                var dataValue = new DataValue({
                    sourceTimestamp: expected_date2,
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });
                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },

            read_double_and_check.bind(null, variable, 200, expected_date2)
        ], done);
    });

    it("Q4 - testing Variable#bindVariable -> Setter - issue#332 should create a variable with async setter and an async getter", function (done) {

        var value_with_timestamp = new DataValue({
            value: new Variant({dataType: DataType.Double, value: 100}),
            sourceTimestamp: new Date(1999, 9, 9),
            sourcePicoseconds: 100
        });

        var value_options = {
            timestamped_get: function (callback) {
                setTimeout(function () {
                    callback(null, value_with_timestamp);
                }, 100);
            },
            timestamped_set: function (ts_value, callback) {
                setTimeout(function () {
                    value_with_timestamp.value = ts_value.value;
                    value_with_timestamp.sourceTimestamp = ts_value.sourceTimestamp;
                    value_with_timestamp.sourcePicoseconds = ts_value.sourcePicoseconds;
                    callback(null, StatusCodes.Good);
                }, 100);
            }
        };

        var variable = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "SomeVariableQ1",
            dataType: "Double",
            typeDefinition: makeNodeId(68),
            value: value_options
        });

        //, now use it ....
        var expected_date1 = new Date(1999, 9, 9);
        var expected_date2 = new Date(2010, 9, 9);

        async.series([

            read_double_and_check.bind(null, variable, 100, expected_date1),

            function write_simple_value(callback) {
                var dataValue = new DataValue({
                    sourceTimestamp: expected_date2,
                    value: {
                        dataType: DataType.Double,
                        value: 200
                    }
                });
                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },

            read_double_and_check.bind(null, variable, 200, expected_date2)
        ], done);

    });

});


describe("testing Variable#writeValue Scalar", function () {

    var addressSpace, rootFolder, variable;

    before(function (done) {

        addressSpace = new address_space.AddressSpace();
        generate_address_space(addressSpace, nodeset_filename, function () {

            rootFolder = addressSpace.findNode("RootFolder");

            variable = new UAVariable({
                browseName: "some variable",
                addressSpace: addressSpace,
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",
                accessLevel: "CurrentRead | CurrentWrite",
                dataType: "Duration",

                value: new Variant({
                    arrayType: VariantArrayType.Scalar,
                    dataType: DataType.Double,
                    value: 100.0
                })
            });

            done();
        });
    });
    beforeEach(function (done) {

        var dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                arrayType: VariantArrayType.Scalar,
                value: 10.0
            }
        });

        variable.writeValue(context, dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
            dataValue_check.value.value.should.eql(10.0);
            done(err);
        });
    });

    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        rootFolder = null;
    });

    it("should write a double in a Duration ", function (done) {

        var dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                arrayType: VariantArrayType.Scalar,
                value: 12.0
            }
        });
        variable.writeValue(context, dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
            dataValue_check.value.value.should.eql(12.0);
            done(err);
        });
    });

});

describe("testing Variable#writeValue Array", function () {

    var addressSpace, rootFolder, variable;

    before(function (done) {
        addressSpace = new address_space.AddressSpace();
        generate_address_space(addressSpace, nodeset_filename, function () {

            rootFolder = addressSpace.findNode("RootFolder");


            variable = new UAVariable({
                browseName: "some variable",
                addressSpace: addressSpace,
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",
                accessLevel: "CurrentRead | CurrentWrite",
                arrayDimensions: [1, 2, 3],
                dataType: "Double",

                value: new Variant({
                    arrayType: VariantArrayType.Array,
                    dataType: DataType.Double,
                    value: []
                })

            });

            done();
        });
    });
    beforeEach(function (done) {
        var dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: [1, 2, 3, 4, 5, 6]
            }
        });

        variable.writeValue(context, dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
            dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
            done(err);
        });
    });

    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        rootFolder = null;
        variable = null;
        done();
    });

    it("A1 should write an array ", function (done) {

        async.series([

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
                callback(null);
            },

            function (callback) {

                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [2, 3, 4, 5, 6, 7]
                    }
                });

                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([2, 3, 4, 5, 6, 7]));
                callback(null);
            }

        ], done);
    });

    it("A2 should write an portion of an array ", function (done) {

        async.series([

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
                callback(null);
            },

            function (callback) {

                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [500]
                    }
                });

                should(dataValue.value.value instanceof Float64Array).be.eql(true);

                variable.writeValue(context, dataValue, "1", function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1, 500, 3, 4, 5, 6]));
                callback(null);
            }

        ], done);
    });

    it("A3 should write statusCode= GoodClamped and retrieve statusCode GoodClamped", function (done) {

        async.series([

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
                callback(null);
            },
            function (callback) {

                var dataValue = new DataValue({
                    statusCode: StatusCodes.GoodClamped,
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [1, 2, 3, 4, 5, 6]
                    }
                });

                variable.writeValue(context, dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.GoodClamped);
                dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
                callback(null);
            }

        ], done);

    });

    it("A4 should write statusCode= GoodClamped and retrieve statusCode GoodClamped with index range", function (done) {

        async.series([

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
                callback(null);
            },
            function (callback) {

                var dataValue = new DataValue({
                    statusCode: StatusCodes.GoodClamped,
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [200]
                    }
                });

                variable.writeValue(context, dataValue, "1", function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.GoodClamped);
                dataValue_check.value.value.should.eql(new Float64Array([1, 200, 3, 4, 5, 6]));
                callback(null);
            }

        ], done);

    });

    it("A5 should write sourceTimestamp and retrieve sourceTimestamp", function (done) {

        async.series([

            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1, 2, 3, 4, 5, 6]));
                callback(null);
            },
            function (callback) {

                var dataValue = new DataValue({
                    statusCode: StatusCodes.GoodClamped,
                    sourceTimestamp: new Date(1789, 7, 14),
                    sourcePicoseconds: 1234,
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [200]
                    }
                });

                variable.writeValue(context, dataValue, "1", function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            function (callback) {

                var dataValue_check = variable.readAttribute(context, AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.GoodClamped);
                dataValue_check.value.value.should.eql(new Float64Array([1, 200, 3, 4, 5, 6]));
                dataValue_check.sourceTimestamp.should.eql(new Date(1789, 7, 14));
                callback(null);
            }

        ], done);

    });

});


describe("testing Variable#writeValue on Integer", function () {

    var addressSpace, rootFolder, variableInteger, variableInt32;

    before(function (done) {
        addressSpace = new address_space.AddressSpace();
        generate_address_space(addressSpace, nodeset_filename, function () {

            rootFolder = addressSpace.findNode("RootFolder");


            variableInteger = new UAVariable({
                browseName: "some INTEGER Variable",
                addressSpace: addressSpace,
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",
                accessLevel: "CurrentRead | CurrentWrite",
                arrayDimensions: [1, 2, 3],
                dataType: "Integer",

                value: new Variant({
                    dataType: DataType.Integer,
                    value: 1
                })

            });

            variableInt32 = new UAVariable({
                browseName: "some Int32 Variable",
                addressSpace: addressSpace,
                minimumSamplingInterval: 10,
                userAccessLevel: "CurrentRead | CurrentWrite",
                accessLevel: "CurrentRead | CurrentWrite",
                arrayDimensions: [1, 2, 3],
                dataType: "Int32",

                value: new Variant({
                    dataType: DataType.Int32,
                    value: 1
                })

            });

            done();
        });
    });
    beforeEach(function (done) {
        done();
    });

    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    function verify_badtypemismatch(variable, dataType, value, done) {
        // same as CTT test write582err021 Err-011.js
        var dataValue = new DataValue({
            value: {
                dataType: dataType,
                value: value
            }
        });

        variable.writeValue(context, dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.BadTypeMismatch);
            done(err);
        });
    }

    function verify_writeOK(variable, dataType, value, done) {
        // same as CTT test write582err021 Err-011.js
        var dataValue = new DataValue({
            value: {
                dataType: dataType,
                value: value
            }
        });

        variable.writeValue(context, dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });
    }

    it("Z1 should not be possible to write a Byte Value into an integer Variable", function (done) {
        verify_badtypemismatch(variableInteger, DataType.Byte, 36, done);
    });
    it("Z2 should not be possible to write a UInt16 Value into an integer Variable", function (done) {
        verify_badtypemismatch(variableInteger, DataType.UInt16, 36, done);
    });
    it("Z3 should not be possible to write a UInt32 Value into an integer Variable", function (done) {
        verify_badtypemismatch(variableInteger, DataType.UInt32, 36, done);
    });

    it("Z2 should not be possible to write a UInt16 Value into an Integer Variable", function (done) {
        verify_badtypemismatch(variableInteger, DataType.UInt16, 36, done);
    });
    it("Z3 should not be possible to write a UInt64 Value into an integer Variable", function (done) {
        verify_badtypemismatch(variableInteger, DataType.UInt64, 36, done);
    });

    it("Z1 should not be possible to write a Byte Value into an Integer Variable", function (done) {
        verify_badtypemismatch(variableInteger, DataType.Byte, 36, done);
    });


    //xxx it("Z1 should not be possible to write a UInt64 Value into an integer Variable",function(done){
    //xxx     perform_test(DataType.UInt64,36,done);
    //xxx});

    it("Z1 should not be possible to write a Byte Value into an Int32 Variable", function (done) {
        verify_badtypemismatch(variableInt32, DataType.Byte, 36, done);
    });
    it("Z2 should not be possible to write a UInt16 Value into an Int32 Variable", function (done) {
        verify_badtypemismatch(variableInt32, DataType.UInt16, 36, done);
    });
    it("Z3 should not be possible to write a UInt32 Value into an Int32 Variable", function (done) {
        verify_badtypemismatch(variableInt32, DataType.UInt32, 36, done);
    });
    it("Z1 should not be possible to write a SByte Value into an Int32 Variable", function (done) {
        verify_badtypemismatch(variableInt32, DataType.SByte, 36, done);
    });
    it("Z2 should not be possible to write a Int16 Value into an Int32 Variable", function (done) {
        verify_badtypemismatch(variableInt32, DataType.Int16, 36, done);
    });
    it("Z3 should not be possible to write a UInt32 Value into an Int32 Variable", function (done) {
        verify_badtypemismatch(variableInt32, DataType.UInt32, 36, done);
    });

    it("Z3 should  possible to write a Int32 Value into an Int32 Variable", function (done) {
        verify_writeOK(variableInt32, DataType.Int32, 36, done);
    });
});


describe("testing UAVariable ", function () {


    var addressSpace, rootFolder, variableInteger;

    var variable_not_readable;

    before(function (done) {

        addressSpace = new address_space.AddressSpace();
        generate_address_space(addressSpace, nodeset_filename, function (err) {

            if (!err) {
                rootFolder = addressSpace.findNode("RootFolder");

                variableInteger = addressSpace.addVariable({
                    organizedBy: rootFolder,
                    browseName: "some INTEGER Variable",
                    minimumSamplingInterval: 10,
                    userAccessLevel: "CurrentRead | CurrentWrite",
                    accessLevel: "CurrentRead | CurrentWrite",
                    arrayDimensions: [1, 2, 3],
                    dataType: "Integer",
                    value: new Variant({
                        dataType: DataType.Int32,
                        value: 1
                    })
                });

                variable_not_readable = addressSpace.addVariable({
                    organizedBy: rootFolder,
                    browseName: "NotReadableVariable",
                    userAccessLevel: "CurrentWrite",
                    accessLevel: "CurrentWrite",
                    dataType: "Integer",
                    value: new Variant({
                        dataType: DataType.Int32,
                        value: 2
                    })

                });
            }
            done(err);
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });

    it("UAVariable#clone should clone a variable", function () {

        variableInteger.browseName.toString().should.eql("some INTEGER Variable");
        variableInteger._dataValue.value.dataType.should.eql(DataType.Int32);
        variableInteger._dataValue.value.value.should.eql(1);

        var variableIntegerClone = variableInteger.clone();
        variableIntegerClone.nodeId.toString().should.not.eql(variableInteger.nodeId.toString());

        variableIntegerClone.browseName.toString().should.eql("some INTEGER Variable");

        variableIntegerClone._dataValue.value.dataType.should.eql(DataType.Int32);
        variableIntegerClone._dataValue.value.value.should.eql(1);
        variableIntegerClone._dataValue.value.should.eql(variableInteger._dataValue.value);
    });

    it("UAVariable#readValue should return an error if value is not readable", function () {

        variable_not_readable._dataValue.value.dataType.should.eql(DataType.Int32);
        variable_not_readable._dataValue.value.value.should.eql(2);
        variable_not_readable._dataValue.statusCode.should.eql(StatusCodes.Good);

        var dataValue = variable_not_readable.readValue();
        dataValue.statusCode.should.eql(StatusCodes.BadNotReadable);
        should(dataValue.value).eql(null);
        should(dataValue.serverTimestamp).eql(null);
        should(dataValue.sourceTimestamp).eql(null);
    });

    it("UAVariable#readValueAsync should return an error if value is not readable", function (done) {

        variable_not_readable._dataValue.value.dataType.should.eql(DataType.Int32);
        variable_not_readable._dataValue.value.value.should.eql(2);
        variable_not_readable._dataValue.statusCode.should.eql(StatusCodes.Good);

        variable_not_readable.readValueAsync(context, function (err, dataValue) {
            dataValue.statusCode.should.eql(StatusCodes.BadNotReadable);
            should(dataValue.value).eql(null);
            should(dataValue.serverTimestamp).eql(null);
            should(dataValue.sourceTimestamp).eql(null);
            done();
        });
    });

    it("UAVariable#readValueAsync should cope with faulty refreshFunc -- calling callback with an error", function (done) {

        rootFolder = addressSpace.findNode("RootFolder");
        var temperatureVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "BadVar",
            nodeId: "ns=1;s=BadVar",
            dataType: "Double",

            value: {
                refreshFunc: function (callback) {

                    var temperature = 20 + 10 * Math.sin(Date.now() / 10000);
                    var value = new Variant({dataType: DataType.Double, value: temperature});
                    var sourceTimestamp = new Date();
                    // simulate a asynchronous behaviour
                    setTimeout(function () {
                        callback(new Error("Something goes wrong here"));
                    }, 100);
                }
            }
        });
        temperatureVar.readValueAsync(context, function (err, value) {
            should.exist(err);
            console.log("err=", err);
            done();
        });
    });

    it("UAVariable#readValueAsync should cope with faulty refreshFunc - crashing inside refreshFunc", function (done) {

        rootFolder = addressSpace.findNode("RootFolder");
        var temperatureVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "BadVar2",
            nodeId: "ns=1;s=BadVar2",
            dataType: "Double",
            value: {
                refreshFunc: function (callback) {
                    throw new Error("Something goes wrong here");
                }
            }
        });
        temperatureVar.readValueAsync(context, function (err, value) {
            should.exist(err);
            console.log("err=", err);
            done();
        });

    });

    it("UAVariable#readValueAsync  should be reentrant", function (done) {
        rootFolder = addressSpace.findNode("RootFolder");
        var temperatureVar = addressSpace.addVariable({
            organizedBy: rootFolder,
            browseName: "Temperature",
            nodeId: "ns=1;s=Temperature",
            dataType: "Double",

            value: {
                refreshFunc: function (callback) {

                    var temperature = 20 + 10 * Math.sin(Date.now() / 10000);
                    var value = new Variant({dataType: DataType.Double, value: temperature});
                    var sourceTimestamp = new Date();
                    // simulate a asynchronous behaviour
                    setTimeout(function () {
                        callback(null, new DataValue({value: value, sourceTimestamp: sourceTimestamp}));
                    }, 100);
                }
            }
        });

        var counter = 0;
        var refValue = 0;

        function my_callback(err, value) {
            should(err).eql(null);
            counter = counter + 1;
            if (counter === 1) {
                refValue = value;
            } else {
                refValue.should.eql(value);
            }
            if (counter === 4) {
                done();
            }
        }

        // calling 4 times readValueAsync in parallel should cause the callback
        temperatureVar.readValueAsync(context, my_callback);
        temperatureVar.readValueAsync(context, my_callback);
        temperatureVar.readValueAsync(context, my_callback);
        temperatureVar.readValueAsync(context, my_callback);


    });

    it("UAVariable#writeAttribute ", function (done) {
        var write_service = require("node-opcua-service-write");
        var WriteValue = write_service.WriteValue;

        var v = new WriteValue({
            attributeId: AttributeIds.Description,
            value: {value: {dataType: DataType.String, value: "New Description"}}
        });
        variableInteger.writeAttribute(context, v, function (err, statusCode) {
            should(err).eql(null);
            done(err);
        });

    });

    it("UAVariable#setValueFromSource should cause 'value_changed' event to be raised", function (done) {

        var objectsFolder = addressSpace.findNode("ObjectsFolder");

        var temperatureVar = addressSpace.addVariable({
            organizedBy: objectsFolder,
            browseName: "Testing#setValueFromSource",
            dataType: "Double",
            value: {
                dataType: DataType.Double,
                value: 0.0
            }
        });
        temperatureVar.minimumSamplingInterval.should.eql(0);

        var changeDetected = 0;
        temperatureVar.on("value_changed", function (dataValue) {
            changeDetected += 1;
        });

        function wait_a_little_bit(callback) {
            setTimeout(callback, 100);
        }

        async.series([
            function (callback) {
                temperatureVar.setValueFromSource({dataType: DataType.Double, value: 3.14}, StatusCodes.Good);
                changeDetected.should.equal(1);

                callback();
            },
            wait_a_little_bit,

            function (callback) {
                // calling setValueFromSource with same variant will cause change event, as in fact timestamps are also updated
                temperatureVar.setValueFromSource({dataType: DataType.Double, value: 3.14}, StatusCodes.Good);
                changeDetected.should.equal(2);
                callback();


            },

            wait_a_little_bit,

            function (callback) {
                temperatureVar.setValueFromSource({dataType: DataType.Double, value: 6.28}, StatusCodes.Good);
                changeDetected.should.equal(3);
                callback();
            }

        ], done);

    });
});



