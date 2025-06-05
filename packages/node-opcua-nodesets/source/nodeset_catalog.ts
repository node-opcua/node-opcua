export type NodesetName =
    | "standard"
    | "di"
    | "amb"
    | "adi"
    | "autoId"
    | "commercialKitchenEquipment"
    | "cnc"
    | "gds"
    | "glass"
    | "ia"
    | "iolink"
    | "iolinkIODD"
    | "ijtBase"
    | "irdi"
    | "isa95JobControl"
    | "machineryJobs"
    | "machinery"
    | "machineryProcessValues"
    | "machineryResult"
    | "machineTool"
    | "machineVision"
    | "metalForming"
    | "packML"
    | "padim"
    | "robotics"
    | "scales"
    | "tightening"
    | "woodWorking";

export type NodesetMeta = {
    /// used as key in exported nodesets object as well as in index_web.js
    name: NodesetName;
    /// `node-opcua-nodeset-${...}`
    packageName: string;
    /// the official namespace URI
    uri: string;
    /// path to local NodeSet2 XML file
    xmlFile: string;
    dependencies: NodesetName[];

    // the licence applicable to the typescript definition file
    // "DUAL" means that the generated module is dual licenced under the Open Source APGL3
    // and the commercial license
    // MIT means that the generated module is licenced under the MIT license
    licence?: "DUAL" | "MIT";
};
export const nodesetCatalog: NodesetMeta[] = [
    {
        name: 'standard',
        packageName: 'ua',
        uri: 'http://opcfoundation.org/UA/',
        xmlFile: 'Opc.Ua.NodeSet2.xml',
        dependencies: [],
        licence: "MIT"
    },
    {
        name: 'di',
        packageName: 'di',
        uri: 'http://opcfoundation.org/UA/DI/',
        xmlFile: 'Opc.Ua.Di.NodeSet2.xml',
        dependencies: [],
        licence: "MIT"
    },
    {
        name: 'adi',
        packageName: 'adi',
        uri: 'http://opcfoundation.org/UA/ADI/',
        xmlFile: 'Opc.Ua.Adi.NodeSet2.xml',
        dependencies: ['di'],
        licence: "MIT"
    },
    {
        name: 'autoId',
        packageName: 'auto-id',
        uri: 'http://opcfoundation.org/UA/AutoID/',
        xmlFile: 'Opc.Ua.AutoID.NodeSet2.xml',
        dependencies: ['di'],
        licence: "MIT"
    },
    {
        name: 'machineVision',
        packageName: 'machine-vision',
        uri: 'http://opcfoundation.org/UA/MachineVision',
        xmlFile: 'Opc.Ua.MachineVision.NodeSet2.xml',
        dependencies: [],
        licence: "MIT"
    },
    {
        name: 'commercialKitchenEquipment',
        packageName: 'commercial-kitchen-equipment',
        uri: 'http://opcfoundation.org/UA/CommercialKitchenEquipment/',
        xmlFile: 'Opc.Ua.CommercialKitchenEquipment.NodeSet2.xml',
        dependencies: ['di'],
        licence: "MIT"
    },
    {
        name: 'amb',
        packageName: 'amb',
        uri: 'http://opcfoundation.org/UA/AMB/',
        xmlFile: 'Opc.Ua.AMB.NodeSet2.xml',
        dependencies: [],
        licence: "DUAL"
    },
    {
        name: 'gds',
        packageName: 'gds',
        uri: 'http://opcfoundation.org/UA/GDS/',
        xmlFile: 'Opc.Ua.Gds.NodeSet2.xml',
        dependencies: [],
        licence: "DUAL"
    },
    {
        name: 'robotics',
        packageName: 'robotics',
        uri: 'http://opcfoundation.org/UA/Robotics/',
        xmlFile: 'Opc.Ua.Robotics.NodeSet2.xml',
        dependencies: ['di'],
        licence: "MIT"

    },
    {
        name: 'isa95JobControl',
        packageName: 'isa-95-jobcontrol-v-2',
        uri: 'http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/',
        xmlFile: 'opc.ua.isa95-jobcontrol.nodeset2.xml',
        dependencies: [],
        licence: "DUAL"
    },
    {
        name: 'machineryJobs',
        packageName: 'machinery-jobs',
        uri: 'http://opcfoundation.org/UA/Machinery/Jobs/',
        xmlFile: 'Opc.Ua.Machinery.Jobs.Nodeset2.xml',
        dependencies: ['isa95JobControl'],
        licence: "DUAL"

    },
    {
        name: 'machineryResult',
        packageName: 'machinery-result',
        uri: 'http://opcfoundation.org/UA/Machinery/Result/',
        xmlFile: 'Opc.Ua.Machinery_Result.NodeSet2.xml',
        dependencies: [],
        licence: "DUAL"

    },
    {
        name: 'machinery',
        packageName: 'machinery',
        uri: 'http://opcfoundation.org/UA/Machinery/',
        xmlFile: 'Opc.Ua.Machinery.NodeSet2.xml',
        dependencies: ['machineryJobs', 'isa95JobControl'],
        licence: "DUAL"
    },
    {
        name: 'ia',
        packageName: 'ia',
        uri: 'http://opcfoundation.org/UA/IA/',
        xmlFile: 'Opc.Ua.IA.NodeSet2.xml',
        dependencies: ['di'],
        licence: "DUAL"

    },
    {
        name: 'machineTool',
        packageName: 'machine-tool',
        uri: 'http://opcfoundation.org/UA/MachineTool/',
        xmlFile: 'Opc.Ua.MachineTool.NodeSet2.xml',
        dependencies: ['di', 'machinery', 'ia'],
        licence: "DUAL"
    },
    {
        name: 'cnc',
        packageName: 'cnc',
        uri: 'http://opcfoundation.org/UA/CNC',
        xmlFile: 'Opc.Ua.CNC.NodeSet.xml',
        dependencies: [],
        licence: "DUAL"
    },
    {
        name: 'woodWorking',
        packageName: 'woodworking',
        uri: 'http://opcfoundation.org/UA/Woodworking/',
        xmlFile: 'Opc.Ua.Woodworking.NodeSet2.xml',
        dependencies: ['di', 'machinery'],
        licence: "DUAL"
    },
    {
        name: 'glass',
        packageName: 'glass-flat',
        uri: 'http://opcfoundation.org/UA/Glass/Flat/',
        xmlFile: 'Opc.Ua.Glass.NodeSet2.xml',
        dependencies: ['di', 'machinery'],
        licence: "DUAL"
    },
    {
        name: 'ijtBase',
        packageName: 'ijt-base',
        uri: 'http://opcfoundation.org/UA/IJT/Base/',
        xmlFile: 'Opc.Ua.Ijt.Base.NodeSet2.xml',
        dependencies: ['machineryResult', 'di', 'machinery', 'amb'],
        licence: "DUAL"
    },
    {
        name: 'tightening',
        packageName: 'ijt-tightening',
        uri: 'http://opcfoundation.org/UA/IJT/Tightening/',
        xmlFile: 'Opc.Ua.Ijt.Tightening.NodeSet2.xml',
        dependencies: ['machineryResult', 'di', 'machinery', 'ijtBase', 'amb'],
        licence: "DUAL"

    },
    {
        name: 'packML',
        packageName: 'pack-ml',
        uri: 'http://opcfoundation.org/UA/PackML/',
        xmlFile: 'Opc.Ua.PackML.NodeSet2.xml',
        dependencies: [],
        licence: "DUAL"

    },
    {
        name: 'iolink',
        packageName: 'io-link',
        uri: 'http://opcfoundation.org/UA/IOLink/',
        xmlFile: 'Opc.Ua.IOLink.NodeSet2.xml',
        dependencies: ['di'],
        licence: "DUAL"
    },
    {
        name: 'iolinkIODD',
        packageName: 'io-link-iodd',
        uri: 'http://opcfoundation.org/UA/IOLink/IODD/',
        xmlFile: 'Opc.Ua.IOLinkIODD.NodeSet2.xml',
        dependencies: [],
        licence: "DUAL"
    },
    {
        name: 'irdi',
        packageName: 'irdi',
        uri: 'http://opcfoundation.org/UA/Dictionary/IRDI',
        xmlFile: 'Opc.Ua.IRDI.NodeSet2.xml',
        dependencies: []

    },
    {
        name: 'padim',
        packageName: 'padim',
        uri: 'http://opcfoundation.org/UA/PADIM/',
        xmlFile: 'Opc.Ua.PADIM.NodeSet2.xml',
        dependencies: ['irdi', 'di'],
        licence: "DUAL"
    },
    {
        name: 'machineryProcessValues',
        packageName: 'machinery-process-values',
        uri: 'http://opcfoundation.org/UA/Machinery/ProcessValues/',
        xmlFile: 'Opc.Ua.Machinery.ProcessValues.NodeSet2.xml',
        dependencies: ['di', 'irdi', 'padim'],
        licence: "DUAL"
    },
    {
        name: 'metalForming',
        packageName: 'metal-forming',
        uri: 'http://opcfoundation.org/UA/MetalForming/',
        xmlFile: 'Opc.Ua.MetalForming.NodeSet2.xml',
        dependencies: [
            'di',
            'ia',
            'machinery',
            'irdi',
            'padim',
            'machineryProcessValues',
            'machineTool'
        ],
        licence: "DUAL"
    },
    {
        /**
         *     
         *      <Uri>http://opcfoundation.org/UA/Scales/V2/</Uri>
                <Uri>http://opcfoundation.org/UA/IA/</Uri>
                <Uri>http://opcfoundation.org/UA/DI/</Uri>
                <Uri>http://opcfoundation.org/UA/Machinery/</Uri>
                <Uri>http://opcfoundation.org/UA/PackML/</Uri>
         */
        name: "scales",
        packageName: "scales-v-2",
        uri: "http://opcfoundation.org/UA/Scales/V2/",
        xmlFile: "Opc.Ua.Scales.NodeSet2.xml",
        dependencies: ['di', 'ia', 'machinery', 'packML'],
        licence: "DUAL"
    }

];

