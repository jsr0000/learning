import { PrivateKey } from 'o1js';

const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();

console.log({ publicKey: publicKey.toBase58(), privateKey: privateKey.toBase58() });