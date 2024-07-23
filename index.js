const solanaWeb3 = require('@solana/web3.js');

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // in milliseconds

async function connectWithRetry(retries = MAX_RETRIES) {
  const connection = new solanaWeb3.Connection(
    solanaWeb3.clusterApiUrl('devnet'),
    'confirmed'
  );

  for (let i = 0; i < retries; i++) {
    try {
      const version = await connection.getVersion();
      console.log('Connected to Solana cluster:', version);
      return connection;
    } catch (error) {
      console.error(`Connection attempt ${i + 1} failed:`, error.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${RETRY_DELAY / 1000} seconds...`);
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      } else {
        throw new Error('Failed to connect to the Solana cluster after multiple attempts');
      }
    }
  }
}

async function getAirdrop(connection, publicKey) {
  const airdropSignature = await connection.requestAirdrop(
    publicKey,
    solanaWeb3.LAMPORTS_PER_SOL
  );

  await connection.confirmTransaction(airdropSignature);
  console.log('Airdrop completed');
}

(async () => {
  try {
    const connection = await connectWithRetry();

    const payer = solanaWeb3.Keypair.generate();
    const programId = new solanaWeb3.PublicKey('65e62wcz94RT2FVif2okoCM6NHyBRQ2kJjfGUCu87ofD');

    await getAirdrop(connection, payer.publicKey);

    // Check balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Payer account balance: ${balance / solanaWeb3.LAMPORTS_PER_SOL} SOL`);

    const incrementInstruction = Buffer.from([0]);
    const viewInstruction = Buffer.from([1]);

    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: payer.publicKey,
        lamports: solanaWeb3.LAMPORTS_PER_SOL,
        space: 1,
        programId,
      })
    );

    await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [payer]);

    const incrementTx = new solanaWeb3.Transaction().add({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
      programId,
      data: incrementInstruction,
    });

    await solanaWeb3.sendAndConfirmTransaction(connection, incrementTx, [payer]);
    console.log('Value incremented');

    const viewTx = new solanaWeb3.Transaction().add({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      programId,
      data: viewInstruction,
    });

    await solanaWeb3.sendAndConfirmTransaction(connection, viewTx, [payer]);
    console.log('Value viewed');
  } catch (error) {
    console.error('Failed to connect and interact with the Solana cluster:', error.message);
    if (error.logs) {
      console.error('Logs:', error.logs);
    }
  }
})();
