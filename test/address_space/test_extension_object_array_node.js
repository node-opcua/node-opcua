"use strict";
/* global describe,it,before*/
require("requirish")._(module);
var should = require("should");
var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var _ = require("underscore");
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;


var path = require("path");


describe("Extension Object Array Node",function() {


    var address_space;

    before(function(done){

        address_space = new AddressSpace();

        var xml_file = path.join(__dirname,"../../lib/server/mini.Node.Set2.xml");
        require("fs").existsSync(xml_file).should.be.eql(true);

        generate_address_space(address_space, xml_file, function (err) {
            done(err);
        });
    });


    var assert = require("assert");
    var UADataType = require("lib/address_space/ua_data_type").UADataType;
    var UAObject = require("lib/address_space/ua_object").UAObject;
    var UAVariable = require("lib/address_space/ua_variable").UAVariable;
    var Variant = require("lib/datamodel/variant").Variant;
    var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;

    var SubscriptionDiagnostics = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/SubscriptionDiagnostics").SubscriptionDiagnostics;

    /**
     *
     * @param addressSpace
     * @param options
     * @param options.dataType : the type of extension Array
     * @param options.browseName : the browseName
     */
    function addExtArrayVariable(addressSpace,parent,options) {

        assert(parent instanceof UAObject);
        assert(typeof options.browseName === "string");
        assert(options.dataType instanceof NodeId);
        assert(addressSpace.findDataType(options.dataType),"must have a existing dataType");

        var variable = addressSpace.addVariable(parent,options);

        return variable;
    }

    function createExtObjArrayNode(parentFolder,variableType,indexPropertyName) {

        assert(typeof indexPropertyName === "string");

        var address_space = parentFolder.__address_space;
        assert(address_space instanceof AddressSpace);

        var structure = address_space.findDataType("Structure");
        assert(structure,"Structure Type not found: please check your nodeset file");

        var variableType = address_space.findVariableType(variableType);
        assert(!variableType.nodeId.isEmpty());

        var dataType = address_space.findDataType(variableType.dataType);
        assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

        var arr = addExtArrayVariable(address_space,parentFolder,{
            browseName: "myArray",
            dataType: dataType.nodeId,
            valueRank: 1,
            typeDefinition: variableType.nodeId,
            value: { dataType: DataType.ExtensionObject, value: [], arrayType: VariantArrayType.Array }
        });

        arr.should.be.instanceOf(UAVariable);

        arr.$$variableType = variableType;

        arr.$$getElementBrowseName = function(extObj) {
            //ww assert(extObj.constructor === address_space.constructExtensionObject(dataType));
            assert(extObj.hasOwnProperty(indexPropertyName));
            return extObj[indexPropertyName].toString();
        };
        // variableType must exist
        // variableType must have a dataType which is a structure
        return arr;

    }
    function addElement(options,arr) {
        var address_space = arr.__address_space;

        // verify that arr has been created correctly
        assert( !!arr.$$variableType, "did you create the array Node with createExtObjArrayNode ?");
        var variableType = arr.$$variableType;

        // verify that an object with same doesn't already exist
        var structure = address_space.findDataType("Structure");
        assert(structure,"Structure Type not found: please check your nodeset file");

        var dataType = address_space.findDataType(variableType.dataType);
        assert(dataType.isSupertypeOf(structure), "expecting a structure (= ExtensionObject) here ");

        var obj =  address_space.constructExtensionObject(dataType,options);

        var browseName = arr.$$getElementBrowseName(obj);
        variableType.dataType.toString().should.eql(dataType.nodeId.toString());

        var elVar = variableType.instantiate({
            componentOf: arr.nodeId,
            browseName: browseName,
            value: { dataType: DataType.ExtensionObject, value: obj }
        });
        elVar.bindExtensionObject();

        // also add the value inside
        arr._dataValue.value.value.push(obj);
        return elVar;
    }

    function removeElement(arr,elementIndex) {
        var address_space = arr.__address_space;
        var _array = arr.readValue().value.value;
        if(_.isNumber(elementIndex)) {
            assert(elementIndex >= 0 && elementIndex < _array.length);
        } else {
            // find element by name
            // var browseNameToFind = arr.$$getElementBrowseName(elementIndex);
            var browseNameToFind = elementIndex.browseName.toString();

            var elementIndex =_array.findIndex(function(obj,i){
                var browseName = arr.$$getElementBrowseName(obj);
                return (browseName === browseNameToFind);
            });
            if (elementIndex<0) {
                throw new Error(" cannot find element matching "+ browseNameToFind.toString());
            }
        }
        var extObj = _array[elementIndex];
        var browseName = arr.$$getElementBrowseName(extObj);

        // remove element from global array (inefficient)
        _array.splice(elementIndex,1);

        // remove matching component

        var nodeId = 0;
        var node = arr.getComponentByName(browseName);

        if (!node) {
            throw new Error(" cannot find component ");
        }

        address_space.deleteObject(node.nodeId);

    }

    it("should create a Variable that expose an array of ExtensionObject of a specific type",function(done) {

        // given a address space
        // give a DataType

        var rootFolder = address_space.findObject("RootFolder");


        var arr = createExtObjArrayNode(rootFolder,"SubscriptionDiagnosticsType","subscriptionId");


        address_space.findObject(arr.dataType).should.be.instanceOf(UADataType);
        var variableType = address_space.findVariableType("SubscriptionDiagnosticsType");
        arr.hasTypeDefinition.toString().should.eql(variableType.nodeId.toString());

        var dv  = arr.readValue();
        should(dv.value.value).eql([]);
        dv.value.value.should.be.instanceOf(Array);
        dv.value.value.length.should.eql(0);

        var counter = 10;
        // now add a new object
        var options  = {
            subscriptionId: counter
        };


        arr.readValue().value.value.length.should.eql(0, "expecting no element in array");


        var elVar = addElement(options,arr);


        arr.readValue().value.value.length.should.eql(1, "expecting a new element in array");
        elVar.browseName.toString().should.eql("10");
        elVar.subscriptionId.should.be.instanceOf(UAVariable);
        elVar.readValue().value.value.should.be.instanceOf(SubscriptionDiagnostics);
        elVar.readValue().value.should.be.instanceOf(Variant);


        // verify that object is now bond, by modifying a value of a property of  the underlying data structure
        // and checking that the corresponding node has changed.
        var obj = arr.readValue().value.value[0];
        obj.maxLifetimeCount = 12345;

        elVar.maxLifetimeCount.readValue().value.value.should.eql(12345);
        elVar.readValue().value.value.maxLifetimeCount.should.eql(12345);

        done();

    });

    it("should be possible to add more than one element in the Extension Object variable node",function() {

        var rootFolder = address_space.findObject("RootFolder");

        var arr = createExtObjArrayNode(rootFolder,"SubscriptionDiagnosticsType","subscriptionId");

        var elVar1 = addElement({subscriptionId: 1000},arr);
        var elVar2 = addElement({subscriptionId: 1001},arr);
        var elVar3 = addElement({subscriptionId: 1002},arr);

        elVar1.browseName.toString().should.eql("1000");
        elVar2.browseName.toString().should.eql("1001");
        elVar3.browseName.toString().should.eql("1002");

        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

    });
    it("should be possible to remove some element in the Extension Object variable node",function() {

        var rootFolder = address_space.findObject("RootFolder");

        var arr = createExtObjArrayNode(rootFolder,"SubscriptionDiagnosticsType","subscriptionId");

        var elVar1 = addElement({subscriptionId: 1000},arr);
        var elVar2 = addElement({subscriptionId: 1001},arr);
        var elVar3 = addElement({subscriptionId: 1002},arr);
        var elVar4 = addElement({subscriptionId: 1003},arr);
        arr.readValue().value.value.length.should.eql(4, "expecting 4 elements in array");


        removeElement(arr,elVar1);
        arr.readValue().value.value.length.should.eql(3, "expecting 3 elements in array");

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1002);
        arr.readValue().value.value[2].subscriptionId.should.eql(1003);

        should(arr.getComponentByName("1002")).not.eql(null);

        removeElement(arr,1); // at pos 1

        arr.readValue().value.value[0].subscriptionId.should.eql(1001);
        arr.readValue().value.value[1].subscriptionId.should.eql(1003);

        should(arr.getComponentByName("1002")).eql(null);
        should(arr.getComponentByName("1000")).eql(null);


    });


});
