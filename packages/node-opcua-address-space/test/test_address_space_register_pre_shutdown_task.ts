import "should";
import { getMiniAddressSpace } from "../testHelpers";
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

describe("registerShutdownTask", () => {
    it("should run shutdown tasks in correct order", async () => {
        const addressSpace = await getMiniAddressSpace();
        const witness: string[] = [];
        addressSpace.registerShutdownTask(() => witness.push("T1"));
        addressSpace.registerShutdownTask(() => witness.push("T2"));
        await addressSpace.shutdown();
        addressSpace.dispose();
        witness.should.eql(["T1", "T2"]);
    });
});
