import {
  Mina,
  PrivateKey,
  PublicKey,
  fetchAccount,
  Field,
  // Lightnet, 
  SelfProof,
} from 'o1js';

import { Add } from './Add.js';
import { AddZkProgram, AddProgramProof } from './AddZkProgram.js'; // AddProgramProof might be used for type hints if needed, but proof objects are directly generated
import { error } from 'node:console';

// --- Network Configuration ---
// Local Lightnet (Recommended for quick testing)
// const network = Mina.Network('http://localhost:8080/graphql');
// Mina.setActiveInstance(network);
// const fee = 100_000_000; // 0.1 MINA, reasonable for Lightnet

// Devnet
const network = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql'); // User's original network
Mina.setActiveInstance(network);
const fee = 100_000_000; // 0.1 MINA for Devnet

// --- Account Configuration ---
// zkApp Private Key (replace with your actual zkApp private key if you need to deploy/redeploy)
// const zkAppPrivateKey = PrivateKey.random(); // Or load from a file/env
// const appKey = zkAppPrivateKey.toPublicKey();

const appKey = PublicKey.fromBase58('B62qj5Yromh6449YcsecUiHnWCooK5aYXrq3MTcT7cCgN8wgLgTmrx7');


const accountPrivateKeyString = 'EKF8kHZb1gAfnKDyL5YAWgd2yjcLNozo9GtCknfiZQUGC6AhdF8y'; // User's provided private key
const accountPrivateKey = PrivateKey.fromBase58(accountPrivateKeyString);
const accountPublicKey = accountPrivateKey.toPublicKey();


async function main() {
  console.log(`Using zkApp at address: ${appKey.toBase58()}`);
  console.log(`Using fee payer public key: ${accountPublicKey.toBase58()}`);

  // --- Fetch Fee Payer Account ---
  console.log('Fetching fee payer account...');
  try {
    const feePayerAccount = await fetchAccount({ publicKey: accountPublicKey });

    console.log(
      `Fee payer balance: ${Mina.getBalance(accountPublicKey).div(1e9).toString()} MINA`
    );
  } catch (e) {
    console.error(
      `Could not fetch account for fee payer ${accountPublicKey.toBase58()}. Network: ${Mina.Network}`
    );
    console.error('Error details:', e);
    process.exit(1);
  }

  // --- Create zkApp Instance ---
  const zkApp = new Add(appKey);

  // --- Fetch zkApp Account and Current State ---
  console.log('Fetching zkApp account and current state...');
  try {
    await fetchAccount({ publicKey: appKey });
  } catch (e) {
    console.error(
      `Could not fetch account for zkApp ${appKey.toBase58()}. Ensure it's deployed.`
    );
    console.error('Error details:', e);
    // If the contract is not deployed yet, zkApp.num.get() will fail.
    // For this script, we assume the contract is already deployed.
    process.exit(1);
  }

  const currentNum = zkApp.num.get();
  console.log(`Current number in contract (num state): ${currentNum.toString()}`);

  // --- Compile ZkProgram and SmartContract ---
  console.log('Compiling ZkProgram (AddZkProgram)...');
  try {
    await AddZkProgram.compile();
  } catch (e) {
    console.error('AddZkProgram compilation failed:');
    console.error(e);
    process.exit(1);
  }
  console.log('AddZkProgram compiled successfully.');

  console.log('Compiling SmartContract (Add)...');
  try {
    await Add.compile();
  } catch (e) {
    console.error('Add SmartContract compilation failed:');
    console.error(e);
    process.exit(1);
  }
  console.log('Add SmartContract compiled successfully.');

  // --- Proof Generation: Add 1 to the 'num' state variable ---
  console.log(`Preparing to add 1 to current number ${currentNum.toString()}`);

  console.log('Step 1: Creating initial proof (baseProof) with current number...');
  let baseProof;
  try {
    // AddZkProgram.init(initialState: Field)
    // - proof.publicInput = initialState
    // - proof.publicOutput = initialState
    const initResult = await AddZkProgram.init(currentNum);
    baseProof = initResult.proof;
  } catch (e) {
    console.error('baseProof (AddZkProgram.init) generation failed:');
    console.error(e);
    process.exit(1);
  }
  console.log('baseProof created successfully.');


  console.log('Step 2: Creating transaction proof (updateProof) to increment the number...');
  let transactionProof; // This is the proof we'll send to the contract
  try {
    // AddZkProgram.update(initialState: Field, previousProof: SelfProof<Field, Field>)
    // - proof.publicInput = initialState (first argument, currentNum in our case)
    // - proof.publicOutput = previousProof.publicOutput.add(Field(1))
    const updateResult = await AddZkProgram.update(currentNum, baseProof as unknown as SelfProof<Field, Field>);
    transactionProof = updateResult.proof;
  } catch (e) {
    console.error('transactionProof (AddZkProgram.update) generation failed:');
    console.error(e);
    process.exit(1);
  }
  console.log('transactionProof created successfully.');
  console.log(`  transactionProof.publicInput (old num for contract): ${transactionProof.publicInput.toString()}`);
  console.log(`  transactionProof.publicOutput (new num for contract): ${transactionProof.publicOutput.toString()}`);

  // --- Verify proof coherence (optional sanity check before sending) ---
  if (!transactionProof.publicInput.equals(currentNum).toBoolean()) {
    console.error(
      `Error: transactionProof.publicInput (${transactionProof.publicInput.toString()}) does not match currentNum (${currentNum.toString()})`
    );
    process.exit(1);
  }
  const expectedNewNum = currentNum.add(Field(1));
  if (!transactionProof.publicOutput.equals(expectedNewNum).toBoolean()) {
    console.error(
      `Error: transactionProof.publicOutput (${transactionProof.publicOutput.toString()}) does not match expectedNewNum (${expectedNewNum.toString()})`
    );
    process.exit(1);
  }
  console.log('Proof coherence check passed.');

  // --- Build, Prove, Sign, and Send Transaction ---
  console.log('Building transaction...');
  let transaction;
  try {
    transaction = await Mina.transaction({ sender: accountPublicKey, fee: fee }, async () => {
      // AccountUpdate.fundNewAccount(accountPublicKey); // Only if deploying for the first time and zkApp needs funding by feePayer
      await zkApp.settleState(transactionProof);
    });
  } catch (e) {
    console.error('Failed to build transaction:');
    console.error(e);
    process.exit(1);
  }
  console.log('Transaction built.');

  console.log('Proving transaction...');
  try {
    await transaction.prove();
  } catch (e) {
    console.error('Transaction proving failed:');
    console.error(e);
    process.exit(1);
  }
  console.log('Transaction proven.');

  console.log('Signing and sending transaction...');
  try {
    // Sign transaction with fee payer's private key
    const signedTx = transaction.sign([accountPrivateKey]);
    const sentTx = await signedTx.send();

    if (sentTx.hash) {
      console.log(`Transaction sent! Hash: ${sentTx.hash}`); // Use .hash for Txn.Submitted
      const networkId = Mina.getNetworkId();
      const explorerLink = `https://minascan.io/${networkId === 'mainnet' ? '' : networkId + '/'}tx/${sentTx.hash}`;
      console.log(`Explorer link: ${explorerLink}`);
      console.log('Waiting for transaction to be included in a block (this may take some time)...');

      // Wait for transaction to be included
      const receipt = await sentTx.wait({ maxAttempts: 120, interval: 30000 }); // ~1 hour max wait for devnet
      console.log('Transaction included successfully!');
      console.log('Receipt status:', receipt.status);
      console.log('Full receipt:', receipt); 
    } else {
      console.error('Transaction sending failed. No hash returned. Raw response:', sentTx);
    }
  } catch (e) {
    console.error('Transaction sending or waiting failed:');
    console.error(e);
    if (e instanceof Error && e.message && e.message.includes("Rejected")) { // More robust error checking for rejection
      console.error("Transaction was likely rejected by the node. Check balances, nonce, and transaction validity. Error details from node might be in the exception.");
    }
    process.exit(1);
  }

  // --- Verify New State ---
  console.log('Verifying new state on-chain...');
  try {
    await fetchAccount({ publicKey: appKey }); // Re-fetch the zkApp account state
  } catch (e) {
    console.error(
      `Could not re-fetch account for zkApp ${appKey.toBase58()} after transaction.`
    );
    console.error(e);
    // Continue to try and get num, but it might be stale if fetch failed.
  }

  const newNum = zkApp.num.get();
  console.log(`New number in contract after update: ${newNum.toString()}`);

  if (newNum.equals(expectedNewNum).toBoolean()) {
    console.log('✅ Successfully added 1 to the number! The state has been updated on-chain.');
  } else {
    console.error(
      `❌ Update verification failed or state not yet reflecting the change! Expected ${expectedNewNum.toString()} but got ${newNum.toString()}`
    );
    console.error("It's possible the transaction is still propagating or was overwritten. Check the explorer.");
  }

  console.log('Interaction script finished.');
}

// --- Run the main function ---
main().catch((e) => {
  console.error('Unhandled error in main:', e);
  process.exit(1);
});