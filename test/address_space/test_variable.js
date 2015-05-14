require("requirish")._(module);

var async = require("async");
var address_space = require("lib/address_space/address_space");
var Variable = require("lib/address_space/variable").Variable;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var should = require("should");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var _ = require("underscore");
var NumericRange = require("lib/datamodel/numeric_range").NumericRange;

var nodeset_filename = __dirname + "/../../lib/server/mini.Node.Set2.xml";

describe("testing Variables ", function () {

    it("a variable should return attributes with  the expected data type ", function () {

        var the_address_space = new address_space.AddressSpace();

        var v = new Variable({
            browseName: "some variable",
            address_space: the_address_space,
            minimumSamplingInterval: 10,
            userAccessLevel: 0,
            arrayDimensions: [1, 2, 3],
            accessLevel: 0
        });

        var value;

        value = v.readAttribute(AttributeIds.AccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.UserAccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.ValueRank);
        value.value.dataType.should.eql(DataType.Int32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.ArrayDimensions);
        value.value.arrayType.should.eql(VariantArrayType.Array);
        value.value.value.should.eql(new Uint32Array([1, 2, 3]));
        (value.value.value instanceof Uint32Array).should.eql(true);
        value.value.dataType.should.eql(DataType.UInt32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.Historizing);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.BrowseName);
        value.value.dataType.should.eql(DataType.QualifiedName);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.DisplayName);
        value.value.dataType.should.eql(DataType.LocalizedText);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.MinimumSamplingInterval);
        value.value.dataType.should.eql(DataType.Int32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.IsAbstract);
        value.statusCode.name.should.eql("BadAttributeIdInvalid");

        value = v.readAttribute(AttributeIds.NodeClass);
        value.value.dataType.should.eql(DataType.Int32);
        value.value.value.should.eql(NodeClass.Variable.value);
        value.statusCode.should.eql(StatusCodes.Good);

    });


});

var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;

describe("Address Space : add Variable :  testing various variations for specifying dataType", function () {

    var the_address_space = new address_space.AddressSpace();
    var rootFolder;
    before(function (done) {
        generate_address_space(the_address_space, nodeset_filename, function () {

            rootFolder = the_address_space.findObject("RootFolder");

            done();
        });
    });
    after(function () {
    });

    it("addVariable should accept a dataType as String", function () {

        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable1",
            dataType: "ImagePNG"
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });
    it("addVariable should accept a dataType as DataTypeId value", function () {

        var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;

        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable2",
            dataType: DataTypeIds.ImagePNG
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("addVariable should accept a dataType as a NodeId object", function () {


        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable3",
            dataType: makeNodeId(2003, 0)
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("addVariable should accept a dataType as a NodeId string", function () {

        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable4",
            dataType: "ns=0;i=2003"
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });


    it("addVariable should accept a typeDefinition as a String", function () {

        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable5",
            dataType: "Double",
            typeDefinition: "PropertyType"
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");

    });

    it("addVariable should accept a typeDefinition as a VariableTypeId value", function () {

        var VariableTypeIds = require("lib/opcua_node_ids").VariableTypeIds;

        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable6",
            dataType: "Double",
            typeDefinition: VariableTypeIds.PropertyType
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");

    });
    it("addVariable should accept a typeDefinition as a NodeId object", function () {
        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable7",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");
    });
    it("addVariable should accept a typeDefinition as a NodeId string", function () {
        var nodeVar = the_address_space.addVariable(rootFolder, {
            browseName: "SomeVariable8",
            dataType: "Double",
            typeDefinition: "ns=0;i=68"
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");
    });
    it("addVariable should throw if typeDefinition is invalid", function () {
        should(function () {
            var nodeVar = the_address_space.addVariable(rootFolder, {
                browseName: "SomeVariable9",
                dataType: "Double",
                typeDefinition: "ns=0;i=2003" // << 2003 is a DataType not a VariableType
            });
        }).throwError();
    });

});

describe("testing Variable#bindVariable", function () {

    var the_address_space, rootFolder;
    before(function (done) {
        the_address_space = new address_space.AddressSpace();
        generate_address_space(the_address_space, nodeset_filename, function () {

            rootFolder = the_address_space.findObject("RootFolder");

            done();
        });
    });
    after(function () {
        the_address_space = null;
        rootFolder = null;
    });

    describe("testing Variable#bindVariable -> Getter", function () {

        it("T1 should create a static read only variable ( static value defined at construction time)", function (done) {

            var variable = the_address_space.addVariable(rootFolder, {
                browseName: "SomeVariableT1",
                dataType: "Double",
                typeDefinition: makeNodeId(68),
                value: {
                    dataType: DataType.Double,
                    value: 5678
                },
                accessLevel: "CurrentRead"
            });
            variable.isWritable().should.eql(false);
            (typeof variable.asyncRefresh).should.eql("undefined");

            async.series([
                function read_simple_value(callback) {

                    var dataValue_check = variable.readAttribute(AttributeIds.Value);
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

                    variable.writeValue(dataValue, function (err, statusCode) {
                        statusCode.should.eql(StatusCodes.BadNotWritable);
                        callback(err);
                    });
                },
                function read_simple_value(callback) {

                    var dataValue_check = variable.readAttribute(AttributeIds.Value);
                    dataValue_check.should.be.instanceOf(DataValue);
                    dataValue_check.value.value.should.eql(5678);

                    callback(null);
                }
            ], done);

        });

        it("T2 should create a variable with synchronous get and set functor", function (done) {

            var variable = the_address_space.addVariable(rootFolder, {
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
                    variable.readValueAsync(function(err){
                        if (!err) {
                            var dataValue_check = variable.readAttribute(AttributeIds.Value);
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

                    variable.writeValue(dataValue, function (err, statusCode) {
                        statusCode.should.eql(StatusCodes.Good);
                        value.should.eql(200);
                        callback(err);
                    });
                },
                function read_simple_value(callback) {

                    var dataValue_check = variable.readAttribute(AttributeIds.Value);
                    dataValue_check.should.be.instanceOf(DataValue);
                    dataValue_check.value.value.should.eql(200);

                    callback(null);
                }
            ], done);

        });

        it("T3 should create a read only variable with a timestamped_get", function (done) {

            var variable = the_address_space.addVariable(rootFolder, {
                browseName: "SomeVariableT3",
                dataType: "Double",
                typeDefinition: makeNodeId(68)
            });

            var value_with_timestamp = new DataValue({
                value: new Variant({dataType: DataType.Double, value: 987654.0}),
                sourceTimestamp: new Date(1789,7,14),
                sourcePicoseconds: 0
            });
            var counter = 0;
            var options = {
                timestamped_get: function () {
                    counter = counter+1;
                    return value_with_timestamp;
                }
            };
            variable.bindVariable(options);

            // xx (_.isFunction(variable.asyncRefresh)).should.be(true);

            async.series([
                function read_simple_value(callback) {

                    counter = 0;
                    variable.readValueAsync(function(err,dataValue_check){
                        counter.should.eql(1,"expecting timestamped_get to have been called");
                        if (!err) {
                            dataValue_check.should.be.instanceOf(DataValue);
                            dataValue_check.statusCode.should.eql(StatusCodes.Good);
                            dataValue_check.value.value.should.eql(987654);
                            dataValue_check.sourceTimestamp.should.eql(new Date(1789,7,14));
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
                    variable.writeValue(dataValue, function (err, statusCode) {
                        statusCode.should.eql(StatusCodes.BadNotWritable);
                        callback(err);
                    });
                },
                function read_simple_value(callback) {

                    variable.readValueAsync(function(err,dataValue_check){
                        if(!err) {
                            dataValue_check.should.be.instanceOf(DataValue);
                            dataValue_check.value.value.should.eql(987654);
                            dataValue_check.sourceTimestamp.should.eql(new Date(1789,7,14));
                        }
                        callback(err);
                    });

                }
            ], done);

        });

        it("T4 should create a read only variable with a refreshFunc", function (done) {

            var variable = the_address_space.addVariable(rootFolder, {
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
                        callback(null,dataValue);
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
    });

    function read_double_and_check(variable,expected_value,expected_date,callback) {

        variable.readValueAsync(function(err,dataValue_check){
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

    describe("testing Variable#bindVariable -> Setter",function() {

        it("Q1 should create a variable with a sync  setter",function(done) {

            var variable = the_address_space.addVariable(rootFolder, {
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
                get: function() { return value_with_timestamp.value; },
                set: function (value) {
                    value_with_timestamp.value = value;
                    return StatusCodes.Good;
                }
            };
            variable.bindVariable(options);

            async.series([

                read_double_and_check.bind(null,variable,100,null),

                function write_simple_value(callback) {
                    var dataValue = new DataValue({
                        value: {
                            dataType: DataType.Double,
                            value: 200
                        }
                    });
                    variable.writeValue(dataValue, function (err, statusCode) {
                        statusCode.should.eql(StatusCodes.Good);
                        callback(err);
                    });
                },
                read_double_and_check.bind(null,variable,200,null)
            ], done);
        });

        it("Q2 should create a variable with a async  setter",function(done) {

            var variable = the_address_space.addVariable(rootFolder, {
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
                get: function() { return value_with_timestamp.value; },
                set: function (value,callback) {
                    setTimeout(function() {
                        value_with_timestamp.value = value;
                        callback(null,StatusCodes.Good);
                    },10);
                }
            };
            variable.bindVariable(options);

            async.series([

                read_double_and_check.bind(null,variable,100,null),

                function write_simple_value(callback) {
                    var dataValue = new DataValue({
                        value: {
                            dataType: DataType.Double,
                            value: 200
                        }
                    });
                    variable.writeValue(dataValue,null,  function (err,statusCode) {
                        statusCode.should.eql(StatusCodes.Good);
                        callback(err);
                    });
                },
                read_double_and_check.bind(null,variable,200,null)
            ], done);
        });

        it("Q3 should create a variable with a sync timestamped setter",function(done) {

            var variable = the_address_space.addVariable(rootFolder, {
                browseName: "SomeVariableQ1",
                dataType: "Double",
                typeDefinition: makeNodeId(68)
            });

            var value_with_timestamp = new DataValue({
                value: new Variant({dataType: DataType.Double, value: 100}),
                sourceTimestamp: new Date(1999,9,9),
                sourcePicoseconds: 100
            });
            var options = {
                timestamped_get: function() {
                    return value_with_timestamp;
                },
                timestamped_set: function (ts_value,callback) {
                    value_with_timestamp.value = ts_value.value;
                    value_with_timestamp.sourceTimestamp = ts_value.sourceTimestamp;
                    value_with_timestamp.sourcePicoseconds= ts_value.sourcePicoseconds;
                    callback(null,StatusCodes.Good);
                }
            };
            variable.bindVariable(options);

            var expected_date1= new Date(1999,9,9);
            var expected_date2= new Date(2010,9,9);
            async.series([

                read_double_and_check.bind(null,variable,100,expected_date1),

                function write_simple_value(callback) {
                    var dataValue = new DataValue({
                        sourceTimestamp: expected_date2,
                        value: {
                            dataType: DataType.Double,
                            value: 200
                        }
                    });
                    variable.writeValue(dataValue, function (err, statusCode) {
                        statusCode.should.eql(StatusCodes.Good);
                        callback(err);
                    });
                },

                read_double_and_check.bind(null,variable,200,expected_date2)
            ], done);
        });

    });



});


describe("testing Variable#writeValue Scalar",function() {

    var the_address_space, rootFolder,variable;

    before(function (done) {

        the_address_space = new address_space.AddressSpace();
        generate_address_space(the_address_space, nodeset_filename, function () {

            rootFolder = the_address_space.findObject("RootFolder");

            variable = new Variable({
                browseName: "some variable",
                address_space: the_address_space,
                minimumSamplingInterval: 10,
                userAccessLevel: 0,
                accessLevel: 0,
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
    beforeEach(function(done){

        var dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                arrayType: VariantArrayType.Scalar,
                value: 10.0
            }
        });

        variable.writeValue(dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            var dataValue_check = variable.readAttribute(AttributeIds.Value);
            dataValue_check.value.value.should.eql(10.0);
            done(err);
        });
    });

    after(function () {
        the_address_space = null;
        rootFolder = null;
    });

    it("should write a double in a Duration ",function(done){

        var dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                arrayType: VariantArrayType.Scalar,
                value: 12.0
            }
        });
        variable.writeValue(dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            var dataValue_check = variable.readAttribute(AttributeIds.Value);
            dataValue_check.value.value.should.eql(12.0);
            done(err);
        });
    })

});

describe("testing Variable#writeValue Array",function(){

    var the_address_space, rootFolder,variable;

    before(function (done) {
        the_address_space = new address_space.AddressSpace();
        generate_address_space(the_address_space, nodeset_filename, function () {

            rootFolder = the_address_space.findObject("RootFolder");


            variable = new Variable({
                browseName: "some variable",
                address_space: the_address_space,
                minimumSamplingInterval: 10,
                userAccessLevel: 0,
                arrayDimensions: [1, 2, 3],
                accessLevel: 0,
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
    beforeEach(function(done){
        var dataValue = new DataValue({
            value: {
                dataType: DataType.Double,
                arrayType: VariantArrayType.Array,
                value: [ 1,2,3,4,5,6]
            }
        });

        variable.writeValue(dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            var dataValue_check = variable.readAttribute(AttributeIds.Value);
            dataValue_check.value.value.should.eql(new Float64Array([ 1,2,3,4,5,6]));
            done(err);
        });
    });

    after(function () {
        the_address_space = null;
        rootFolder = null;
    });

     it("A1 should write an array ",function(done) {

        async.series([

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1,2,3,4,5,6]));
                callback(null);
            },

            function (callback) {

                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [ 2,3,4,5,6,7]
                    }
                });

                variable.writeValue(dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([2,3,4,5,6,7]));
                callback(null);
            }

        ],done);
    });

    it("A2 should write an portion of an array ",function(done) {

        async.series([

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1,2,3,4,5,6]));
                callback(null);
            },

            function (callback) {

                var dataValue = new DataValue({
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [ 500 ]
                    }
                });

                should(dataValue.value.value instanceof Float64Array).be.eql(true);

                variable.writeValue(dataValue, "1", function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1,500,3,4,5,6]));
                callback(null);
            }

        ],done);
    });

    it("A3 should write statusCode= GoodClamped and retrieve statusCode GoodClamped",function(done){

        async.series([

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1,2,3,4,5,6]));
                callback(null);
            },
            function (callback) {

                var dataValue = new DataValue({
                    statusCode: StatusCodes.GoodClamped,
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [1,2,3,4,5,6]
                    }
                });

                variable.writeValue(dataValue, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.GoodClamped);
                dataValue_check.value.value.should.eql(new Float64Array([1,2,3,4,5,6]));
                callback(null);
            }

        ],done);

    });
    it("A4 should write statusCode= GoodClamped and retrieve statusCode GoodClamped with index range",function(done){

        async.series([

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1,2,3,4,5,6]));
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

                variable.writeValue(dataValue, "1", function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.GoodClamped);
                dataValue_check.value.value.should.eql(new Float64Array([1,200,3,4,5,6]));
                callback(null);
            }

        ],done);

    });
    it("should write sourceTimestamp and retrieve sourceTimestamp",function(done){

        async.series([

            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.Good);
                dataValue_check.value.value.should.eql(new Float64Array([1,2,3,4,5,6]));
                callback(null);
            },
            function (callback) {

                var dataValue = new DataValue({
                    statusCode: StatusCodes.GoodClamped,
                    sourceTimestamp: new Date(1789,7,14),
                    sourcePicoseconds: 1234,
                    value: {
                        dataType: DataType.Double,
                        arrayType: VariantArrayType.Array,
                        value: [200]
                    }
                });

                variable.writeValue(dataValue, "1", function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    callback(err);
                });
            },
            function(callback) {

                var dataValue_check = variable.readAttribute(AttributeIds.Value);
                dataValue_check.should.be.instanceOf(DataValue);
                dataValue_check.statusCode.should.eql(StatusCodes.GoodClamped);
                dataValue_check.value.value.should.eql(new Float64Array([1,200,3,4,5,6]));
                dataValue_check.sourceTimestamp.should.eql(new Date(1789,7,14));
                callback(null);
            }

        ],done);

    });


});



describe("testing Variable#writeValue on Integer",function() {

    var the_address_space, rootFolder, variableInteger, variableInt32;

    before(function (done) {
        the_address_space = new address_space.AddressSpace();
        generate_address_space(the_address_space, nodeset_filename, function () {

            rootFolder = the_address_space.findObject("RootFolder");


            variableInteger = new Variable({
                browseName: "some INTEGER Variable",
                address_space: the_address_space,
                minimumSamplingInterval: 10,
                userAccessLevel: 0,
                arrayDimensions: [1, 2, 3],
                accessLevel: 0,
                dataType: "Integer",

                value: new Variant({
                    dataType: DataType.Integer,
                    value: 1
                })

            });

            variableInt32 = new Variable({
                browseName: "some Int32 Variable",
                address_space: the_address_space,
                minimumSamplingInterval: 10,
                userAccessLevel: 0,
                arrayDimensions: [1, 2, 3],
                accessLevel: 0,
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

    after(function () {
        the_address_space = null;
        rootFolder = null;
    });


    function verify_badtypemismatch(variable,dataType,value,done) {
        // same as CTT test write582err021 Err-011.js
        var dataValue = new DataValue({
            value: {
                dataType: dataType,
                value: value
            }
        });

        variable.writeValue(dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.BadTypeMismatch);
            done(err);
        });
    }
    function verify_writeOK(variable,dataType,value,done) {
        // same as CTT test write582err021 Err-011.js
        var dataValue = new DataValue({
            value: {
                dataType: dataType,
                value: value
            }
        });

        variable.writeValue(dataValue, function (err, statusCode) {
            statusCode.should.eql(StatusCodes.Good);
            done(err);
        });
    }
    it("Z1 should not be possible to write a Byte Value into an integer Variable",function(done){
        verify_badtypemismatch(variableInteger,DataType.Byte,36,done);
    });
    it("Z2 should not be possible to write a UInt16 Value into an integer Variable",function(done){
        verify_badtypemismatch(variableInteger,DataType.UInt16,36,done);
    });
    it("Z3 should not be possible to write a UInt32 Value into an integer Variable",function(done){
        verify_badtypemismatch(variableInteger,DataType.UInt32,36,done);
    });

    it("Z2 should not be possible to write a UInt16 Value into an Integer Variable",function(done){
        verify_badtypemismatch(variableInteger,DataType.UInt16,36,done);
    });
    it("Z3 should not be possible to write a UInt64 Value into an integer Variable",function(done){
        verify_badtypemismatch(variableInteger,DataType.UInt64,36,done);
    });

    it("Z1 should not be possible to write a Byte Value into an Integer Variable",function(done){
        verify_badtypemismatch(variableInteger,DataType.Byte,36,done);
    });


    //xxx it("Z1 should not be possible to write a UInt64 Value into an integer Variable",function(done){
    //xxx     perform_test(DataType.UInt64,36,done);
    //xxx});

    it("Z1 should not be possible to write a Byte Value into an Int32 Variable",function(done){
        verify_badtypemismatch(variableInt32,DataType.Byte,36,done);
    });
    it("Z2 should not be possible to write a UInt16 Value into an Int32 Variable",function(done){
        verify_badtypemismatch(variableInt32,DataType.UInt16,36,done);
    });
    it("Z3 should not be possible to write a UInt32 Value into an Int32 Variable",function(done){
        verify_badtypemismatch(variableInt32,DataType.UInt32,36,done);
    });
    it("Z1 should not be possible to write a SByte Value into an Int32 Variable",function(done){
        verify_badtypemismatch(variableInt32,DataType.SByte,36,done);
    });
    it("Z2 should not be possible to write a Int16 Value into an Int32 Variable",function(done){
        verify_badtypemismatch(variableInt32,DataType.Int16,36,done);
    });
    it("Z3 should not be possible to write a UInt32 Value into an Int32 Variable",function(done){
        verify_badtypemismatch(variableInt32,DataType.UInt32,36,done);
    });

    it("Z3 should  possible to write a Int32 Value into an Int32 Variable",function(done){
        verify_writeOK(variableInt32,DataType.Int32,36,done);
    });
});
