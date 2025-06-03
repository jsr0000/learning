import { PrivateKey, PublicKey } from 'o1js';

// Generate a new random private key
const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();

console.log('=== New Mina Account ===');
console.log('Private Key (keep this secret!):', privateKey.toBase58());
console.log('Public Key:', publicKey.toBase58());
console.log('\nTo use this account:');
console.log('1. Copy the private key and save it securely');
console.log('2. Use the public key to receive MINA tokens');
console.log('3. For Devnet, visit https://faucet.minaprotocol.com/ to get test MINA tokens');