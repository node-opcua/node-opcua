
const path = require("path");
const https = require('https');
let http = require('http');
const fs = require("fs");

const force = true;

function renderProgress(downloadedBytes, totalBytes, file_url) {
    if (totalBytes > 0) {
        const percent = Math.min(100, Math.floor(downloadedBytes * 100 / totalBytes));
        const width = 20;
        const filled = Math.floor((percent * width) / 100);
        const bar = '='.repeat(filled) + ' '.repeat(width - filled);
        process.stdout.write(`  [${bar}] ${percent}% downloading ${file_url}\r`);
    } else {
        process.stdout.write(`  [${downloadedBytes} bytes] downloading ${file_url}\r`);
    }
}

function wget(dest_folder, file_url) {

    dest_folder = dest_folder || "1.02";

    if (!fs.existsSync(dest_folder)) {
        fs.mkdirSync(dest_folder);
    }

    if (file_url.substring(0, 5) === "https") {
        http = https;
    }

    const filename = path.join(dest_folder, path.basename(file_url)); // + path.extname(url);

    if (fs.existsSync(filename) && !force) {
        console.log("  " + filename + " already downloaded " + file_url);
        return;
    }
    console.log(" downloading " + filename + " from " + file_url);

    const stream = fs.createWriteStream(filename, { flag: "w" });

    const request_options = new URL(file_url);

    const req = http.get(request_options, { headers: { 'user-agent': 'Mozilla/5.0' } }, function(response) {
        // handle the response
        let downloadedBytes = 0;
        const contentLength = parseInt(response.headers['content-length'], 10);
        const totalBytes = Number.isFinite(contentLength) ? contentLength : 0;

        response.on('data', function(chunk) {
            downloadedBytes += chunk.length;
            renderProgress(downloadedBytes, totalBytes, file_url);
            stream.write(chunk, "binary");
        });

        response.on('end', function() {
            stream.end();
            renderProgress(downloadedBytes, totalBytes, file_url);
            process.stdout.write('\n');
        });
    });
    req.on('error', function(err) {
        console.log("Request error: " + err.message);
    });
}


/*

File	                              Description                                                                       File Name	                Permanent URL	                                                    Alternate URL
OPC UA XML Type Definitions	          The XML schema for all data types defined in the OPC UA specifications.	        Opc.Ua.Types.xsd	        http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.xsd	        http://opcfoundation.org/UA/2008/02/Types.xsd
OPC UA Service Message Definitions	  The WSDL for all service messages defined in the OPC UA specifications.	        Opc.Ua.Services.wsdl	    http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Services.wsdl	    http://opcfoundation.org/UA/2008/02/Services.wsdl
OPC UA Service Interface Definitions  The WSDL for logical groupings of OPC UA Services.	                            Opc.Ua.Endpoints.wsdl	    http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Endpoints.wsdl	    http://opcfoundation.org/UA/2008/02/Endpoints.wsdl
                                      The XML schema for all data types defined in the DI specification.	            Opc.Ua.Di.Types.xsd	        http://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.Types.xsd	    http://opcfoundation.org/UA/DI/Types.xsd
                                      The XML schema for all data types defined in the ADI specification.     	        Opc.Ua.Adi.Types.xsd	    http://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.Types.xsd	http://opcfoundation.org/UA/ADI/Types.xsd
Secured Application Schema	          The XML schema for import/export of application configuration information.	    SecuredApplication.xsd	    http://opcfoundation.org/UA/schemas/1.02/SecuredApplication.xsd	    http://opcfoundation.org/UA/2011/03/SecuredApplication.xsd

UANodeSet Schema	                  The XML schema used to persist an OPC UA information model.	                    UANodeSet.xsd	            http://opcfoundation.org/UA/schemas/1.02/UANodeSet.xsd	            http://opcfoundation.org/UA/2011/03/UANodeSet.xsd
UANodeSet Schema	                  A support file for the XML schema used to persist an OPC UA information model.	UAVariant.xsd	            http://opcfoundation.org/UA/schemas/1.02/UAVariant.xsd
OPC UA Node Set (All)	              The UANodeSet for all Nodes defined by the OPC UA specifications.	                Opc.Ua.NodeSet2.xml	        http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.xml
OPC UA Node Set (Part 3)	          The UANodeSet for all Nodes defined by Part 3 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part3.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part3.xml
OPC UA Node Set (Part 4)	          The UANodeSet for all Nodes defined by Part 4 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part4.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part4.xml
OPC UA Node Set (Part 5)	          The UANodeSet for all Nodes defined by Part 5 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part5.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part5.xml
OPC UA Node Set (Part 8)	          The UANodeSet for all Nodes defined by Part 8 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part8.xml	http://opcfoundation.org/UA/schemas/Opc.Ua.NodeSet2.Part8.xml
OPC UA Node Set (Part 9)	          The UANodeSet for all Nodes defined by Part 9 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part9.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part9.xml
OPC UA Node Set (Part 10)             The UANodeSet for all Nodes defined by Part 10 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part10.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part10.xml
OPC UA Node Set (Part 11)             The UANodeSet for all Nodes defined by Part 11 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part11.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part11.xml
OPC UA Node Set (Part 13)	          The UANodeSet for all Nodes defined by Part 13 of the OPC UA specification.	    Opc.Ua.NodeSet2.Part13.xml	http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part13.xml
DI NodeSet	                          The UANodeSet for all Nodes defined by the DI specification.	                    Opc.Ua.Di.NodeSet2.xml	    http://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.NodeSet2.xml
ADI NodeSet	                          The UANodeSet for all Nodes defined by the ADI specification.	                    Opc.Ua.Adi.NodeSet2.xml     http://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.NodeSet2.xml

OPC Binary Type Schema	              The XML schema used to describe the layout of binary encoding structures.	        OPC BinarySchema.xsd	    http://opcfoundation.org/UA/schemas/1.02/OPCBinarySchema.xsd	    http://opcfoundation.org/BinarySchema/
OPC UA Binary Type Definitions	      The OPC Binary schema for all data types defined in the OPC UA specifications.	Opc.Ua.Types.bsd	        http://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.bsd
                                      The OPC Binary schema for all data types defined in the DI specification.	        Opc.Ua.Di.Types.bsd	        http://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.Types.bsd	    http://opcfoundation.org/UA/DI/Types.bsd
                                      The OPC Binary schema for all data types defined in the ADI specification.	    Opc.Ua.Adi.Types.bsd	    http://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.Types.bsd	http://opcfoundation.org/UA/ADI/Types.bsd

OPC UA Attribute Ids	              The numeric identifier for all OPC UA Node attributes.	                        AttributeIds.csv	        http://opcfoundation.org/UA/schemas/1.02/AttributeIds.csv
OPC UA Status Codes	                  The numeric identifier for all StatusCodes defined in the OPC UA specifications.  StatusCode.csv	            http://opcfoundation.org/UA/schemas/1.02/StatusCode.csv
OPC UA NodeIds	                      The numeric identifier for all NodeIds defined in the OPC UA specifications.	    NodeIds.csv	                http://opcfoundation.org/UA/schemas/1.02/NodeIds.csv
*/

if (false) {

    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.bsd.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.StatusCodes.csv");

    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part8.xml");

    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.xml");
    wget("1.02", "https://opcfoundation.org/UA/2008/02/Types.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Services.wsdl");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Endpoints.wsdl");
    wget("1.02", "https://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.Types.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.Types.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/SecuredApplication.xsd");

    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/UANodeSet.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/UAVariant.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part3.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part4.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part5.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part8.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part9.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part10.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part11.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part13.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.NodeSet2.xml");
    wget("1.02", "https://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.NodeSet2.xml");

    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/OPCBinarySchema.xsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.bsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.Types.bsd");
    wget("1.02", "https://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.Types.bsd");

    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/AttributeIds.csv");
    wget("1.02", "https://opcfoundation.org/UA/schemas/1.02/NodeIds.csv");


}
if (false) {


    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.StatusCodes.csv");

    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/StatusCode.csv");
    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/NodeIds.csv");
    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.xml");
    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/Opc.Ua.Types.bsd.xml");
    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/Opc.Ua.Endpoints.wsdl");
    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/SecuredApplication.xsd");
    wget("1.03", "https://www.opcfoundation.org/UA/schemas/1.03/UANodeSet.xsd");
    ///
    wget("1.03", "https://opcfoundation.org/UA/2008/02/Types.xsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.Types.bsd.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part8.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.Types.xsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.Services.wsdl");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.Endpoints.wsdl");


    wget("1.03", "https://opcfoundation.org/UA/schemas/DI/1.1/Opc.Ua.Di.NodeSet2.xml");
    //xx wget("1.03","https://opcfoundation.org/UA/schemas/DI/1.1/Opc.Ua.Di.Types.xsd");
    //xx wget("1.03","https://opcfoundation.org/UA/schemas/DI/1.1/Opc.Ua.Di.Types.bsd");

    wget("1.03", "https://opcfoundation.org/UA/schemas/ADI/1.0/Opc.Ua.Adi.NodeSet2.xml");
    //xx wget("1.03","https://opcfoundation.org/UA/schemas/ADI/1.0/Opc.Ua.Adi.Types.xsd");
    //xx wget("1.03","https://opcfoundation.org/UA/schemas/ADI/1.0/Opc.Ua.Adi.Types.bsd");

    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/SecuredApplication.xsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/UANodeSet.xsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/UAVariant.xsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part3.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part4.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part5.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part8.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part9.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part10.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part11.xml");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.NodeSet2.Part13.xml");

    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/OPCBinarySchema.xsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/Opc.Ua.Types.bsd");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/AttributeIds.csv");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/NodeIds.csv");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/StatusCodes.csv");
    wget("1.03", "https://opcfoundation.org/UA/schemas/1.03/StatusCode.csv");

}

if (false) {


    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.StatusCodes.csv");

    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/StatusCode.csv");
    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/NodeIds.csv");
    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.xml");
    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/Opc.Ua.Types.bsd.xml");
    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/Opc.Ua.Endpoints.wsdl");
    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/SecuredApplication.xsd");
    wget("1.04", "https://www.opcfoundation.org/UA/schemas/1.04/UANodeSet.xsd");
    ///
    wget("1.04", "https://opcfoundation.org/UA/2008/02/Types.xsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.Types.bsd.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part8.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.Types.xsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.Services.wsdl");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.Endpoints.wsdl");


    wget("1.04", "https://opcfoundation.org/UA/schemas/DI/1.1/Opc.Ua.Di.NodeSet2.xml");
    //xx wget("1.04","https://opcfoundation.org/UA/schemas/DI/1.1/Opc.Ua.Di.Types.xsd");
    //xx wget("1.04","https://opcfoundation.org/UA/schemas/DI/1.1/Opc.Ua.Di.Types.bsd");

    wget("1.04", "https://opcfoundation.org/UA/schemas/ADI/1.0/Opc.Ua.Adi.NodeSet2.xml");
    //xx wget("1.04","https://opcfoundation.org/UA/schemas/ADI/1.0/Opc.Ua.Adi.Types.xsd");
    //xx wget("1.04","https://opcfoundation.org/UA/schemas/ADI/1.0/Opc.Ua.Adi.Types.bsd");

    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/SecuredApplication.xsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/UANodeSet.xsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/UAVariant.xsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part3.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part4.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part5.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part8.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part9.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part10.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part11.xml");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.NodeSet2.Part13.xml");

    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/OPCBinarySchema.xsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/Opc.Ua.Types.bsd");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/AttributeIds.csv");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/NodeIds.csv");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/StatusCodes.csv");
    wget("1.04", "https://opcfoundation.org/UA/schemas/1.04/StatusCode.csv");



}


// with git hub

function fetch_from_github(version, file) {

    const destFolder = path.join(__dirname, version);
    https: wget(destFolder, `https://raw.githubusercontent.com/OPCFoundation/UA-Nodeset/refs/heads/${version}/${file}`);
    //     https: wget(destFolder, `https://raw.githubusercontent.com/OPCFoundation/UA-Nodeset/${version}/${file}`);

}
const version = "latest";

fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.xml");
fetch_from_github(version, "Schema/Opc.Ua.Types.bsd");
fetch_from_github(version, "Schema/Opc.Ua.Types.xsd");

fetch_from_github(version, "Schema/OPCBinarySchema.xsd");
fetch_from_github(version, "Schema/AttributeIds.csv");
fetch_from_github(version, "Schema/NodeIds.csv");
fetch_from_github(version, "Schema/SecuredApplication.xsd");
fetch_from_github(version, "Schema/StatusCode.csv");
fetch_from_github(version, "Schema/UANodeSet.xsd");
fetch_from_github(version, "AMB/Opc.Ua.AMB.NodeSet2.xml");
fetch_from_github(version, "ADI/Opc.Ua.Adi.NodeSet2.xml");

fetch_from_github(version, "ADI/Opc.Ua.Adi.Types.xsd");

fetch_from_github(version, "AutoID/Opc.Ua.AutoID.NodeSet2.xml");
fetch_from_github(version, "CNC/Opc.Ua.CNC.NodeSet.xml");
fetch_from_github(version, "CommercialKitchenEquipment/Opc.Ua.CommercialKitchenEquipment.NodeSet2.xml");
fetch_from_github(version, "DI/Opc.Ua.Di.NodeSet2.xml");
fetch_from_github(version, "DI/Opc.Ua.Di.Types.xsd");
fetch_from_github(version, "GDS/Opc.Ua.Gds.NodeSet2.xml");
fetch_from_github(version, "Glass/Flat/Opc.Ua.Glass.NodeSet2.xml");
fetch_from_github(version, "IA/Opc.Ua.IA.NodeSet2.xml");
fetch_from_github(version, "IOLink/Opc.Ua.IOLink.NodeSet2.xml");
fetch_from_github(version, "IOLink/Opc.Ua.IOLinkIODD.NodeSet2.xml");
fetch_from_github(version, "ISA-95/Opc.ISA95.NodeSet2.xml");
fetch_from_github(version, "ISA95-JOBCONTROL/opc.ua.isa95-jobcontrol.nodeset2.xml");
fetch_from_github(version, "Machinery/Opc.Ua.Machinery.NodeSet2.xml");
fetch_from_github(version, "Machinery/ProcessValues/Opc.Ua.Machinery.ProcessValues.NodeSet2.xml");
fetch_from_github(version, "Machinery/Jobs/Opc.Ua.Machinery.Jobs.Nodeset2.xml");
fetch_from_github(version, "Machinery/Result/Opc.Ua.Machinery_Result.NodeSet2.xml");
fetch_from_github(version, "MachineTool/Opc.Ua.MachineTool.NodeSet2.xml");
fetch_from_github(version, "MachineVision/Opc.Ua.MachineVision.NodeSet2.xml");
fetch_from_github(version, "MetalForming/Opc.Ua.MetalForming.NodeSet2.xml");

fetch_from_github(version, "PackML/Opc.Ua.PackML.NodeSet2.xml");
fetch_from_github(version, "Robotics/Opc.Ua.Robotics.NodeSet2.xml");
fetch_from_github(version, "Woodworking/Opc.Ua.Eumabois.Nodeset2.xml"); // lowercase 's' correct though inconsistent
fetch_from_github(version, "Woodworking/Opc.Ua.Woodworking.NodeSet2.xml");
fetch_from_github(version, "PADIM/Opc.Ua.IRDI.NodeSet2.xml");
fetch_from_github(version, "PADIM/Opc.Ua.PADIM.NodeSet2.xml");
fetch_from_github(version, "IJT/Base/Opc.Ua.Ijt.Base.NodeSet2.xml");
fetch_from_github(version, "IJT/Tightening/Opc.Ua.Ijt.Tightening.NodeSet2.xml");
fetch_from_github(version, "Scales/Opc.Ua.Scales.NodeSet2.xml");
fetch_from_github(version, "LADS/Opc.Ua.LADS.NodeSet2.xml");
fetch_from_github(version, "I4AAS/Opc.Ua.I4AAS.NodeSet2.xml");
fetch_from_github(version, "Weihenstephan/Opc.Ua.Weihenstephan.NodeSet2.xml");


/*
fetch_from_github(version, "PlasticsRubber/Extrusion/Pelletizer/1.0/Opc.Ua.PlasticsRubber.Extrusion.Pelletizer.NodeSet2.xml");
fetch_from_github(version, "ADI/Opc.Ua.Adi.Types.bsd");
fetch_from_github(version, "DI/Opc.Ua.Di.Types.bsd");
fetch_from_github(version, "Schema/Opc.Ua.Endpoints.wsdl");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part10.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part11.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part13.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part14.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part15.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part16.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part17.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part18.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part19.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part20.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part21.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part22.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part3.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part4.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part5.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part8.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part8.xml");
fetch_from_github(version, "Schema/Opc.Ua.NodeSet2.Part9.xml");
fetch_from_github(version, "Schema/SecuredApplication.xsd");
fetch_from_github(version, "Schema/Types.xsd");
fetch_from_github(version, "Schema/UAVariant.xsd");
*/


