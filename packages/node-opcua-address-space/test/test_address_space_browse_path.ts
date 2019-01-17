// tslint:disable:no-console
import * as should from "should";

import { getMiniAddressSpace } from "../";

import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { AddressSpace, Namespace } from "..";
import { add_eventGeneratorObject } from "../";

const doDebug = false;

describe("AddressSpace#browsePath", () => {

    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        namespace.namespaceUri.should.eql("http://MYNAMESPACE");
        // Add EventGeneratorObject
        add_eventGeneratorObject(namespace, "ObjectsFolder");
    });

    after(() => {
        addressSpace.dispose();
    });

    it("should browse Server", () => {

        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            console.log((result as any).toString(opts));
        }
    });
    it("should browse Status", () => {

        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server/ServerStatus");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            console.log((result as any).toString(opts));
        }
    });
    it("#QQ browsing a path when a null target name is not in the last element shall return an error ", () => {

        const browsePath = makeBrowsePath("RootFolder", "/Objects/Server/ServerStatus");
        browsePath.relativePath!.elements![1]!.targetName.toString().should.eql("Server");
        // set a null target Name in the middle of the path
        (browsePath.relativePath.elements![1]! as any).targetName = null;
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadBrowseNameInvalid);
        result.targets!.length.should.eql(0);
    });

    it("should browse EventGeneratorObject", () => {
        const browsePath = makeBrowsePath("RootFolder", "/Objects/1:EventGeneratorObject");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            console.log("browsePath", browsePath.toString(opts));
            console.log("result", result.toString(opts));

            console.log(addressSpace.rootFolder.objects.toString());
        }
    });

    it("should browse MyEventType", () => {

        let browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<HasSubtype>1:MyEventType");
        let result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        result.targets!.length.should.eql(1);

        if (doDebug) {
            const opts = { addressSpace };
            console.log("browsePath", browsePath.toString(opts));
            console.log("result", result.toString(opts));
        }

        const node = addressSpace.findNode(result.targets![0].targetId)!
          .browseName.toString().should.eql("1:MyEventType");

        browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<!HasSubtype>1:MyEventType");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadNoMatch);

        browsePath = makeBrowsePath("RootFolder", "/Types/EventTypes/BaseEventType<#HasSubtype>1:MyEventType");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);

        const evType = addressSpace.findNode(result.targets![0].targetId);

        // rowing upstream
        browsePath = makeBrowsePath(evType, "<!HasSubtype>BaseEventType<!Organizes>EventTypes<!Organizes>Types<!Organizes>Root");
        result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.Good);
        addressSpace.findNode(result.targets![0].targetId)!.browseName.toString().should.eql("Root");

    });
    it("should browse an empty path", () => {

        const rootFolder = addressSpace.rootFolder;
        const browsePath = makeBrowsePath(rootFolder, "");
        const result = addressSpace.browsePath(browsePath);
        result.statusCode.should.eql(StatusCodes.BadNothingToDo);
        result.targets!.length.should.eql(0);
    });
});
