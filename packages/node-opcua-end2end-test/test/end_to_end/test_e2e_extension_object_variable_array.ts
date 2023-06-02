/* eslint-disable max-statements */
import * as util from "node:util";
import * as path from "node:path";

import should from "should";
import { AttributeIds, ClientSession, ClientSubscription, DataValue, IBasicSession, MonitoringMode, NodeClassMask, NodeId, nodesets, OPCUAClient, OPCUAServer, ReferenceDescription, ResultMask, TimestampsToReturn, Variant } from "node-opcua";
import { BaseNode, NodeClass, UAVariable, DataType, BrowseDirection } from "node-opcua";

const port = 1984;

export function enrichExtensionObjectVariables(node: BaseNode) {

    type Cache = any;
    function _enrichExtensionObjectVariables(node: BaseNode, cache: Cache) {
        const k = node.nodeId.toString();
        if (cache[k]) return;
        cache[k] = node;
        const c1 = node.findReferencesExAsObject("Organizes", BrowseDirection.Forward);
        const c2 = node.findReferencesExAsObject("HasChild", BrowseDirection.Forward);
        const children = [...c1, ...c2];

        for (const child of children) {
            if (child.nodeClass === NodeClass.Method) {
                continue;
            }
            if (child.nodeClass === NodeClass.Variable) {
                const v = child as UAVariable;
                const dataTypeObj = v.dataTypeObj;
                if (dataTypeObj.getBasicDataType() !== DataType.ExtensionObject) {
                    continue;
                }
                if (v.findReferences("HasChild").length !== 0) {
                    // has already children 
                    continue;
                }
                if (v.nodeId.namespace === 0) {
                    // ignore from namespace 0
                    continue;
                }

                doDebug && console.log("considering ", child.browseName.toString(), v.minimumSamplingInterval);
                v.installExtensionObjectVariables();
                // 
                v.minimumSamplingInterval = 0;
                v.on("value_changed", () => {
                    doDebug && console.log("", v.browseName.toString(), "value changed");
                })

            } else {
                _enrichExtensionObjectVariables(child, cache);
            }
        }
    }
    _enrichExtensionObjectVariables(node, {});
}






/**
 * increment the value  of a arbitrary Variant value
 */
const incr = (value: any) => {
    if (typeof value === "boolean") {
        return !value;
    } else if (typeof value === "number") {
        return value += 1;
    } else {
        if (Array.isArray(value)) {
            value = value.map(incr);
            return value;
        } else {
            const newValue = (value.clone) ? value.clone() : value;
            for (const [k, v] of Object.entries(newValue)) {
                newValue[k] = incr(v);
            }
            return newValue;
        }
    }
}

const map = new Map<string, string>();
async function readFullPath(session: IBasicSession, nodeId: NodeId): Promise<string> {

    const hash = nodeId.toString();
    if (map.has(hash)) { return map.get(hash)!; }

    const d = await session.read({ nodeId, attributeId: AttributeIds.BrowseName });
    const b = d.value.value.name as string;
    const r = await session.browse({
        nodeId,
        browseDirection: BrowseDirection.Inverse,
        nodeClassMask: NodeClassMask.Variable | NodeClassMask.Method | NodeClassMask.Object
    });
    let result = "";
    if (r.references && r.references.length === 1) {
        result = (await readFullPath(session, r.references[0].nodeId)) + "/" + b;
    }
    else { result = "/" + b; }
    map.set(hash, result);
    return result;
}
const map1 = new Map<string, ReferenceDescription[]>();
async function browseChild(session: IBasicSession, nodeId: NodeId): Promise<ReferenceDescription[]> {
    const hash = nodeId.toString();
    if (map1.has(hash)) { return map1.get(hash)!; }

    const browseResult = await session.browse({
        nodeId,
        browseDirection: BrowseDirection.Forward,
        nodeClassMask: NodeClassMask.Variable,
        resultMask: ResultMask.BrowseName
    });
    if (!browseResult.references) throw new Error("Internal Error");
    map1.set(hash, browseResult.references);
    return browseResult.references;
}
async function getMember(session: IBasicSession, nodeId: NodeId, name: string): Promise<NodeId> {

    const references = await browseChild(session, nodeId);

    const r = (references).find((r) => r.browseName.name!.toLowerCase() === name.toLowerCase());
    if (!r) {
        const fullPath = await readFullPath(session, nodeId);
        throw new Error("cannot find " + name + " in node " + nodeId.toString() + " " + fullPath);
    }
    return r.nodeId;
}
const write = async (session: IBasicSession, nodeId: NodeId, value: any, dataType?: DataType): Promise<void> => {

    const fullPath = await readFullPath(session, nodeId);
    doDebug && console.log("writing ", fullPath);

    const oldValue = (await session.read({ nodeId, attributeId: AttributeIds.Value })).value;
    doDebug && console.log("oldValue = ", oldValue.toString());

    dataType = dataType || oldValue.dataType;

    const variantToWrite = new Variant({ ...oldValue, value, dataType });
    const statusCode = await session.write({
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value: variantToWrite }
    });
    if (!statusCode.isGood()) {
        console.log("nodeid = ", nodeId.toString());
        console.log("variantToWrite = ", variantToWrite.toString());
        console.log("oldValue       = ", oldValue.toString());
        throw new Error("Not writable node " + nodeId.toString() + " " + statusCode.toString());
    }
    const newValue = (await session.read({ nodeId, attributeId: AttributeIds.Value })).value;

    if (newValue.toString() === oldValue.toString()) {
        console.log("Error in writing , old value === new value", oldValue.toString());
        throw new Error(" value has not changed");
    }
    if (variantToWrite.toString() !== newValue.toString()) {
        console.log("variantToWrite = ", variantToWrite.toString());
        console.log("newValue       = ", newValue.toString());
        throw new Error("Error in writing , new value !== variantToWrite");
    }
}
const read = async (session: IBasicSession, nodeId: NodeId): Promise<any> => {
    return (await session.read({ nodeId, attributeId: AttributeIds.Value })).value.value;
}
async function waitSubcriptionUpdate(subscription: ClientSubscription) {
    //   await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => subscription.once("keepalive", resolve));
}

const doDebug = true;

async function subscribeToScalarElement(session: ClientSession, subscription: ClientSubscription, nodeId: NodeId) {

    const rootElement: Counter = { counter: 0, dataValues: [], $props: {}, nodeId };
    await monitor(session, subscription, nodeId, rootElement);

    const value = await read(session, nodeId);

    for (const [k, v] of Object.entries(value)) {
        const stat: Counter = { counter: 0, dataValues: [] };
        rootElement.$props![k] = stat;

        const nodeIdChild = await getMember(session, nodeId, k);
        stat.nodeId = nodeIdChild;

        await monitor(session, subscription, nodeIdChild, stat);
    }
    return rootElement;
}
async function checkScalarVariable(session: ClientSession, subscription: ClientSubscription, nodeId: NodeId) {
    const rootElement = await subscribeToScalarElement(session, subscription, nodeId);
    const info = { main: rootElement };

    await waitSubcriptionUpdate(subscription);


    // change each element in turn
    await tryChangingMainVariable();
    await tryChangingChildVariable();
    await tryChangingMainVariable();
    await tryChangingChildVariable();


    function dumpStat(rootElement: Counter) {
        console.log("");
        // console.log("status", rootElement);
        console.log("root changes ", rootElement.counter);
        for (const [k, v] of Object.entries(rootElement.$props!)) {
            console.log("   ", k, v.counter);
        }
        console.log("");
    }


    // now change the whole element
    async function tryChangingMainVariable() {
        console.log("> tryChangingMainVariable");
        resetCounter(info);
        const value = await read(session, nodeId);
        const newValue = incr(value);
        await write(session, rootElement.nodeId!, newValue);
        await waitSubcriptionUpdate(subscription);
        dumpStat(rootElement);

        info.main.counter.should.eql(1);
        info.main.$props!.field1.counter.should.eql(1);
        info.main.$props!.field2.counter.should.eql(1);

    }

    async function tryChangingChildVariable() {
        console.log("> tryChangingChildVariable");

        let index = 0;
        for (const [key, v] of Object.entries(rootElement.$props!)) {
            console.log(">> tryChangingChildVariable - ", key, index);
            resetCounter(info);

            const nodeIdE = v.nodeId!;
            const value = await read(session, nodeIdE);
            const newValue = incr(value);
            await write(session, nodeIdE, newValue);
            await waitSubcriptionUpdate(subscription);
            dumpStat(rootElement);

            info.main.counter.should.eql(1);
            info.main.$props![key].counter.should.eql(1);

            Object.entries(info.main.$props!)
                .filter(([k, v]) => k !== key)
                .map(([k, v]) => v.counter.should.eql(0));



            index++;

        }
    }


}
async function checMatrixVariable(session: ClientSession, subscription: ClientSubscription, nodeId: NodeId, level: "TopVariable" | "IndexedVariable" | "InnerProperty") {
    /** */
}
async function checkArrayVariable(session: ClientSession, subscription: ClientSubscription, nodeId: NodeId, level: "TopVariable" | "IndexedVariable" | "InnerProperty") {

    const info = await subscribeToNodeAt3Level(session, subscription, nodeId);
    doDebug && console.log(util.inspect(dumpInfo(info)));

    const el0NodeId = await getMember(session, nodeId, "0");
    const el1NodeId = await getMember(session, nodeId, "1");

    async function verify() {

        const valueAll = await read(session, nodeId);
        const el0 = await read(session, el0NodeId);
        const el1 = await read(session, el1NodeId);

        // console.log(" all => ", valueAll.toString());
        // console.log(" el0 => ", el0.toString());
        // console.log(" el1 => ", el1.toString());

        let errorCount = 0;
        if (valueAll[0].toString() !== el0.toString()) {
            console.log(" problem with element 0");
            console.log(" all => ", valueAll.toString());
            console.log(" el0 => ", el0.toString());
            console.log(" el1 => ", el1.toString());

            errorCount += 1;
        }
        if (valueAll[1].toString() !== el1.toString()) {
            console.log(" problem with element 1");
            console.log(" all => ", valueAll.toString());
            console.log(" el0 => ", el0.toString());
            console.log(" el1 => ", el1.toString());
            errorCount += 1;
        }
        if (errorCount) {
            throw new Error("Houston we have a problem");
        }
        return { valueAll };
    }

    const { valueAll } = await verify();


    async function modifyArrayElements() {
        console.log("> testing modifying each individual elements");
        // changing value 0
        const el0Modified = incr(valueAll[0]);
        doDebug && console.log("Modified value  0 = ", el0Modified);
        await write(session, el0NodeId, el0Modified, DataType.ExtensionObject);
        await verify();

        // changing value 1
        const el1Modified = incr(incr(valueAll[1]));
        doDebug && console.log("Modified value  0 = ", el1Modified);
        await write(session, el1NodeId, el1Modified, DataType.ExtensionObject);
        await verify();
    }


    async function modifyArrayElementsProperty() {
        console.log("> testing modifying each individual array element properties");
        const valueAll = await read(session, nodeId);

        valueAll[0] = incr(valueAll[0]);

        for (const [k, v] of Object.entries(valueAll[0])) {
            const nodeId = await getMember(session, el0NodeId, k);
            await write(session, nodeId, v);
        }
        await verify();

    }
    async function modifyTopElement() {
        console.log("> testing modifying the top elements");

        const valueAll = await read(session, nodeId);
        valueAll[0] = incr(incr(valueAll[0]));
        valueAll[1] = incr(incr(incr(valueAll[1])));
        await write(session, nodeId, valueAll, DataType.ExtensionObject);
        await verify();

    }

    if (level === "TopVariable") {

        await modifyTopElement();

        await modifyArrayElementsProperty();
        await modifyArrayElements();
        await modifyArrayElementsProperty();
        await modifyTopElement();
        await modifyArrayElements();
        await modifyArrayElementsProperty();


        {
            console.log("> modify top element should cause all elements below to be changed in monitored item");

            await waitSubcriptionUpdate(subscription);
            resetCounter(info);
            doDebug && console.log(info);
            info.main.counter.should.eql(0);
            info.element0.counter.should.eql(0);
            info.element0.$props!.field1.counter.should.eql(0);
            info.element0.$props!.field2.counter.should.eql(0);
            info.element1.counter.should.eql(0);
            info.element1.$props!.field1.counter.should.eql(0);
            info.element1.$props!.field2.counter.should.eql(0);

            // modify top element
            await modifyTopElement();

            await waitSubcriptionUpdate(subscription);
            doDebug && console.log(util.inspect(dumpInfo(info)));

            info.main.counter.should.eql(1);
            info.element0.counter.should.eql(1);
            info.element0.$props!.field1.counter.should.eql(1);
            info.element0.$props!.field2.counter.should.eql(1);
            info.element1.counter.should.eql(1);
            info.element1.$props!.field1.counter.should.eql(1);
            info.element1.$props!.field2.counter.should.eql(1);
        }
    }

    if (level == "IndexedVariable") {
        console.log("> modify one array element should cause all elements below to be changed in monitored item");
        await waitSubcriptionUpdate(subscription);
        resetCounter(info);

        info.main.counter.should.eql(0);

        info.element0.counter.should.eql(0);
        info.element0.$props!.field1.counter.should.eql(0);
        info.element0.$props!.field2.counter.should.eql(0);
        info.element1.counter.should.eql(0);
        info.element1.$props!.field1.counter.should.eql(0);
        info.element1.$props!.field2.counter.should.eql(0);


        doDebug && console.log("before", util.inspect(dumpInfo(info)));
        const valueAll = await read(session, nodeId);
        doDebug && console.log("Value[0]", valueAll[0].toString());

        // 
        const el0Modified = incr(valueAll[0]);
        doDebug && console.log("Value[0]", el0Modified.toString());
        await write(session, el0NodeId, el0Modified);
        await verify();

        await waitSubcriptionUpdate(subscription);
        doDebug && console.log(info);

        info.main.counter.should.eql(1);

        info.element0.counter.should.eql(1);
        info.element0.$props!.field1.counter.should.eql(1);
        info.element0.$props!.field2.counter.should.eql(1);

        info.element1.counter.should.eql(0);
        info.element1.$props!.field1.counter.should.eql(0);
        info.element1.$props!.field2.counter.should.eql(0);

        // do it again
        await write(session, el0NodeId, incr(el0Modified));
        await waitSubcriptionUpdate(subscription);
        doDebug && console.log("after", util.inspect(dumpInfo(info)));

        info.main.counter.should.eql(2);

        info.element0.counter.should.eql(2);
        info.element0.$props!.field1.counter.should.eql(2);
        info.element0.$props!.field2.counter.should.eql(2);

        info.element1.counter.should.eql(0);
        info.element1.$props!.field1.counter.should.eql(0);
        info.element1.$props!.field2.counter.should.eql(0);

    }

    if (level === "InnerProperty") {

        console.log("> modify one array element's property: should cause all elements below to be changed in monitored item");

        await waitSubcriptionUpdate(subscription);
        resetCounter(info);

        info.main.counter.should.eql(0);
        info.element0.counter.should.eql(0);
        info.element0.$props!.field1.counter.should.eql(0);
        info.element0.$props!.field2.counter.should.eql(0);
        info.element1.counter.should.eql(0);
        info.element1.$props!.field1.counter.should.eql(0);
        info.element1.$props!.field2.counter.should.eql(0);


        const valueAll = await read(session, nodeId);

        const [property, propValue] = Object.entries(valueAll[0])[1];
        const nodeIdProp = await getMember(session, el0NodeId, property);
        property.should.equal("field2");
        
        // 
        const propModified = incr(propValue);
        await write(session, nodeIdProp, propModified);
        await verify();

        await waitSubcriptionUpdate(subscription);
        doDebug && console.log(util.inspect(info,{depth: 3}));

        info.main.counter.should.eql(1);

        info.element0.counter.should.eql(1);
        info.element0.$props!.field1.counter.should.eql(0);
        info.element0.$props!.field2.counter.should.eql(1);

        info.element1.counter.should.eql(0);
        info.element1.$props!.field1.counter.should.eql(0);
        info.element1.$props!.field2.counter.should.eql(0);

        // do it again
        const propModified1 = incr(propModified);
        await write(session, nodeIdProp, propModified1);
        await verify();


        await waitSubcriptionUpdate(subscription);
        doDebug && console.log("after", util.inspect(dumpInfo(info)));

        info.main.counter.should.eql(2);

        info.element0.counter.should.eql(2);
        info.element0.$props!.field1.counter.should.eql(0);
        info.element0.$props!.field2.counter.should.eql(2);

        info.element1.counter.should.eql(0);
        info.element1.$props!.field1.counter.should.eql(0);
        info.element1.$props!.field2.counter.should.eql(0);


    }

}

interface Counter {
    counter: number;
    dataValues: DataValue[];
    $props?: Record<string, Counter>;
    nodeId?: NodeId;
}

function resetCounter(info: Record<string, Counter>) {
    for (const [k, v] of Object.entries(info)) {
        v.counter = 0;
        (v.dataValues as any).splice(0);
        if (v.$props) resetCounter(v.$props);
    }
}

function dumpInfo(info: Record<string, Counter>) {
    const r: any = {};
    for (const [k, v] of Object.entries(info)) {
        r[k] = r[k] || {};
        r[k]._counter = v.counter as number;
        if (v.$props) {
            for (const [kk, vv] of Object.entries(v.$props)) {
                // console.log("  ", k + "." + kk, vv.counter);
                r[k][kk] = { _counter: vv.counter };
            }
        }
    }
    return r;
}

async function monitor(session: IBasicSession, subscription: ClientSubscription, nodeId: NodeId, stat: Counter) {

    stat.counter = 0;

    const fullPath = await readFullPath(session, nodeId);

    const monitoredItem = await subscription.monitor({ nodeId, attributeId: AttributeIds.Value }, {
        queueSize: 100,
        samplingInterval: 0,
    }, TimestampsToReturn.Both, MonitoringMode.Reporting);
    monitoredItem.on("changed", (dataValue) => {
        stat.counter += 1;
        stat.dataValues.push(dataValue);
        doDebug && console.log("  monitored item changed", nodeId.toString(), fullPath, " changed ", stat.counter);
    });
}

async function subscribeToNodeAt3Level(session: ClientSession, subscription: ClientSubscription, nodeId: NodeId) {
    const info = {
        main: {
            counter: 0,
            dataValues: [] as DataValue[]
        },
        element0: {
            counter: 0,
            dataValues: [] as DataValue[],
            $props: {}
        } as Counter,
        element1: {
            counter: 0,
            dataValues: [] as DataValue[],
            $props: {}
        } as Counter,
    }
    await monitor(session, subscription, nodeId, info.main);

    // element 0
    {
        const el0NodeId = await getMember(session, nodeId, "0");
        await monitor(session, subscription, el0NodeId, info.element0);
        const v0 = await read(session, el0NodeId);
        for (const [k, v] of Object.entries(v0)) {
            const stat: Counter = { counter: 0, dataValues: [] };
            info.element0.$props![k] = stat;
            const nodeId = await getMember(session, el0NodeId, k);
            await monitor(session, subscription, nodeId, stat);
        }
    }
    {
        const el1NodeId = await getMember(session, nodeId, "1");
        await monitor(session, subscription, el1NodeId, info.element1);
        const v1 = await read(session, el1NodeId);
        for (const [k, v] of Object.entries(v1)) {
            const stat: Counter = { counter: 0, dataValues: [] };
            info.element1.$props![k] = stat;
            const nodeId = await getMember(session, el1NodeId, k);
            await monitor(session, subscription, nodeId, stat);
        }
    }
    await waitSubcriptionUpdate(subscription);
    return info;
}

async function withClient(endpointUrl: string, f: (session: ClientSession, subscription: ClientSubscription, nodeId: NodeId, valueRank: number) => Promise<void>) {
    const client = OPCUAClient.create({});

    await client.withSubscriptionAsync(endpointUrl,
        {
            maxNotificationsPerPublish: 10,
            priority: 1,
            publishingEnabled: true,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 3,
            requestedPublishingInterval: 10
        }, async (session, subscription) => {

            const browseResult = await session.browse({
                nodeId: "ns=2;i=1015",
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: NodeClassMask.Variable,
                resultMask: ResultMask.BrowseName | ResultMask.TypeDefinition
            });

            if (browseResult.statusCode.isNotGood()) {
                return;
            }
            for (const ref of browseResult.references || []) {

                const nodeId = ref.nodeId;
                const dataValues = await session.read([
                    {
                        nodeId, attributeId: AttributeIds.DataType
                    },
                    {
                        nodeId, attributeId: AttributeIds.ValueRank
                    },
                    {
                        nodeId, attributeId: AttributeIds.ArrayDimensions
                    },
                    {
                        nodeId, attributeId: AttributeIds.Value
                    }
                ]);

                const dataTypeNodeId = dataValues[0].value.value;
                const dataTypeBrowseNameDataValue = await session.read({ nodeId: dataTypeNodeId, attributeId: AttributeIds.BrowseName });
                const dataTypeBrowseName = dataTypeBrowseNameDataValue.value.value.toString();
                doDebug && console.log(ref.browseName.toString());
                doDebug && console.log("DataType=", dataTypeNodeId.toString(), dataTypeBrowseName);

                const valueRank = dataValues[1].value.value as number;
                doDebug && console.log("ValueRank = ", valueRank);
                const arrayDimensions = dataValues[2].value.value;
                doDebug && console.log("arrayDimensions =", arrayDimensions);

                doDebug && console.log("value =", dataValues[3].value.toString());
                doDebug && console.log(" ");

                await f(session, subscription, nodeId, valueRank);
            }
        });


}
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing extension object variable enrichment", function (this: any) {
    let server: OPCUAServer;
    beforeEach(async () => {

        server = new OPCUAServer({
            port,
            nodeset_filename: [
                nodesets.standard,
                path.join(__dirname, "../../fixtures/_generated_mymodel.model.Nodeset2.xml")
            ]
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        await server.start();

    });
    afterEach(async () => {
        await server.shutdown();
    });

    it("should automatically enrich Extension object variable defined in nodeset2.xml file (without creating additional apps)", async () => {

        const addressSpace = server.engine.addressSpace!;

        const scalarVariable = addressSpace.findNode("ns=2;i=1008")! as UAVariable;
        scalarVariable.browseName.toString().should.equal("2:ScalarVariable");

        const value = scalarVariable.readValue().value;
        console.log(value.toString());
        console.log(scalarVariable.toString());

        should.exist(scalarVariable.getComponentByName("Field1"));
        should.exist(scalarVariable.getComponentByName("Field2"));


    });

});

describe("testing extension object with client residing on a different process than the server process", function (this: any) {

    this.timeout(Math.max(600000, this.timeout()));


    let server: OPCUAServer;
    before(async () => {

        server = new OPCUAServer({
            port,
            nodeset_filename: [
                nodesets.standard,
                path.join(__dirname, "../../fixtures/extension_array_variable_model.xml")
            ]
        });
        await server.initialize();

        const addressSpace = server.engine.addressSpace!;
        enrichExtensionObjectVariables(addressSpace.rootFolder.objects);

        await server.start();

    });
    after(async () => {
        await server.shutdown();
    });

    it("should bind complex extension object - " + "Scalar", async () => {

        const endpointUrl = server.getEndpointUrl();
        await withClient(endpointUrl, async (session, subscription, nodeId, valueRank) => {
            if (valueRank === -1) {
                await checkScalarVariable(session, subscription, nodeId);
            }
        });
        console.log("Done !");
    });

    [["Array", 1], ["Matrix", 2]].forEach(([valueRankName, selectedValueRank]) => {

        ["TopVariable", "IndexedVariable", "InnerProperty"].forEach((level: any) => {

            it("should bind complex extension object - " + valueRankName + "-" + level, async () => {

                const endpointUrl = server.getEndpointUrl();
                await withClient(endpointUrl, async (session, subscription, nodeId, valueRank) => {
                    if (selectedValueRank !== valueRank) return;
                    if (valueRank === 1) {
                        await checkArrayVariable(session, subscription, nodeId, level);
                    } else if (valueRank === 2) {
                        await checMatrixVariable(session, subscription, nodeId, level);
                    }
                });
                console.log("Done !");
            });
        });
    });


});
