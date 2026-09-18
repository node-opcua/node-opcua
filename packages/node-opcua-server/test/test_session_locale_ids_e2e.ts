/**
 * End-to-end: a Client that activates a Session with a non-empty localeIds makes them
 * available, through the Session's SessionContext, to a bound Method handler running on the
 * Server, and keeps them when a later ActivateSession sends none (OPC 10000-4 v1.05.07 §5.7.3:
 * "If it is null or empty the Server shall keep using the current localeIds for the Session").
 */
import type { ISessionContext } from "node-opcua-address-space";
import { OPCUAClient } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, type Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import "should";
import { OPCUAServer } from "../source/index.js";

const port = 5815;

describe("Session localeIds end-to-end (OPC 10000-4 v1.05.07 §5.7.3)", function (this: Mocha.Suite) {
    this.timeout(60_000);

    let server: OPCUAServer;
    let endpointUrl: string;
    let objectNodeId: NodeId;
    let methodNodeId: NodeId;

    before(async () => {
        server = new OPCUAServer({ port });
        await server.initialize();

        const addressSpace = server.engine.addressSpace;
        if (!addressSpace) throw new Error("addressSpace is null");
        const namespace = addressSpace.getOwnNamespace();

        const object = namespace.addObject({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "LocaleProbe"
        });
        const method = namespace.addMethod(object, {
            browseName: "GetPreferredLocales",
            outputArguments: [
                {
                    name: "Locales",
                    description: { text: "the calling Session's preferred locales" },
                    dataType: DataType.String,
                    valueRank: 1
                }
            ]
        });
        method.bindMethod(async (_inputArguments: Variant[], context?: ISessionContext) => ({
            statusCode: StatusCodes.Good,
            outputArguments: [
                {
                    dataType: DataType.String,
                    arrayType: VariantArrayType.Array,
                    value: context?.getPreferredLocales() ?? []
                }
            ]
        }));

        objectNodeId = object.nodeId;
        methodNodeId = method.nodeId;

        await server.start();
        endpointUrl = server.getEndpointUrl();
    });

    after(async () => {
        await server.shutdown();
    });

    it("a Client activating with localeIds ['fr-FR', 'en'] sees them through context.getPreferredLocales(), including after reactivateSession", async () => {
        const activateSessionLocaleIds: unknown[] = [];
        const onRequest = (request: { schema?: { name?: string }; localeIds?: unknown }) => {
            if (request?.schema?.name === "ActivateSessionRequest") {
                activateSessionLocaleIds.push(request.localeIds);
            }
        };
        server.on("request", onRequest);

        const client = OPCUAClient.create({
            endpointMustExist: false,
            localeIds: ["fr-FR", "en"]
        });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession();
            try {
                const result = await session.call({
                    objectId: objectNodeId,
                    methodId: methodNodeId,
                    inputArguments: []
                });
                should(result.statusCode).eql(StatusCodes.Good);
                should(result.outputArguments?.[0]?.value).eql(["fr-FR", "en"]);

                // OPC 10000-4 v1.05.07 §5.7.3 localeIds is only *required* on the first
                // ActivateSession, but node-opcua's Client sends it on every one, including a
                // reactivation, so the Session's preferred locales survive a reconnect.
                await client.reactivateSession(session);

                const result2 = await session.call({
                    objectId: objectNodeId,
                    methodId: methodNodeId,
                    inputArguments: []
                });
                should(result2.outputArguments?.[0]?.value).eql(["fr-FR", "en"]);
            } finally {
                await session.close();
            }
        } finally {
            server.removeListener("request", onRequest);
            await client.disconnect();
        }

        should(activateSessionLocaleIds.length).eql(
            2,
            "the initial ActivateSession and reactivateSession should both hit the wire"
        );
        should(activateSessionLocaleIds[0]).eql(["fr-FR", "en"]);
        should(activateSessionLocaleIds[1]).eql(["fr-FR", "en"]);
    });

    it("a Client with no localeIds configured leaves the Session with none", async () => {
        const client = OPCUAClient.create({ endpointMustExist: false });
        await client.connect(endpointUrl);
        try {
            const session = await client.createSession();
            try {
                const result = await session.call({
                    objectId: objectNodeId,
                    methodId: methodNodeId,
                    inputArguments: []
                });
                should(result.outputArguments?.[0]?.value).eql([]);
            } finally {
                await session.close();
            }
        } finally {
            await client.disconnect();
        }
    });
});
