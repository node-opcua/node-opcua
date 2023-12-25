export type NodesetName =
    | "standard"
    | "di"
    | "adi"
    | "autoId"
    | "commercialKitchenEquipment"
    | "cnc"
    | "gds"
    | "glass"
    | "ia"
    | "iolink"
    | "iolinkIODD"
    | "irdi"
    | "machinery"
    | "machineryProcessValues"
    | "machineryResult"
    | "machineTool"
    | "machineVision"
    | "packML"
    | "padim"
    | "robotics"
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
};

export const nodesetCatalog = <[NodesetName, string, string, string, NodesetName[], boolean?][]>[
    ["standard", "ua", "http://opcfoundation.org/UA/", "Opc.Ua.NodeSet2.xml", []],
    ["di", "di", "http://opcfoundation.org/UA/DI/", "Opc.Ua.Di.NodeSet2.xml", []],
    ["adi", "adi", "http://opcfoundation.org/UA/ADI/", "Opc.Ua.Adi.NodeSet2.xml", ["di"]],
    ["autoId", "auto-id", "http://opcfoundation.org/UA/AutoID/", "Opc.Ua.AutoID.NodeSet2.xml", ["di"]],
    ["machineVision", "machine-vision", "http://opcfoundation.org/UA/MachineVision", "Opc.Ua.MachineVision.NodeSet2.xml", []],
    [
        "commercialKitchenEquipment",
        "commercial-kitchen-equipment",
        "http://opcfoundation.org/UA/CommercialKitchenEquipment/",
        "Opc.Ua.CommercialKitchenEquipment.NodeSet2.xml",
        ["di"]
    ],
    ["gds", "gds", "http://opcfoundation.org/UA/GDS/", "Opc.Ua.Gds.NodeSet2.xml", []],
    ["robotics", "robotics", "http://opcfoundation.org/UA/Robotics/", "Opc.Ua.Robotics.NodeSet2.xml", ["di"]],
    ["machinery", "machinery", "http://opcfoundation.org/UA/Machinery/", "Opc.Ua.Machinery.NodeSet2.xml", []],
    ["ia", "ia", "http://opcfoundation.org/UA/IA/", "Opc.Ua.IA.NodeSet2.xml", ["di"]],
    [
        "machineTool",
        "machine-tool",
        "http://opcfoundation.org/UA/MachineTool/",
        "Opc.Ua.MachineTool.NodeSet2.xml",
        ["di", "machinery", "ia"]
    ],
    ["cnc", "cnc", "http://opcfoundation.org/UA/CNC", "Opc.Ua.CNC.NodeSet.xml", []],
    [
        "woodWorking",
        "woodworking",
        "http://opcfoundation.org/UA/Woodworking/",
        "Opc.Ua.Woodworking.NodeSet2.xml",
        ["di", "machinery"]
    ],
    ["glass", "glass-flat", "http://opcfoundation.org/UA/Glass/Flat/", "Opc.Ua.Glass.NodeSet2.xml", ["di", "machinery"]],
    ["tightening", "ijt", "http://opcfoundation.org/UA/IJT/", "Opc.Ua.Ijt.Tightening.NodeSet2.xml", ["di", "machinery"]],
    ["packML", "pack-ml", "http://opcfoundation.org/UA/PackML/", "Opc.Ua.PackML.NodeSet2.xml", []],

    ["iolink", "io-link", "http://opcfoundation.org/UA/IOLink/", "Opc.Ua.IOLink.NodeSet2.xml", ["di"]],
    ["iolinkIODD", "io-link-iodd", "http://opcfoundation.org/UA/IOLink/IODD/", "Opc.Ua.IOLinkIODD.NodeSet2.xml", []],
    ["irdi", "irdi", "http://opcfoundation.org/UA/Dictionary/IRDI", "Opc.Ua.IRDI.NodeSet2.xml", []],
    ["padim", "padim", "http://opcfoundation.org/UA/PADIM/", "Opc.Ua.PADIM.NodeSet2.xml", ["irdi", "di"]],
    [
        "machineryProcessValues",
        "machinery-process-values",
        "http://opcfoundation.org/UA/Machinery/ProcessValues/",
        "Opc.Ua.Machinery.ProcessValues.NodeSet2.xml",
        ["di", "irdi", "padim"]
    ],
    [
        "machineryResult",
        "machinery-result",
        "http://opcfoundation.org/UA/Machinery/Result/",
        "Opc.Ua.Machinery.Result.NodeSet2.xml",
        []
    ]
];
