
"use strict";
/* global describe,it,before*/
const should = require("should");
const nodesets = require("node-opcua-nodesets");
const generateAddressSpace = require("..").generate_address_space;
const AddressSpace = require("..").AddressSpace;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing findReferenceEx",function() {
    const nodesetFilename = nodesets.standard_nodeset_file;

    const my_nodesets = [
        nodesets.standard_nodeset_file,
        nodesets.di_nodeset_filename,
    ];

    let addressSpace = null;

    before(function (done) {
        addressSpace = new AddressSpace();
        addressSpace.registerNamespace("Private");
        generateAddressSpace(addressSpace, my_nodesets, function () {
            done();
        });
    });
    after(function (done) {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
        done();
    });
    it("should findReferenceEx",function() {

        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        const topologyElementType    = addressSpace.findObjectType("TopologyElementType",nsDI);
        
        const deviceType = addressSpace.findObjectType("DeviceType",nsDI);


        function isMandatory(reference){
            //xx console.log(reference.node.modellingRule , reference._referenceType.browseName.toString(),reference.node.browseName.toString());
            if (!reference.node.modellingRule)
                return false;
            (typeof reference.node.modellingRule === "string").should.eql(true);
            return reference.node.modellingRule === "Mandatory" || reference.node.modellingRule === "Optional";
        }
        const r1_child      = deviceType.findReferencesEx("Aggregates").filter(x=>isMandatory(x)).map(x=>x.node.browseName.name.toString());
        const r1_components = deviceType.findReferencesEx("HasComponent").filter(x=>isMandatory(x)).map(x=>x.node.browseName.name.toString());
        const r1_properties = deviceType.findReferencesEx("HasProperty").filter(x=>isMandatory(x)).map(x=>x.node.browseName.name.toString());

        console.log("Aggregates from ",deviceType.browseName.toString(),": ", r1_child.sort().join(" ").yellow.bold);

        r1_child.length.should.be.greaterThan(1);

        [].concat(r1_components,r1_properties).sort().should.eql(r1_child.sort());

        const r2_child = topologyElementType.findReferencesEx("Aggregates").filter(x=>isMandatory(x)).map(x=>x.node.browseName.name.toString());
        r2_child.length.should.be.greaterThan(1);

        console.log("Aggregates from ",topologyElementType.browseName.toString(), ": ", r2_child.sort().join(" ").yellow.bold);


        const optionals = [].concat(r1_child.sort(),r2_child.sort());
        console.log("optionals ",topologyElementType.browseName.toString(), ": ", optionals.join(" ").yellow.bold);

        const valveType = addressSpace.getPrivateNamespace().addObjectType({
            browseName: "ValveType",
            subtypeOf: deviceType,
        });

        const someDevice = valveType.instantiate({
            browseName: "SomeDevice",
            // let make sure that all properties are requires
            optionals: optionals
        });
        for (const opt of optionals) {
            const child = someDevice.getChildByName(opt);
            const childName = child ?  child.browseName.toString(): " ???";
            //xx console.log("opt ",opt,childName);
        }
        const instance_children      = someDevice.findReferencesEx("Aggregates").map(x=>x.node.browseName.name.toString());

        //xx console.log(instance_children);

        [].concat(r1_child,r2_child).sort().should.eql(instance_children.sort());
    });
});
