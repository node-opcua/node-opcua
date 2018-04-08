"use strict";
/* global describe,it,before*/

const should = require("should");

const AddressSpace = require("..").AddressSpace;
const fs = require("fs");

const generate_address_space = require("..").generate_address_space;
const nodesets = require("node-opcua-nodesets");

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Issue 162 : demonstrate how to modify an instantiate object variable", function () {

    this.timeout(Math.max(300000, this._timeout));

    let addressSpace;

    before(function (done) {
        addressSpace = new AddressSpace();

        const xml_file = nodesets.standard_nodeset_file;

        fs.existsSync(xml_file).should.be.eql(true);

        generate_address_space(addressSpace, xml_file, function (err) {
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

    function findOrCreateCustomObjectType(addressSpace) {

        let myCustomObjectType = addressSpace.findObjectType("MyCustomObjectType");

        if (!myCustomObjectType) {
            myCustomObjectType = addressSpace.addObjectType({
                browseName: "MyCustomObjectType"
            });
            const myCustomProperty = addressSpace.addVariable({
                propertyOf: myCustomObjectType,
                browseName: "CustomProperty",
                description: "Descr",
                dataType: "Double",
                modellingRule: "Mandatory",
                // If I skip this line, I can see in UaExpert that value of property in type definition
                // and instantiated object is broken.
                //If I leave it, I cannot bind value of CustomProperty after instantation to custom value - it always is 1
                value: {dataType: DataType.Double, value: 1}
            });

        }
        return myCustomObjectType;

    }

    it("example from 162 - way 1 : using setValueFromSource", function () {

        const myCustomObjectType = findOrCreateCustomObjectType(addressSpace);

        const myObject = myCustomObjectType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyObject"
        });

        // the first method consist of accessing the customProperty and
        // setting the value when ever it change from the outside.
        myObject.customProperty.setValueFromSource({dataType: DataType.Double, value: -32});

        // verification
        //xx console.log(myObject.customProperty.readValue().toString());
        myObject.customProperty.readValue().value.value.should.eql(-32);

    });


    it("example from 162 - way 2 : rebinding variable ", function () {

        const myCustomObjectType = findOrCreateCustomObjectType(addressSpace);

        const myObject = myCustomObjectType.instantiate({
            organizedBy: "RootFolder",
            browseName: "MyObject2"
        });

        // the  method consist of setting a getter and a setter
        let value = 3;

        const options = {
            get: function () {
                return new Variant({
                    dataType: DataType.Double,
                    value: value
                });
            },
            set: null
        };

        myObject.customProperty.bindVariable(options, true/*overwrite existing binding ? Yes !*/);

        myObject.customProperty.readValue().value.value.should.eql(3);

        value = 30;
        myObject.customProperty.readValue().value.value.should.eql(30);
    });

});
