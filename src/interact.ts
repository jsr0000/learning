import {
  Mina, PrivateKey, PublicKey, fetchAccount, Field
} from 'o1js';

import { Add } from './Add.js';
import { AddZkProgram } from './AddZkProgram.js';

const Network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');

Mina.setActiveInstance(Network);

const appKey = PublicKey.fromBase58('B62qifAKA81fVjn7RQwiEsjNkRJarPvYKqPwQ5hy1nfEe1GQpgenLsJ');

const zkApp = new Add(appKey);
await fetchAccount({ publicKey: appKey });
const currentNum = zkApp.num.get();
console.log('Current number:', currentNum.toString());

const accountPrivateKey = PrivateKey.fromBase58('EKF9D6T1MVJLpMphTAwJJTmLYTz5LuEGTEYzAA4yWXP2k2qEFaSj');
const accountPublicKey = accountPrivateKey.toPublicKey();

// console.log(accountPublicKey.toBase58());

console.log('Compiling...');
await AddZkProgram.compile();
await Add.compile();
console.log('Compiled');

// // Create initial proof
// const init = await AddZkProgram.init(currentNum);
// // Create update proof that adds 1
// const update = await AddZkProgram.update(currentNum, init.proof);

// // Settle the state with the update proof
// const tx = await Mina.transaction({ sender: accountPublicKey, fee: 0.1e9 }, async () => {
//   await zkApp.settleState(update.proof);
// });

// await tx.prove();
// await tx.sign([accountPrivateKey]).send();

// // Fetch and display the updated number
// await fetchAccount({ publicKey: appKey });
// const newNum = zkApp.num.get();
// console.log('New number:', newNum.toString());
