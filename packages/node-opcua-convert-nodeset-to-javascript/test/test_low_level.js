const { coerceQualifiedName, NodeClass } = require("node-opcua-data-model");
const { AddressSpace, PseudoSession } = require("node-opcua-address-space");
const { coerceNodeId} = require("node-opcua-nodeid");
const { generateAddressSpace } = require("node-opcua-address-space/distNodeJS");
const { getFixture } = require("../test_fixtures/helper");
const { resolveNodeId } = require("node-opcua-nodeid");
const { ObjectIds, VariableIds, ObjectTypeIds } = require("node-opcua-constants");
const { nodesets } = require("node-opcua-nodesets");
const { makeTypeNameNew, Cache, constructCache } = require("../dist/cache");
const { extractClassMemberDef, extractClassDefinition } = require("../dist/convert_to_typescript");
const { make_debugLog} = require("node-opcua-debug");


const should= require("should");
const debugLog = make_debugLog("TEST");

describe("A", () => {
    let addressSpace;
    let session;
    let cache;

    let nsADI = 0;
    let spectrometerDeviceTypeNode;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [
            nodesets.standard, 
            nodesets.di, 
            nodesets.adi, 
            nodesets.commercialKitchenEquipment
        ]);
        const namespaceArrayVar = addressSpace.findNode("Server_NamespaceArray");
        if (namespaceArrayVar) {
            namespaceArrayVar.setValueFromSource({
                dataType: "String",
                value: addressSpace.getNamespaceArray().map((n) => n.namespaceUri)
            });
        }
        session = new PseudoSession(addressSpace);
        cache = await constructCache(session);

        nsADI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/ADI/");
        if(nsADI <=0) throw new Error("Cannot find ADI ");
        spectrometerDeviceTypeNode = addressSpace.findObjectType("SpectrometerDeviceType", nsADI); 
        if (!spectrometerDeviceTypeNode) throw new Error("cannot find SpectrometerDeviceType");
    });
    after(() => {
        addressSpace.dispose();
    });


    it("LLB - makeTypeName", async () => {

        const cache = undefined;
        const a = makeTypeNameNew(
            NodeClass.Object,
            "",
            coerceQualifiedName("Foo"));
        a.should.eql({module:"UAFoo", name: "UAFoo" , namespace: 0});
    });
    it("LLC - getTypescriptType ", async () => {

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

    it("LLD - getTypescriptType ", async () => {

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
    it("LDE", async () => {

        const nodeId = resolveNodeId(VariableIds.PubSubDiagnosticsType_DiagnosticsLevel);

        const parentNodeId = resolveNodeId(ObjectTypeIds.PubSubDiagnosticsType);
        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("diagnosticsLevel");
        a.nodeClass.should.eql(NodeClass.Variable);
        a.childType.name.should.eql("UABaseDataVariable");
    })
    xit("LDF", async () => {

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
    it("LDG", async ()=> {
        
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
    it("LDH", async ()=>{

        const nodeId = spectrometerDeviceTypeNode.getChildByName("ParameterSet", nsADI).nodeId;

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
    xit("LDI", async ()=>{

        const nsKitchen = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
        const combiSteamerDeviceType = addressSpace.findNode(coerceNodeId("i=1011",nsKitchen));
        const parentNodeId = combiSteamerDeviceType.nodeId;
        const nodeId = combiSteamerDeviceType.getChildByName("CombiSteamer", nsKitchen).nodeId;

        const classDef = await extractClassDefinition(session, parentNodeId, cache);

        const a = await extractClassMemberDef(session, nodeId, classDef, cache);
        debugLog(a);

        a.name.should.eql("combiSteamer");
        a.nodeClass.should.eql(NodeClass.Object);
        a.childType.name.should.eql("UACombiSteamerDevice_combiSteamer");
        a.childType.module.should.eql("UACombiSteamerDevice");
        should.exist(a.innerClass);

    });
    it("LDY" , async ()=>{
        // UAAccessorySlotStateMachine_powerup
        const accessorySlotStateMachine = addressSpace.findObjectType("AccessorySlotStateMachineType", nsADI);
        const parentNodeId = accessorySlotStateMachine.nodeId;
        const nodeId = accessorySlotStateMachine.getChildByName("Powerup", nsADI).nodeId;

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

    it("YH1", async() =>{
        const accessorySlotStateMachine = addressSpace.findObjectType("AccessorySlotStateMachineType", nsADI);
        const parentNodeId = accessorySlotStateMachine.nodeId;
        const classDef = await extractClassDefinition(session, parentNodeId, cache);
    
   //     debugLog(JSON.stringify(classDef, null, " "));

    });
    it("checkIfShouldExposeInnerDefinition", ()=>{

      ///  checkIfShouldExposeInnerDefinition()
    })
});