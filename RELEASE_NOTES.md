
version 0.41
============

call service:
-------------

  - #25 add Call service support on client and server
  - #25 add engine.addMethod so that new method can be added to the address space

subscription service:
---------------------

  - a7b4395389354207293e5616a6184d03a704953e implement SetMonitoringMode Request/Response
  - 70f909e6544c05a92bd80f2979d812e46034cf5d fixes RepublishResponse behavior on server
  - 18efde80be256ea86ef517b3e17ffaa3a89f27cc make sure monitoredItem timer func is not called if timer has been shutdown
  - #25 implement GetMonitoredItems method on Server Object

session service:
----------------

  - add ability to restrict number of concurrent sessions on server.
    bcdee735459d4690c94e4f7ccade41a4df85fab8
  - eb56e8418c50cdb27f77406d18bc27ad4d6473e8, a41446e16ef9575c55d561b26b47408c67f6b8fe make sure running sessions are
    automatically discarded after the timeout period has been reached without any activity from the client. ( sessionTimeout)

read service:
-------------

  - #34,#35 Add asynchronous value read/write capability on server side

data access:
------------

  - start implementation of DataAccess (Part 8)
      -- 4ec995190f7bb4effb37b9c0849a3012276fcc34 add some standard units for EUInformation
      -- a4d88456e519fa1a8a4f183c2f7467471697b8ba AxisInformation

usability:
----------

  - #48 7d981736e962ef72d6b82042c9ebb20604779b88 provides a way to pass specify serverInfo and buildInfo as options to OPCUAServer
  - #50 add flexible ways to specify typeDefinition and dataType in engine.addVariable
  - f1a455bd9c3162f887cb42b45dd0d029baf023f4 expose transactionCount Variables on VendorServerInfo
  - 598f2eb6bb1bde9810247a1b91f0992afc8556f2 expose bytesWritten and bytesRead Variables on VendorServerInfo
  - use fully qualified domain name (fqdn), whenever possible, to build default endpoint urn instead of hostname only.
    a7b4395389354207293e5616a6184d03a704953e , 5fef2ccac425f7bdd0a26f0db5adef44775520a1
  - #40, 8eb1f9e9f72266e0459546303fc5e390a9719fee set timeoutHint to non zero value to cope with servers that wrongly assume that timeoutHint =0 is 0s ( instead of 'no timeout' as per spec)

bug fixing
----------

  - fix various issues with secure connection
  - 736c42612508b9e146c4f35444808770e9247f4f , 3b137410d626b309341414a6073116c83eba631d fix issue in TranslateBrowsePath
  - #42, 2fd60d3640de77159c0527af7347b758fe65b10e,3444bae5ea255a2058000146ae120c124d3d4c4a GUID : permit lower case letters in GUID strings
  - c721567d85db983a6c768cf99acbbbd4bc1267f1 fix high low inversion in Int64 encoding
  - #36 c37edacaab44180a070f935b1dc142ae819aa76b handle HEL messages received by server that are received in small chunks
  - #36 6159b3e291b63962141f43a96c3ebce3d248cfae handle samplingInterval === -1 in CreateMonitoredItem Request


Contributors:
-------------

* special thanks to limjunliang, longtranphu2006, paragonRobotics, Diti24, yping, anson2004, Jochen1980, MackyNacky


version 0.40
============

  - #17 : add support for Sign and Encrypt
  - #17 : add ability for server to specify which endpoint to expose
  - #20 1b0f01989e3170c1231be13e2a3020e7177eecff fix nodecrawler missing resultMask
  - #21 bae02c02a8634b929b25ad505a1b00bff19fc3f8 Add the ability to handle a specific source timestamp on variable
  - #23 clamp monitored item samplingInterval
  - #24  ServerSecureChannelLayer timeout between message was too short and is now be configurable

Contributors:
-------------

* special thanks: trongtin, ChrisJansson ,VincentGijsen, longtranphu2006
