import * as should from "should";

import { AddressSpace, Namespace } from "..";
import { getMiniAddressSpace } from "../testHelpers";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#513 Testing issue porting from 0.4.0 0.4.2", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();

        addressSpace.getNamespaceArray().length.should.eql(2);
        namespace = addressSpace.getOwnNamespace();
        namespace.index.should.eql(1);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should not raise a error when browseName is used un-consistently but a warning", () => {
        const o = namespace.addObject({
            browseName: "1:MyObject",
            organizedBy: addressSpace.rootFolder.objects
        });

        const node = namespace.addVariable({
            browseName: "1:MyVariable",
            dataType: "Double",
            propertyOf: o
        });
        node.browseName.namespaceIndex.should.eql(1);
    });

    it("should not raise a error nor a warning when browseName contains a comma in the middle", () => {
        const o = namespace.addObject({
            browseName: "MyObject:With:3:Columns",
            organizedBy: addressSpace.rootFolder.objects
        });
        o.browseName.namespaceIndex.should.eql(1);
        o.browseName.toString().should.eql("1:MyObject:With:3:Columns");
        o.browseName.name!.should.eql("MyObject:With:3:Columns");
    });
});
