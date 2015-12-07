
SET BASE=%~dp0%
echo applicationUri %1%
echo output         %2%

node %BASE%\crypto_create_CA.js --new --applicationUri %1% --prefix %2%