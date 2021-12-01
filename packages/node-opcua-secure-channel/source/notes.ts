
/* 
 *  SymmetricSignatureAlgorithm    -----------------------------------------------------------------------------------+
 *  SymmetricEncryptionAlgorithm --------------------------------------------------------------------------+          |
 *  KeyDerivationAlgorithm ---------------------------------------------------------------------+          |          |
 *  AsymmetricSignatureAlgorithm -------------------------------------------+                   |          |          |
 *  AsymmetricEncryptionAlgorithm`---------------------------+              |                   |          |          |
 *  SecureChannelNonceLength (bytes)-------------+           |              |                   |          |          |
 *  MinAsymmetricKeyLength (bytes)----------+    |           |              |                   |          |          |
 *  DerivedSignatureKeyLength-(bytes)-+     |    |           |              |                   |          |          |
 *                                    v     |    |           |              |                   |          |          |
 *  Basic128Rsa15_Limits              16 | 128 | 16 | RSA-PKCS15        | RSA-PKCS15-SHA1     |P-SHA1    |AES128-CBC|HMAC-SHA1    |
 *  Basic256                          24 | 128 | ?? | RSA-OAEP-SHA1     | RSA-PKCS15-SHA1     |P-SHA1    |AES256-CBC|HMAC-SHA1    |
 *  Basic256Sha256_Limits             32 | 256 | 32 | RSA-OAEP-SHA1     | RSA-PKCS15-SHA2-256 |P-SHA2-256|AES256-CBC|HMAC-SHA2-256|
 *  Aes128-Sha256-RsaOaep_Limits      32 | 256 | 32 | RSA-OAEP-SHA1     | RSA-PKCS15-SHA2-256 |P-SHA2-256|AES128-CBC|HMAC-SHA2-256|
 *  Aes256-Sha256-RsaPss_Limits       32 | 256 | 32 | RSA-OAEP-SHA2-256 | RSA-PSS-SHA2-256    |P-SHA2-256|AES256-CBC|HMAC-SHA2-256|
 */


/** Basic256 (deprecated)
Basic256_Limits
-> DerivedSignatureKeyLength: 192 bits (24 bytes)
-> MinAsymmetricKeyLength: 1024 bits   128 bytes
-> MaxAsymmetricKeyLength: 2048 bits   256 bytes
-> SecureChannelNonceLength: 32 bytes
  
AsymmetricEncryptionAlgorithm_RSA-OAEP-SHA1
  The RSA encryption algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSAES-OAEP scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc6234.
  The mask generation algorithm also uses SHA1.
  The URI is http://www.w3.org/2001/04/xmlenc#rsa-oaep.
  No known exploits exist when using SHA1 with RSAES-OAEP, however, SHA1 was broken in 2017 so use of this algorithm is not recommended.

AsymmetricSignatureAlgorithm_RSA-PKCS15-SHA1
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc3174.
  The URI is http://www.w3.org/2000/09/xmldsig#rsa-sha1.
  SHA1 was broken in 2017 so this algorithm should not be used.

CertificateKeyAlgorithm_RSA
  The RSA algorithm described in http://www.faqs.org/rfcs/rfc3447.html.
  CertificateSignatureAlgorithm_RSA-PKCS15-SHA1
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc3174.
  The URI is http://www.w3.org/2000/09/xmldsig#rsa-sha1.
  SHA1 was broken in 2017 so this algorithm should not be used.
  The SHA2 algorithm with 244, 256, 384 or 512 bits may be used instead of SHA1.
  The SHA2 algorithm is described in https://tools.ietf.org/html/rfc6234.

EphemeralKeyAlgorithm_None
  No EphemeralKeys are used.

KeyDerivationAlgorithm_P-SHA1
  The P_SHA-1 pseudo-random function defined in https://tools.ietf.org/html/rfc4346.
  The URI is http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha1.
  No known exploits exist when using SHA1 with P-SHA-1, however, SHA1 was broken in 2017 so use of this algorithm is not recommended.

Security Certificate Validation
  A certificate will be validated as specified in UA Part 4. This includes among others structure and signature examination. Allowing for some validation errors to be suppressed by administration directive.
  Security Encryption Required
  Encryption is required using the algorithms provided in the security algorithm suite.
  Security Signing Required
  Signing is required using the algorithms provided in the security algorithm suite.

SymmetricEncryptionAlgorithm_AES256-CBC
  The AES encryption algorithm which is defined in http://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf.
  Multiple blocks encrypted using the CBC mode described in http://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf.
  The key size is 256 bits. The block size is 16 bytes.
  The URI is http://www.w3.org/2001/04/xmlenc#aes256-cbc.

SymmetricSignatureAlgorithm_HMAC-SHA1
  A keyed hash which is defined in https://tools.ietf.org/html/rfc2104.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc3174.
  The URI is http://www.w3.org/2000/09/xmldsig#hmac-sha1.
  No known exploits exist when using SHA1 with a keyed hash, however, SHA1 was broken in 2017 so use of this algorithm is not recommended.
 * 
 */

/** Basic128Rsa15_Limits
-> DerivedSignatureKeyLength: 128 bits (16 bytes)
-> MinAsymmetricKeyLength: 1024 bits  128 bytes
-> MaxAsymmetricKeyLength: 2048 bits (256 bytes)
-> SecureChannelNonceLength: 16 bytes

AsymmetricEncryptionAlgorithm_RSA-PKCS15
  The RSA encryption algorithm which is defined in https://tools.ietf.org/html/rfc3447.  
  The RSAES-PKCS1-v1_5 scheme is used.
  The URI is http://www.w3.org/2001/04/xmlenc#rsa-1_5.
  The RSAES-PKCS1-v1_5 scheme has known weaknesses and is not recommended.

AsymmetricSignatureAlgorithm_RSA-PKCS15-SHA1
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc3174.
  The URI is http://www.w3.org/2000/09/xmldsig#rsa-sha1.
  SHA1 was broken in 2017 so this algorithm should not be used.

CertificateKeyAlgorithm_RSA
  The RSA algorithm described in http://www.faqs.org/rfcs/rfc3447.html.
  CertificateSignatureAlgorithm_RSA-PKCS15-SHA1
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc3174.
  The URI is http://www.w3.org/2000/09/xmldsig#rsa-sha1.
  SHA1 was broken in 2017 so this algorithm should not be used.
  The SHA2 algorithm with 244, 256, 384 or 512 bits may be used instead of SHA1.
  The SHA2 algorithm is described in https://tools.ietf.org/html/rfc6234.

EphemeralKeyAlgorithm_None
  No EphemeralKeys are used.

KeyDerivationAlgorithm_P-SHA1
  The P_SHA-1 pseudo-random function defined in https://tools.ietf.org/html/rfc4346.
  The URI is http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha1.
  No known exploits exist when using SHA1 with P-SHA-1, however, SHA1 was broken in 2017 so use of this algorithm is not recommended.

Security Certificate Validation
  A certificate will be validated as specified in UA Part 4. This includes among others structure and signature examination. Allowing for some validation errors to be suppressed by administration directive.

Security Encryption Required
  Encryption is required using the algorithms provided in the security algorithm suite.

Security Signing Required
  Signing is required using the algorithms provided in the security algorithm suite.

SymmetricEncryptionAlgorithm_AES128-CBC
  The AES encryption algorithm which is defined in http://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf.
  Multiple blocks encrypted using the CBC mode described in http://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf.
  The key size is 128 bits. The block size is 16 bytes.
  The URI is http://www.w3.org/2001/04/xmlenc#aes128-cbc.

SymmetricSignatureAlgorithm_HMAC-SHA1
  A keyed hash which is defined in https://tools.ietf.org/html/rfc2104.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc3174.
  The URI is http://www.w3.org/2000/09/xmldsig#hmac-sha1.
  No known exploits exist when using SHA1 with a keyed hash, however, SHA1 was broken in 2017 so use of this algorithm is not recommended. 
*/

/** Basic256Sha256_Limits
-> DerivedSignatureKeyLength: 256 bits  : 32 bytes
-> MinAsymmetricKeyLength: 2048 bits    :  256 bytes
-> MaxAsymmetricKeyLength: 4096 bits    : 512 bytes
-> SecureChannelNonceLength: 32 bytes  

AsymmetricEncryptionAlgorithm_RSA-OAEP-SHA1
  The RSA encryption algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSAES-OAEP scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc6234.
  The mask generation algorithm also uses SHA1.
  The URI is http://www.w3.org/2001/04/xmlenc#rsa-oaep.
  No known exploits exist when using SHA1 with RSAES-OAEP, however, SHA1 was broken in 2017 so use of this algorithm is not recommended.

AsymmetricSignatureAlgorithm_RSA-PKCS15-SHA2-256
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA2 with 256bits and is described in https://tools.ietf.org/html/rfc6234.
  The URI is http://www.w3.org/2001/04/xmldsig-more#rsa-sha256.

CertificateKeyAlgorithm_RSA
  The RSA algorithm described in http://www.faqs.org/rfcs/rfc3447.html.
  CertificateSignatureAlgorithm_RSA-PKCS15-SHA2-256
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA2 with 256bits and is described in https://tools.ietf.org/html/rfc6234.
  The SHA2 algorithm with 384 or 512 bits may be used instead of SHA2 with 256 bits.
  The URI is http://www.w3.org/2001/04/xmldsig-more#rsa-sha256.

EphemeralKeyAlgorithm_None
  No EphemeralKeys are used.

KeyDerivationAlgorithm_P-SHA2-256
  The P_SHA256 pseudo-random function defined in https://tools.ietf.org/html/rfc5246.
  The URI is http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha256.

Security Certificate Validation
  A certificate will be validated as specified in UA Part 4. This includes among others structure and signature examination. Allowing for some validation errors to be suppressed by administration directive.

Security Encryption Required
  Encryption is required using the algorithms provided in the security algorithm suite.

Security Signing Required
  Signing is required using the algorithms provided in the security algorithm suite.

SymmetricEncryptionAlgorithm_AES256-CBC
  The AES encryption algorithm which is defined in http://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf.
  Multiple blocks encrypted using the CBC mode described in http://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf.
  The key size is 256 bits. The block size is 16 bytes.
  The URI is http://www.w3.org/2001/04/xmlenc#aes256-cbc.

SymmetricSignatureAlgorithm_HMAC-SHA2-256
  A keyed hash used for message authentication which is defined in https://tools.ietf.org/html/rfc2104.
  The hash algorithm is SHA2 with 256 bits and described in https://tools.ietf.org/html/rfc4634
*/

/** Aes128-Sha256-RsaOaep_Limits
-> DerivedSignatureKeyLength: 256 bits
-> MinAsymmetricKeyLength: 2048 bits
-> MaxAsymmetricKeyLength: 4096 bits
-> SecureChannelNonceLength: 32 bytes

AsymmetricEncryptionAlgorithm_RSA-OAEP-SHA1
  The RSA encryption algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSAES-OAEP scheme is used.
  The hash algorithm is SHA1 and is described in https://tools.ietf.org/html/rfc6234.
  The mask generation algorithm also uses SHA1.
  The URI is http://www.w3.org/2001/04/xmlenc#rsa-oaep.
  No known exploits exist when using SHA1 with RSAES-OAEP, however, SHA1 was broken in 2017 so use of this algorithm is not recommended.

AsymmetricSignatureAlgorithm_RSA-PKCS15-SHA2-256
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA2 with 256bits and is described in https://tools.ietf.org/html/rfc6234.
  The URI is http://www.w3.org/2001/04/xmldsig-more#rsa-sha256.
  CertificateKeyAlgorithm_RSA
  The RSA algorithm described in http://www.faqs.org/rfcs/rfc3447.html.

CertificateSignatureAlgorithm_RSA-PKCS15-SHA2-256
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA2 with 256bits and is described in https://tools.ietf.org/html/rfc6234.
  The SHA2 algorithm with 384 or 512 bits may be used instead of SHA2 with 256 bits.
  The URI is http://www.w3.org/2001/04/xmldsig-more#rsa-sha256.

EphemeralKeyAlgorithm_None
  No EphemeralKeys are used.

KeyDerivationAlgorithm_P-SHA2-256
  The P_SHA256 pseudo-random function defined in https://tools.ietf.org/html/rfc5246.
  The URI is http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha256.

Security Certificate Validation
  A certificate will be validated as specified in UA Part 4. This includes among others structure and signature examination. Allowing for some validation errors to be suppressed by administration directive.

Security Encryption Required
  Encryption is required using the algorithms provided in the security algorithm suite.

Security Signing Required
  Signing is required using the algorithms provided in the security algorithm suite.

SymmetricEncryptionAlgorithm_AES128-CBC
  The AES encryption algorithm which is defined in http://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf.
  Multiple blocks encrypted using the CBC mode described in http://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf.
  The key size is 128 bits. The block size is 16 bytes.
  The URI is http://www.w3.org/2001/04/xmlenc#aes128-cbc.

SymmetricSignatureAlgorithm_HMAC-SHA2-256
  A keyed hash used for message authentication which is defined in https://tools.ietf.org/html/rfc2104.
  The hash algorithm is SHA2 with 256 bits and described in https://tools.ietf.org/html/rfc4634
 */

/** Aes256-Sha256-RsaPss_Limits
  -> DerivedSignatureKeyLength: 256 bits 32 bytes
  -> MinAsymmetricKeyLength: 2048 bits 256 bytes
  -> MaxAsymmetricKeyLength: 4096 bits 512 bytes
  -> SecureChannelNonceLength: 32 bytes 

AsymmetricEncryptionAlgorithm_RSA-OAEP-SHA2-256
  The RSA encryption algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSAES-OAEP scheme is used.
  The hash algorithm is SHA2 with 256 bits and is described in https://tools.ietf.org/html/rfc6234.
  The mask generation algorithm also uses SHA2 with 256 bits.
  The URI is http://opcfoundation.org/UA/security/rsa-oaep-sha2-256.

AsymmetricSignatureAlgorithm_RSA-PSS-SHA2-256
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PSS scheme is used.
  The hash algorithm is SHA2 with 256bits and is described in https://tools.ietf.org/html/rfc6234.
  The mask generation algorithm also uses SHA2 with 256 bits.
  The salt length is 32 bytes.
  The URI is http://opcfoundation.org/UA/security/rsa-pss-sha2-256.

CertificateKeyAlgorithm_RSA
  The RSA algorithm described in http://www.faqs.org/rfcs/rfc3447.html.
  CertificateSignatureAlgorithm_RSA-PKCS15-SHA2-256
  The RSA signature algorithm which is defined in https://tools.ietf.org/html/rfc3447.
  The RSASSA-PKCS1-v1_5 scheme is used.
  The hash algorithm is SHA2 with 256bits and is described in https://tools.ietf.org/html/rfc6234.
  The SHA2 algorithm with 384 or 512 bits may be used instead of SHA2 with 256 bits.
  The URI is http://www.w3.org/2001/04/xmldsig-more#rsa-sha256.

EphemeralKeyAlgorithm_None
  No EphemeralKeys are used.

KeyDerivationAlgorithm_P-SHA2-256
  The P_SHA256 pseudo-random function defined in https://tools.ietf.org/html/rfc5246.
  The URI is http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha256.

Security Certificate Validation
  A certificate will be validated as specified in UA Part 4. This includes among others structure and signature examination. Allowing for some validation errors to be suppressed by administration 
  directive.
Security Encryption Required
  Encryption is required using the algorithms provided in the security algorithm suite.

Security Signing Required
  Signing is required using the algorithms provided in the security algorithm suite.

SymmetricEncryptionAlgorithm_AES256-CBC
  The AES encryption algorithm which is defined in http://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf.
  Multiple blocks encrypted using the CBC mode described in http://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf.
  The key size is 256 bits. The block size is 16 bytes.
  The URI is http://www.w3.org/2001/04/xmlenc#aes256-cbc.

SymmetricSignatureAlgorithm_HMAC-SHA2-256
  A keyed hash used for message authentication which is defined in https://tools.ietf.org/html/rfc2104.
  The hash algorithm is SHA2 with 256 bits and described in https://tools.ietf.org/html/rfc4634
*/