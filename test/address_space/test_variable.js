require("requirish")._(module);

var address_space = require("lib/address_space/address_space");
var Variable = require("lib/address_space/variable").Variable;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var should = require("should");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var _ = require("underscore");

describe("testing Variables ",function(){

    it("a variable should return attributes with  the expected data type ",function(){

        var the_address_space = new address_space.AddressSpace();

        var v = new Variable({
            browseName: "some variable",
            address_space:the_address_space,
            minimumSamplingInterval: 10,
            userAccessLevel: 0,
            arrayDimensions : [ 1,2,3],
            accessLevel: 0
        });

        var value ;

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
        value.value.value.should.eql([1,2,3]);
        (_.isArray(value.value.value)).should.eql(true);
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
describe("Address Space : add Variable :  testing various variations for specifying dataType",function() {

    var nodeset_filename = __dirname+ "/../../lib/server/mini.Node.Set2.xml";
    var the_address_space = new address_space.AddressSpace();
    var rootFolder ;
    before(function(done){
        generate_address_space(the_address_space, nodeset_filename,function(){

            rootFolder = the_address_space.findObject("RootFolder");

            done();
        });
    });
    after(function(){});

    it("addVariable should accept a dataType as String",function() {

        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable1",
            dataType: "ImagePNG"
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");
    });
    it("addVariable should accept a dataType as DataTypeId value",function() {

        var DataTypeIds = require("lib/opcua_node_ids").DataTypeIds;

        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable2",
            dataType: DataTypeIds.ImagePNG
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("addVariable should accept a dataType as a NodeId object",function() {


        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable3",
            dataType: makeNodeId(2003,0)
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });
    it("addVariable should accept a dataType as a NodeId string",function() {

        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable4",
            dataType: "ns=0;i=2003"
        });
        nodeVar.dataType.should.be.instanceOf(NodeId);
        nodeVar.dataType.toString().should.eql("ns=0;i=2003");

    });





    it("addVariable should accept a typeDefinition as a String",function() {

        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable5",
            dataType: "Double",
            typeDefinition: "PropertyType"
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");

    });

    it("addVariable should accept a typeDefinition as a VariableTypeId value",function() {

        var VariableTypeIds = require("lib/opcua_node_ids").VariableTypeIds;

        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable6",
            dataType: "Double",
            typeDefinition: VariableTypeIds.PropertyType
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");

    });
    it("addVariable should accept a typeDefinition as a NodeId object",function() {
        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable7",
            dataType: "Double",
            typeDefinition: makeNodeId(68)
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");
    });
    it("addVariable should accept a typeDefinition as a NodeId string",function() {
        var nodeVar = the_address_space.addVariable(rootFolder,{
            browseName: "SomeVariable8",
            dataType: "Double",
            typeDefinition: "ns=0;i=68"
        });
        nodeVar.hasTypeDefinition.should.be.instanceOf(NodeId);
        nodeVar.hasTypeDefinition.toString().should.eql("ns=0;i=68");
    });
    it("addVariable should throw if typeDefinition is invalid",function() {
        should(function(){
            var nodeVar = the_address_space.addVariable(rootFolder,{
                browseName: "SomeVariable9",
                dataType: "Double",
                typeDefinition: "ns=0;i=2003" // << 2003 is a DataType not a VariableType
            });
        }).throwError();
    });

});
