/**
 * Children reached as JavaScript properties (`server.serverStatus.currentTime`).
 *
 * Names that a nodeset declares resolve through one getter shared on the prototype and the
 * node's child index; names first seen at runtime keep a per-parent accessor. See
 * impl/child_accessors.ts for the reasons.
 */

import { NodeClass, QualifiedName } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type UAObject, type UAObjectType, type UAVariable } from "../dist/api/index.js";
import { BaseNodeImpl, childAccessorNamesShadowedBy } from "../dist/impl/base_node_impl.js";
import { hasSharedChildAccessor } from "../dist/impl/child_accessors.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

type Dotted = Record<string, unknown>;
const dotted = (node: unknown) => node as Dotted;
const prototypeSize = () => Object.getOwnPropertyNames(BaseNodeImpl.prototype).length;

describe("child accessors", function (this: Mocha.Suite) {
    this.timeout(60000);

    let addressSpace: AddressSpace;
    let objects: UAObject;
    let server: UAObject & Dotted;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        addressSpace.registerNamespace("urn:child-accessors");
        objects = addressSpace.rootFolder.objects;
        server = dotted(objects.getFolderElementByName("Server")) as UAObject & Dotted;
    });
    after(() => {
        addressSpace.dispose();
    });

    it("resolves Organizes, HasComponent and HasProperty children along a dotted path", () => {
        const rootFolder = dotted(addressSpace.rootFolder);
        const viaDots = dotted(dotted(rootFolder.objects).server);
        should(viaDots).equal(server);
        const serverStatus = dotted(server.serverStatus);
        should((serverStatus as unknown as UAVariable).browseName.name).eql("ServerStatus");
        should((dotted(serverStatus.buildInfo).productName as UAVariable).browseName.name).eql("ProductName");
        should((server.namespaceArray as UAVariable).browseName.name).eql("NamespaceArray");
    });

    it("resolves HasSubtype children of a type node", () => {
        const baseObjectType = dotted(addressSpace.findObjectType("BaseObjectType"));
        should((baseObjectType.folderType as UAObjectType).browseName.name).eql("FolderType");
    });

    it("installs nothing on the instances: the accessor is inherited and not enumerable", () => {
        should(Object.hasOwn(server, "serverStatus")).eql(false);
        should("serverStatus" in server).eql(true);
        should(Object.keys(server)).not.containEql("serverStatus");
        // every node inherits it, and answers undefined when it has no such child
        should("serverStatus" in objects).eql(true);
        should(dotted(objects).serverStatus).eql(undefined);
        should(server.thisChildDoesNotExist).eql(undefined);
    });

    it("never lets a child shadow an attribute or a method of the node", () => {
        // the Server object has an EventNotifier attribute; the PubSub PublishedEventsType has a
        // child variable named EventNotifier: the attribute wins on objects
        should(typeof server.eventNotifier).eql("number");
        const publishedEventsType = addressSpace.findNode("i=14572");
        should(publishedEventsType?.getChildByName("EventNotifier")?.browseName.name).eql("EventNotifier");

        // NamespaceMetadataType has a NamespaceUri property; BaseNode has a namespaceUri getter
        const namespaces = server.getComponentByName("Namespaces") as UAObject;
        const metadataType = addressSpace.findObjectType("NamespaceMetadataType") as UAObjectType;
        const metadata = metadataType.instantiate({ browseName: "MetadataForTest", componentOf: namespaces });
        should(typeof metadata.namespaceUri).eql("string");
        should(Object.hasOwn(metadata, "namespaceUri")).eql(false);
        should(metadata.getPropertyByName("NamespaceUri")?.browseName.name).eql("NamespaceUri");
    });

    it("never turns a node into a thenable, whatever a child is called", async () => {
        const namespace = addressSpace.getOwnNamespace();
        const folder = namespace.addFolder(objects, { browseName: "FolderWithThen" });
        namespace.addObject({ browseName: "Then", componentOf: folder });
        namespace.addObject({ browseName: "Constructor", componentOf: folder });
        should(Object.hasOwn(folder, "then")).eql(false);
        should(dotted(folder).then).eql(undefined);
        should(folder.getComponentByName("Then")?.browseName.name).eql("Then");
        should(folder.constructor).equal(Object.getPrototypeOf(folder).constructor);
        const awaited = await Promise.resolve(folder);
        should(awaited).equal(folder);
    });

    it("follows addReference, removeReference and deleteNode, first child wins while it is there", () => {
        const namespace = addressSpace.getOwnNamespace();
        addressSpace.registerNamespace("urn:child-accessors:other");
        const folder = namespace.addFolder(objects, { browseName: "DuplicateNames" });
        // ServerStatus is a name the standard nodeset declares: shared accessor
        const first = namespace.addVariable({ browseName: "ServerStatus", componentOf: folder, dataType: "Double" });
        const second = namespace.addVariable({
            browseName: new QualifiedName({ name: "ServerStatus", namespaceIndex: 2 }),
            componentOf: folder,
            dataType: "Double"
        });
        should(dotted(folder).serverStatus).equal(first);
        should(folder.getChildByName("ServerStatus", 2)).equal(second);
        should(folder.getChildByName("ServerStatus", 1)).equal(first);

        folder.removeReference({ referenceType: "HasComponent", nodeId: first.nodeId });
        should(dotted(folder).serverStatus).equal(second);

        namespace.deleteNode(second);
        should(dotted(folder).serverStatus).eql(undefined);
    });

    it("keeps runtime-only names on a per-parent accessor and off the prototype", () => {
        const namespace = addressSpace.getOwnNamespace();
        const folder = namespace.addFolder(objects, { browseName: "UniqueNames" });
        const before = prototypeSize();
        let last: UAVariable | undefined;
        for (let i = 0; i < 2000; i++) {
            last = namespace.addVariable({ browseName: `unique_${i}`, componentOf: folder, dataType: "Double" });
        }
        should(prototypeSize()).eql(before);
        should(Object.hasOwn(folder, "unique_1999")).eql(true);
        should(dotted(folder).unique_1999).equal(last);
        should(folder.getComponentByName("unique_1999")).equal(last);
    });

    it("registerChildAccessorNames turns a runtime name into a shared accessor", () => {
        const namespace = addressSpace.getOwnNamespace();
        addressSpace.registerChildAccessorNames(["Temperature"]);
        const device = namespace.addObject({ browseName: "Device1", organizedBy: objects });
        const temperature = namespace.addVariable({ browseName: "Temperature", componentOf: device, dataType: "Double" });
        should(Object.hasOwn(device, "temperature")).eql(false);
        should(dotted(device).temperature).equal(temperature);
    });

    it("works under isFrugal: declared names still resolve, runtime names get no own accessor", () => {
        const namespace = addressSpace.getOwnNamespace();
        addressSpace.isFrugal = true;
        try {
            const device = namespace.addObject({ browseName: "FrugalDevice", organizedBy: objects });
            const variable = namespace.addVariable({ browseName: "FrugalUnique", componentOf: device, dataType: "Double" });
            should(Object.hasOwn(device, "frugalUnique")).eql(false);
            should(dotted(device).frugalUnique).eql(undefined);
            should(device.getComponentByName("FrugalUnique")).equal(variable);

            const discrete = namespace.addMultiStateDiscrete({
                browseName: "FrugalDiscrete",
                componentOf: device,
                enumStrings: ["Off", "On"],
                value: 1
            });
            should(discrete.enumStrings.browseName.name).eql("EnumStrings");
            should(discrete.getValueAsString()).eql("On");
        } finally {
            addressSpace.isFrugal = false;
        }
    });

    it("keeps the contracts of getComponentByName, getPropertyByName, getMethodByName and getFolderElementByName", () => {
        should(server.getComponentByName("ServerStatus")).equal(server.serverStatus);
        should(server.getPropertyByName("NamespaceArray")).equal(server.namespaceArray);
        should(server.getPropertyByName("ServerStatus")).eql(null);
        should(server.getComponentByName("NamespaceArray")).eql(null);
        should(server.getMethodByName("GetMonitoredItems")?.browseName.name).eql("GetMonitoredItems");
        should(server.getComponentByName("GetMonitoredItems")).eql(null);
        should(objects.getFolderElementByName("Server")).equal(server);
        should(objects.getComponentByName("Server")).eql(null);
        should(server.getComponentByName("ServerStatus", 0)).equal(server.serverStatus);
        should(server.getComponentByName("ServerStatus", 1)).eql(null);
    });

    it("indexes a forward reference whose target is registered later", () => {
        const namespace = addressSpace.getOwnNamespace();
        const parent = namespace.addObject({ browseName: "LateParent", organizedBy: objects });
        const childNodeId = "ns=1;s=LateChild";
        parent.addReference({ referenceType: "HasComponent", nodeId: addressSpace.resolveNodeId(childNodeId) });
        should(parent.getComponentByName("LateChild")).eql(null);
        const child = namespace.addVariable({
            nodeId: childNodeId,
            browseName: "LateChild",
            componentOf: parent,
            dataType: "Double"
        });
        should(parent.getComponentByName("LateChild")).equal(child);
        should(dotted(parent).lateChild).equal(child);
    });

    it("exposes structural children only: a node that is merely notified is not a dotted child", () => {
        const namespace = addressSpace.getOwnNamespace();
        const device = namespace.addObject({ browseName: "NotifyingDevice", organizedBy: objects });
        const notified = namespace.addObject({ browseName: "ServerStatus", organizedBy: objects });
        device.addReference({ referenceType: "HasNotifier", nodeId: notified.nodeId });
        should(dotted(device).serverStatus).eql(undefined);
        should(device.getChildByName("ServerStatus")).eql(null);
        should(device.findReferencesExAsObject("HasNotifier")).containEql(notified);
        // and a structural reference removed while the event reference stays: the child goes
        device.addReference({ referenceType: "HasComponent", nodeId: notified.nodeId });
        should(dotted(device).serverStatus).equal(notified);
        device.removeReference({ referenceType: "HasComponent", nodeId: notified.nodeId });
        should(dotted(device).serverStatus).eql(undefined);
    });

    it("tells the generator which names a child of a node can never be reached under", () => {
        const variable = server.getPropertyByName("NamespaceArray") as UAVariable;
        const forVariable = childAccessorNamesShadowedBy(variable);
        const forObject = childAccessorNamesShadowedBy(server);
        // fields and attributes of the class, methods, EventEmitter members, reserved names
        for (const name of ["dataType", "valueRank", "readValue", "nodeId", "namespaceUri", "on", "then", "__proto__"]) {
            should(forVariable.has(name)).eql(true, name);
        }
        should(forObject.has("eventNotifier")).eql(true);
        should(forObject.has("dataType")).eql(false, "an object exposes a child named DataType");
        // a shared child accessor is not a member: those are the names the runtime does expose
        should(forObject.has("serverStatus")).eql(false);
        // BaseNode.nodeVersion resolves the NodeVersion property itself
        should(forObject.has("nodeVersion")).eql(false);
        should(forVariable.has("enumStrings")).eql(false);
    });

    it("no node class hides a shared accessor behind an emitted class field", () => {
        // an ES2022 class field is an own property initialised to undefined on every instance,
        // which shadows the getter inherited from the prototype (UADataTypeImpl.enumStrings did,
        // until it became a declare-only field)
        const shadowed = new Set<string>();
        for (const namespace of addressSpace.getNamespaceArray()) {
            for (const node of namespace.nodeIterator()) {
                for (const name of Object.getOwnPropertyNames(node)) {
                    if (hasSharedChildAccessor(name) && dotted(node)[name] === undefined) {
                        shadowed.add(`${NodeClass[node.nodeClass]}.${name}`);
                    }
                }
            }
        }
        should([...shadowed]).eql([]);
    });
});
