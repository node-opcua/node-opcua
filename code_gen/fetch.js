var request = require("request");
var fs = require("fs");
var ProgressBar = require('progress');
var _ = require("underscore");

function wget2(url) {

    var bar = new ProgressBar(':bar', { total: 10 });
    var path = require("path");
    var filename = path.basename(url) ;


    request(url).pipe(fs.createWriteStream(filename));

    request.on("data", function(chunk){



    });
}

var force = true;


function wget(url) {

    var https = require('https');
    var http  = require('http');
    if (url.substr(0,5)==="https") {  http = https;   }

    var path = require("path");
    var filename = path.basename(url); // + path.extname(url);

    if (fs.existsSync(filename) && !force)  {
        console.log("  " + filename +" already downloaded " + url);
        return;
    }
    console.log(" downloading " + filename + " from " + url);

    var stream = fs.createWriteStream(filename,"w");

    var req = http.get(url, function(response) {
        // handle the response
        var res_data = '';
        // console.log(response);
        var fileBytes = parseInt(response.headers['content-length'],10);
        if (!_.isFinite(fileBytes)) {
            fileBytes = 10000;
        }
        var bar = new ProgressBar('  downloading ' + url + '[:bar] :percent :etas', {
            complete: '='
            , incomplete: ' '
            , width: 20
            , total: fileBytes
        });

        response.on('data', function(chunk) {
            res_data += chunk;

            if (chunk.length) {
                try {
                    bar.tick(chunk.length);
                } catch(err) {
                    console.log(chunk.length , " fileBytes = ",response.headers['content-length']);
                }
            }
            stream.write(chunk,"binary");

        });
        response.on('end', function() {
            stream.end();
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
wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.bsd.xml");
wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.StatusCodes.csv");

if(0) {


    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.xml");
    wget("https://opcfoundation.org/UA/2008/02/Types.xsd");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.xsd");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Services.wsdl");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Endpoints.wsdl");
    wget("https://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.Types.xsd");
    wget("https://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.Types.xsd");
    wget("https://opcfoundation.org/UA/schemas/1.02/SecuredApplication.xsd");

    wget("https://opcfoundation.org/UA/schemas/1.02/UANodeSet.xsd");
    wget("https://opcfoundation.org/UA/schemas/1.02/UAVariant.xsd");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part3.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part4.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part5.xml");
    wget("https://opcfoundation.org/UA/schemas/Opc.Ua.NodeSet2.Part8.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part9.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part10.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part11.xml");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.NodeSet2.Part13.xml");
    wget("https://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.NodeSet2.xml");
    wget("https://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.NodeSet2.xml");

    wget("https://opcfoundation.org/UA/schemas/1.02/OPCBinarySchema.xsd");
    wget("https://opcfoundation.org/UA/schemas/1.02/Opc.Ua.Types.bsd");
    wget("https://opcfoundation.org/UA/schemas/DI/1.00/Opc.Ua.Di.Types.bsd");
    wget("https://opcfoundation.org/UA/schemas/ADI/1.00/Opc.Ua.Adi.Types.bsd");

    wget("https://opcfoundation.org/UA/schemas/1.02/AttributeIds.csv");
    wget("https://opcfoundation.org/UA/schemas/1.02/NodeIds.csv");
}
