import {
    Mina,
    PrivateKey,
    PublicKey,
    AccountUpdate,
    fetchAccount,
} from 'o1js';

import { Add } from './Add.js';
import { AddZkProgram } from './AddZkProgram.js';

// --- Network Configuration ---
const network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
Mina.setActiveInstance(network);

// --- Account Configuration ---
// Fee Payer Account
const accountPrivateKeyString = 'EKF8kHZb1gAfnKDyL5YAWgd2yjcLNozo9GtCknfiZQUGC6AhdF8y';
const accountPrivateKey = PrivateKey.fromBase58(accountPrivateKeyString);
const accountPublicKey = accountPrivateKey.toPublicKey();

// zkApp Account
const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

console.log('=== zkApp Deployment ===');
console.log('zkApp Private Key:', zkAppPrivateKey.toBase58());
console.log('zkApp Public Key:', zkAppAddress.toBase58());

async function main() {
    console.log('Compiling AddZkProgram...');
    await AddZkProgram.compile();

    console.log('Compiling Add contract...');
    await Add.compile();

    console.log('Fetching fee payer account...');
    const feePayerAccount = await fetchAccount({ publicKey: accountPublicKey });
    console.log(`Fee payer balance: ${Mina.getBalance(accountPublicKey).div(1e9).toString()} MINA`);

    console.log('Deploying zkApp...');
    const zkApp = new Add(zkAppAddress);
    const transaction = await Mina.transaction(
        { sender: accountPublicKey, fee: 100_000_000 },
        async () => {
            AccountUpdate.fundNewAccount(accountPublicKey);
            await zkApp.deploy();
        }
    );

    console.log('Proving transaction...');
    await transaction.prove();

    console.log('Signing transaction...');
    transaction.sign([accountPrivateKey, zkAppPrivateKey]);

    console.log('Sending transaction...');
    const sentTx = await transaction.send();
    console.log('Transaction sent! Hash:', sentTx.hash);

    console.log('Waiting for transaction to be included in a block...');
    const receipt = await sentTx.wait({ maxAttempts: 120, interval: 30000 });
    console.log('Transaction included! Status:', receipt.status);

    console.log('\n=== Deployment Complete ===');
    console.log('zkApp deployed at:', zkAppAddress.toBase58());
    console.log('Please save the zkApp private key for future use:', zkAppPrivateKey.toBase58());
}

main().catch((e) => {
    console.error('Error:', e);
    process.exit(1);
});