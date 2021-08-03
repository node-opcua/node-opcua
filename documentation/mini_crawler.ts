

import { OPCUAClient, ClientSession, NodeCrawler, CacheNode, UserData, BrowseDirection, NodeClass, CacheNodeVariable, DataType } from "../packages/node-opcua";
const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const js2xml = require("js2xmlparser");

//const nodeId = "ns=0;i=85"; // ObjectFolder
const nodeId = "ns=1;i=1000"; // MyDevices
(async () => {
    try {
        function onBrowse(crawler: NodeCrawler, cacheNode: CacheNode, userData: UserData) {
            if (cacheNode.nodeClass === NodeClass.ReferenceType) {
                return;
            }
            const node: any = { "@": {} };

            node["@"].nodeClass = NodeClass[cacheNode.nodeClass];

            if (cacheNode.nodeClass === NodeClass.Variable) {
                const cacheNodeVariable = (cacheNode as CacheNodeVariable);
                node["@"].dataType = DataType[cacheNodeVariable.dataValue.value.dataType];
                if (typeof cacheNodeVariable.dataValue.value.value !== "object") {
                    node["#"] = cacheNodeVariable.dataValue.value.value;
                } else {
                    node.value = cacheNodeVariable.dataValue.value.value;
                }
            }
            const myUserData = {
                onBrowse,
                root: node,
            };
            (userData as any).root[cacheNode.browseName.name.toString()] = node;
            if (cacheNode.nodeClass === NodeClass.Variable) {
                return;
            }
            NodeCrawler.follow(crawler, cacheNode, myUserData, "Organizes", BrowseDirection.Forward);
            NodeCrawler.follow(crawler, cacheNode, myUserData, "HasComponent", BrowseDirection.Forward);
            NodeCrawler.follow(crawler, cacheNode, myUserData, "HasProperty", BrowseDirection.Forward);
        }

        const client = OPCUAClient.create({ endpointMustExist: false });
        client.on("backoff", () => { console.log("keep trying to connect"); });
        const pojo = await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {
            const crawler = new NodeCrawler(session);
            const userData = { onBrowse, root: {} };
            await crawler.crawl(nodeId, userData);
            return userData.root;
        });
        //xx console.log(JSON.stringify(pojo, null, " "));
        console.log(js2xml.parse("data", pojo));
    } catch (err) {
        console.log(err);
        process.exit(1);
    }
})();

