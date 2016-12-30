
SET BASE=%~dp0%
echo applicationUri %1
echo output         %2

node %BASE%\crypto_create_CA.js certificate --selfSigned --applicationUri %1 -o %2