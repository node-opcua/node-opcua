
SET UACOMPLIANCETEST="C:\Program Files (x86)\OPC Foundation\UA 1.02\Compliance Test Tool\uacompliancetest.exe"
SET CTTFILE=".\CTT\Node-OPCUA-Server\Node-OPCUA-Server.ctt.xml"
SET SELECTION=".\CTT\Node-OPCUA-Server\nano-profile.selection.xml"
SET RESULT="tmp\nano-ctt-result.xml"

%UACOMPLIANCETEST% --close --hidden --settings %CTTFILE% --selection %SELECTION% --result %RESULT%
IF %ERRORLEVEL% EQU 1 ECHO Warning detected!
IF %ERRORLEVEL% EQU 0 ECHO OK, no problems found!
IF %ERRORLEVEL% EQU -1 ECHO FAIL, check the logs!

c:\tools\msxsl %RESULT% CTT\CTT2XUNIT.xsl -o tmp\a.xml


REM JUNIT VIEWSE (npm install junit-viewer -g)
REM junit-viewer --results=tmp\a.xml --port=8080
