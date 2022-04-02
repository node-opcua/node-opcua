/* eslint-disable max-statements */
import "should";
import * as sinon from "sinon";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";

import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../distNodeJS";

describe("testing extension object binding", function () {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.ia, nodesets.cnc]);
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should bind an extension object in a Variable", () => {
        const nsCNC = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CNC");
        const cncChannelType = addressSpace.findObjectType("CncChannelType", nsCNC);
        if (!cncChannelType) throw new Error("Cannot find CncChannelType");
        const channel = cncChannelType.instantiate({
            browseName: "MyChannel",
            organizedBy: addressSpace.rootFolder.objects
        });
        const cncPositionDataType = addressSpace.findDataType("CncPositionDataType", nsCNC)!;
        const posTcpBcsX = channel.getComponentByName("PosTcpBcsX")! as UAVariable;

        posTcpBcsX.readValue().value.value.actPos.should.eql(0);
        posTcpBcsX.readValue().value.value.cmdPos.should.eql(0);
        posTcpBcsX.readValue().value.value.remDist.should.eql(0);

        const tmp_extObj: any = addressSpace.constructExtensionObject(cncPositionDataType, {
            actPos: 0,
            cmdPos: 0,
            remDist: 0
        });
        tmp_extObj.actPos.should.eql(0);
        tmp_extObj.cmdPos.should.eql(0);
        tmp_extObj.remDist.should.eql(0);

        posTcpBcsX.bindExtensionObject(tmp_extObj);

        if (tmp_extObj !== (posTcpBcsX as any).$dataValue.value.value) {
            console.log("Something goes wrong 1");
        }

        if (posTcpBcsX.$extensionObject !== (posTcpBcsX as any).$dataValue.value.value) {
            console.log("Something goes wrong 2");
        }

        //-----------------------------------
        posTcpBcsX.$extensionObject.actPos = 20;
        posTcpBcsX.$extensionObject.cmdPos = 30;
        posTcpBcsX.$extensionObject.remDist = 40;
        posTcpBcsX.touchValue();

        console.log(posTcpBcsX.readValue().toString());
        console.log(posTcpBcsX.$extensionObject.toString());

        posTcpBcsX.readValue().value.value.actPos.should.eql(20);
        posTcpBcsX.readValue().value.value.cmdPos.should.eql(30);
        posTcpBcsX.readValue().value.value.remDist.should.eql(40);

        // now change value from the internal properties
        const changeSpy1 = sinon.spy();
        posTcpBcsX.on("value_changed", changeSpy1);

        const actPos = posTcpBcsX.getComponentByName("ActPos")! as UAVariable;
        const cmdPos = posTcpBcsX.getComponentByName("CmdPos")! as UAVariable;
        const remDist = posTcpBcsX.getComponentByName("RemDist")! as UAVariable;

        const changeSpyActPos = sinon.spy();
        actPos.on("value_changed", changeSpyActPos);

        const changeSpyCmdPos = sinon.spy();
        cmdPos.on("value_changed", changeSpyCmdPos);

        const changeSpyRemDist = sinon.spy();
        remDist.on("value_changed", changeSpyRemDist);

        actPos.setValueFromSource({ dataType: DataType.Double, value: 100 });

        posTcpBcsX.readValue().value.value.actPos.should.eql(100);
        posTcpBcsX.readValue().value.value.cmdPos.should.eql(30);
        posTcpBcsX.readValue().value.value.remDist.should.eql(40);

        changeSpy1.callCount.should.eql(1);
        changeSpyActPos.callCount.should.eql(1);
        changeSpyCmdPos.callCount.should.eql(0);
        changeSpyRemDist.callCount.should.eql(0);

        // ----------------------------------------------------------------
        changeSpy1.resetHistory();
        changeSpyActPos.resetHistory();
        changeSpyCmdPos.resetHistory();
        changeSpyRemDist.resetHistory();

        posTcpBcsX.$extensionObject.actPos = -111;
        posTcpBcsX.$extensionObject.cmdPos = -222;
        posTcpBcsX.$extensionObject.remDist = -333;

        changeSpy1.callCount.should.eql(3);
        changeSpyActPos.callCount.should.eql(1);
        changeSpyCmdPos.callCount.should.eql(1);
        changeSpyRemDist.callCount.should.eql(1);

        posTcpBcsX.readValue().value.value.actPos.should.eql(-111);
        posTcpBcsX.readValue().value.value.cmdPos.should.eql(-222);
        posTcpBcsX.readValue().value.value.remDist.should.eql(-333);

        // ----------------------------------------------------------------
        // changing the extension object globally
        changeSpy1.resetHistory();
        changeSpyActPos.resetHistory();
        changeSpyCmdPos.resetHistory();
        changeSpyRemDist.resetHistory();

        const extObj2 = addressSpace.constructExtensionObject(cncPositionDataType, {
            actPos: 88,
            cmdPos: 89,
            remDist: 87
        });

        posTcpBcsX.setValueFromSource({ dataType: DataType.ExtensionObject, value: extObj2 });

        posTcpBcsX.readValue().value.value.actPos.should.eql(88);
        posTcpBcsX.readValue().value.value.cmdPos.should.eql(89);
        posTcpBcsX.readValue().value.value.remDist.should.eql(87);

        changeSpy1.callCount.should.eql(1); // should be 1
        
        changeSpyActPos.callCount.should.eql(1);
        changeSpyCmdPos.callCount.should.eql(1);
        changeSpyRemDist.callCount.should.eql(1);
    });
});
