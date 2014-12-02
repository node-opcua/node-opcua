

openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout key.pem -out cert.pem -config cert.cnf
openssl rsa -in key.pem -pubout > public_key.pub

openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout client_key.pem -out client_cert.pem -config cert.cnf
openssl rsa -in client_key.pem -pubout > client_public_key.pub

# openssl req -x509 -days 365 -nodes -newkey rsa:2048 -keyout server_key256.pem -out server_cert256.pem -config cert.cnf
# openssl rsa -in server_key256.pem -pubout > server_public_key256.pub
