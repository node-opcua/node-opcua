openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout key.pem -out cert.pem -config cert.cnf
openssl rsa -in key.pem -pubout > public_key.pub

