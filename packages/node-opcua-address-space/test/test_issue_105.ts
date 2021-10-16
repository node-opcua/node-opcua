import * as should from "should";
import { AddressSpace, Namespace } from "../";
import { assertHasMatchingReference, getMiniAddressSpace } from "../testHelpers";

const createTemperatureSensorType = require("./fixture_temperature_sensor_type").createTemperatureSensorType;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/105", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();

        namespace = addressSpace.getOwnNamespace();

        // let's declare a custom folder Type
        const myFolderType = namespace.addObjectType({ browseName: "MyFolderType", subtypeOf: "FolderType" });
        myFolderType.browseName.toString().should.eql("1:MyFolderType");
        myFolderType.subtypeOfObj!.browseName.toString().should.eql("FolderType");
    });
    after(async () => {
        addressSpace?.dispose();
    });

    it("should be possible to create an object organized by a folder whose type is a subtype of FolderType", () => {
        const temperatureSensorType = createTemperatureSensorType(addressSpace);

        const myFolderType = addressSpace.findObjectType("MyFolderType", addressSpace.getOwnNamespace().index)!;

        // now create a folder of type MyFolderType inside the Objects Folder
        const myFolder = myFolderType.instantiate({ browseName: "MyFolder", organizedBy: "ObjectsFolder" });

        // now create a simple var inside the new folder (method 1)
        const myObject = namespace.addVariable({
            browseName: "Obj1",
            dataType: "Double",
            organizedBy: myFolder
        });
        myObject.browseName.toString().should.eql("1:Obj1");

        // now create a simple var inside the new folder (method 2)
        const myObject2 = temperatureSensorType.instantiate({ browseName: "Obj2", organizedBy: myFolder });

        myObject2.browseName.toString().should.eql("1:Obj2");

        assertHasMatchingReference(myFolder, { referenceType: "Organizes", nodeId: myObject2.nodeId });
    });
});
