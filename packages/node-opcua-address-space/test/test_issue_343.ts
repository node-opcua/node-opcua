import * as should from "should";

import * as nodesets from "node-opcua-nodesets";
import { generateAddressSpace } from "..";
import { AddressSpace, Namespace, NamespaceOptions } from "..";

import { BoilerType, createBoilerType } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing automatic string nodeid assignment", () => {

    const nodesetFilename = nodesets.standard_nodeset_file;

    let addressSpace: AddressSpace;
    let boilerType: BoilerType;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, nodesetFilename);

        const namespace = addressSpace.registerNamespace("private");
        namespace.index.should.eql(1);

        const someNamespace1 = addressSpace.registerNamespace("SomeOtherNamespace1");
        someNamespace1.index.should.eql(2);

        const someNamespace2 = addressSpace.registerNamespace("SomeOtherNamespace2");
        someNamespace2.index.should.eql(3);

        boilerType = createBoilerType(namespace);
    });

    after(async () => {
        addressSpace.dispose();
    });

    it("should automatically assign string nodeId in same namespace as parent object", () => {

        const someNamespace1 = addressSpace.getNamespace("SomeOtherNamespace1");

        const boiler = boilerType.instantiate({
            browseName: "Boiler#1",
            nodeId: "s=MyBoiler"
        });

        boiler.nodeId.toString().should.eql("ns=1;s=MyBoiler");

        boiler.inputPipe.nodeId.namespace.should.eql(boiler.nodeId.namespace, "expecting namespace index to match");
        boiler.inputPipe.nodeId.toString().should.eql("ns=1;s=MyBoiler-InputPipe");

        //  console.log(boiler.toString());

    });

    it("should be possible to specify a custom separator for construction string nodeid " +
        "during object instantiation", () => {

            const old_nodeIdNameSeparator = NamespaceOptions.nodeIdNameSeparator;

            old_nodeIdNameSeparator.should.have.type("string");

            NamespaceOptions.nodeIdNameSeparator = "#";

            const boiler = boilerType.instantiate({
                browseName: "Boiler2",
                nodeId: "s=MyBoiler2"
            });

            boiler.nodeId.toString().should.eql("ns=1;s=MyBoiler2");

            boiler.inputPipe.nodeId.namespace.should.eql(boiler.nodeId.namespace, "expecting namespace index to match");
            boiler.inputPipe.nodeId.toString().should.eql("ns=1;s=MyBoiler2#InputPipe");

            NamespaceOptions.nodeIdNameSeparator = old_nodeIdNameSeparator;

        });

});
