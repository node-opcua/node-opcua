

REM replace node-opcua-crypto/pki modules with link to sibling modules 
set N=node-opcua-crypto
rmdir node_modules\%N% /s /q
mklink /j node_modules\%N% %~dp0..\%N%

set N=node-opcua-pki
rmdir node_modules\%N% /s /q
mklink /j node_modules\%N% %~dp0..\%N%
