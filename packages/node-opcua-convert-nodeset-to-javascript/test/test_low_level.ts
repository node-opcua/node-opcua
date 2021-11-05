import * as should from "should";
import { coerceQualifiedName, NodeClass } from "node-opcua-data-model";
import { AddressSpace, PseudoSession, UAObjectType, UAVariable } from "node-opcua-address-space";
import { coerceNodeId, NodeId} from "node-opcua-nodeid";
import { generateAddressSpace } from "node-opcua-address-space/distNodeJS";
import { resolveNodeId } from "node-opcua-nodeid";
import { ObjectIds, VariableIds, ObjectTypeIds } from "node-opcua-constants";
import { make_debugLog} from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import { DataTypeDefinition } from "node-opcua-types";
import { IBasicSession } from "node-opcua-pseudo-session";

import { makeTypeNameNew, constructCache, Cache2 } from "../dist/private-stuff";
import { extractClassMemberDef, extractClassDefinition } from "..";
const debugLog = make_debugLog("TEST");

describe("Test low level routine for typescript d.ts creation", () => {
    let addressSpace: AddressSpace;
    let session: IBasicSession;
    let cache: Cache2;

    let nsADI = 0;
    let spectrometerDeviceTypeNode: UAObjectType;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard, 
            nodesets.di, 
            nodesets.adi, 
            nodesets.commercialKitchenEquipment
        ]);
        const namespaceArrayVar = addressSpace.findNode("Server_NamespaceArray") as UAVariable;
        if (namespaceArrayVar) {
            namespaceArrayVar.setValueFromSource({
                dataType: "String",
                value: addressSpace.getNamespaceArray().map((n) => n.namespaceUri)
            });
        }
        session = new PseudoSession(addressSpace);
        cache = await constructCache(session, {
            baseFolder: "_tmp",
            prefix: "node-opcua-nodeset-"
        });

        nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        if(nsADI <=0) throw new Error("Cannot find ADI ");
        spectrometerDeviceTypeNode = addressSpace.findObjectType("SpectrometerDeviceType", nsADI)!; 
        if (!spectrometerDeviceTypeNode) throw new Error("cannot find SpectrometerDeviceType");
    });
    after(() => {
        addressSpace.dispose();
    });


    it("LL-1 - makeTypeName", async () => {

        const a = makeTypeNameNew(
            NodeClass.Object,
            new DataTypeDefinition({}),
            coerceQualifiedName("Foo"));
        a.should.eql({module:"UAFoo", name: "UAFoo" , namespace: 0});
    });
    it("LL-2 - getTypescriptType ", async () => {

        const nodeId = resolveNodeId(ObjectIds.PubSubDiagnosticsWriterGroupType_Counters);

        const parentNodeId = resolveNodeId(ObjectTypeIds.PubSubDiagnosticsWriterGroupType);
        const classDef = await extractClassDefinition(session, parentNodeId, cache);
        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.browseName.toString().should.eql("Counters");
        //xx a.parentBrowseName.toString().should.eql("PubSubDiagnosticsWriterGroupType");
        //xx a.parentName.toString().should.eql("PubSubDiagnosticsWriterGroupType");
        //xx a.innerClass.should.eql("UAPubSubDiagnosticsWriterGroup_Counters");

        a.name.should.eql("counters");


        a.nodeClass.should.eql(NodeClass.Object);

    })

    it("LL-3 - getTypescriptType ", async () => {

        const nodeId = resolveNodeId(ObjectIds.PubSubDiagnosticsWriterGroupType_LiveValues);

        const parentNodeId = resolveNodeId(ObjectTypeIds.PubSubDiagnosticsWriterGroupType);
        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.browseName.toString().should.eql("LiveValues");
        a.nodeClass.should.eql(NodeClass.Object);

        //xx a.parentBrowseName.toString().should.eql("PubSubDiagnosticsWriterGroupType");
        //Xx a.parentName.toString().should.eql("PubSubDiagnosticsWriterGroupType");
        //xx a.innerClass.should.eql("UAPubSubDiagnosticsWriterGroup_LiveValues");

        a.name.should.eql("liveValues");

        //xx  a.childBase.should.eql("UAObject");
    })
    it("LD-4", async () => {

        const nodeId = resolveNodeId(VariableIds.PubSubDiagnosticsType_DiagnosticsLevel);

        const parentNodeId = resolveNodeId(ObjectTypeIds.PubSubDiagnosticsType);
        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("diagnosticsLevel");
        a.nodeClass.should.eql(NodeClass.Variable);
        a.childType.name.should.eql("UABaseDataVariable");
    })
    xit("LD-5", async () => {

        const nodeId = resolveNodeId(ObjectIds.PubSubDiagnosticsType_Counters);

        const parentNodeId = resolveNodeId(ObjectTypeIds.PubSubDiagnosticsType);
        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("counters");
        a.nodeClass.should.eql(NodeClass.Object);
        a.childType.name.should.eql("UAObject");
        a.childType.module.should.eql("UAObject");
        should.exist(a.innerClass);
    });
    it("LD-6", async ()=> {
        
        const nodeId = resolveNodeId(VariableIds.ProgramStateMachineType_CurrentState);

        const parentNodeId = resolveNodeId(ObjectTypeIds.ProgramStateMachineType);
        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("currentState");
        a.nodeClass.should.eql(NodeClass.Variable);
        a.childType.name.should.eql("UAProgramStateMachine_currentState");
        a.childType.module.should.eql("UAProgramStateMachine");
        should.exist(a.innerClass);

    });
    it("LD-7", async ()=>{

        const nodeId = spectrometerDeviceTypeNode.getChildByName("ParameterSet", nsADI)!.nodeId;

        const parentNodeId = spectrometerDeviceTypeNode.nodeId;
        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);
        a.name.should.eql("parameterSet");
        a.nodeClass.should.eql(NodeClass.Object);
        a.childType.name.should.eql("UASpectrometerDevice_parameterSet");
       // a.childType.module.should.eql("UAProgramStateMachine");
       // should.exist(a.innerClass);
    });
    xit("LD-8", async ()=>{

        const nsKitchen = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
        const combiSteamerDeviceType = addressSpace.findNode(coerceNodeId("i=1011",nsKitchen))!;
        const parentNodeId = combiSteamerDeviceType.nodeId;
        const nodeId = combiSteamerDeviceType.getChildByName("CombiSteamer", nsKitchen)!.nodeId;

        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("combiSteamer");
        a.nodeClass.should.eql(NodeClass.Object);
        a.childType.name.should.eql("UACombiSteamerDevice_combiSteamer");
        a.childType.module.should.eql("UACombiSteamerDevice");
        should.exist(a.innerClass);

    });
    it("LD-9" , async ()=>{
        // UAAccessorySlotStateMachine_powerup
        const accessorySlotStateMachine = addressSpace.findObjectType("AccessorySlotStateMachineType", nsADI)!;
        const parentNodeId = accessorySlotStateMachine.nodeId;
        const nodeId = accessorySlotStateMachine.getChildByName("Powerup", nsADI)!.nodeId;

        const classDef = await extractClassDefinition(session, parentNodeId, cache);
        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("powerup");
        a.nodeClass.should.eql(NodeClass.Object);
        // note : we don't want a extra class here like UAAccessorySlotStateMachine_powerup
        //        as the variable exposed like stateNumber variable are MANDATORY as it was also in the
        //        base class...
        a.childType.name.should.eql("UAInitialState");
        should.not.exist(a.innerClass);

    })

    it("LD-A", async() =>{
        const accessorySlotStateMachine = addressSpace.findObjectType("AccessorySlotStateMachineType", nsADI)!;
        const parentNodeId = accessorySlotStateMachine.nodeId;
        const classDef = await extractClassDefinition(session, parentNodeId, cache);
    
   //     debugLog(JSON.stringify(classDef, null, " "));

    });
    it("LD-B checkIfShouldExposeInnerDefinition", ()=>{

      ///  checkIfShouldExposeInnerDefinition()
    })
    it("LD-C UASessionDiagnosticsVariable",async ( )=>{
        const sessionDiagnosticsVariable = addressSpace.findVariableType("SessionDiagnosticsVariableType", 0)!;
        const parentNodeId = sessionDiagnosticsVariable.nodeId;
        const classDef = await extractClassDefinition(session, parentNodeId, cache)!;
        // console.log(classDef);
        classDef.baseInterfaceName!.name.should.eql("UABaseDataVariable");
    });
});