import {
    AddressSpace,
    getMiniAddressSpace,
    Namespace,
} from "..";

describe("AddressSpace#delete", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        namespace.namespaceUri.should.eql("http://MYNAMESPACE");
    });

    after(() => {
        addressSpace.dispose();
    });

    it("DX1 sshould delete node ", () => {

        // given a parent node having a direct reference to it's child node
        const parentNode = namespace.addObject({
            browseName: "ParentNode",
            organizedBy: addressSpace.rootFolder.objects
        });

        const childNode = namespace.addObject({
            browseName: "ChildNode"
        });

        parentNode.addReference({
            isForward: true,
            nodeId: childNode.nodeId,
            referenceType: "HasComponent",
        });

        parentNode.getComponents().length.should.eql(1);
        // when I delete the child node
        addressSpace.deleteNode(childNode);

        // then the parent should not have it as a child
        parentNode.getComponents().length.should.eql(0);

    });
    it("DX2 should delete node ", () => {

        // given a child node having a reverse reference to it's parent node
        const parentNode = namespace.addObject({
            browseName: "ParentNode",
            organizedBy: addressSpace.rootFolder.objects
        });

        const childNode = namespace.addObject({
            browseName: "ChildNode"
        });

        childNode.addReference({
            isForward: false,
            nodeId: parentNode.nodeId,
            referenceType: "HasComponent",
        });

        parentNode.getComponents().length.should.eql(1);
        // when I delete the child node
        addressSpace.deleteNode(childNode);

        // then the parent should not have it as a child
        parentNode.getComponents().length.should.eql(0);

    });
});
