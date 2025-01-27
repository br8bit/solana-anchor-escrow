import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Escrow } from '../target/types/escrow';
import { PublicKey, SystemProgram, Keypair } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from '@solana/spl-token';
import { assert } from 'chai';

describe('escrow', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Escrow as Program<Escrow>;

  // Keypairs for testing
  const maker = Keypair.generate();
  const taker = Keypair.generate();
  let mintA: PublicKey; // Token A mint
  let mintB: PublicKey; // Token B mint
  let makerAtaA: PublicKey; // Maker's ATA for Token A
  let makerAtaB: PublicKey; // Maker's ATA for Token B
  let takerAtaA: PublicKey; // Taker's ATA for Token A
  let takerAtaB: PublicKey; // Taker's ATA for Token B
  let escrowAccount: Keypair;
  let vaultPda: PublicKey;

  before(async () => {
    // Airdrop SOL to test wallets
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(maker.publicKey, 1e9)
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(taker.publicKey, 1e9)
    );

    // Create token mints
    mintA = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      9
    );
    mintB = await createMint(
      provider.connection,
      taker,
      taker.publicKey,
      null,
      9
    );

    // Create ATAs for maker and taker
    makerAtaA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      maker,
      mintA,
      maker.publicKey
    ).then((ata) => ata.address);

    makerAtaB = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      maker,
      mintB,
      maker.publicKey
    ).then((ata) => ata.address);

    takerAtaA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      taker,
      mintA,
      taker.publicKey
    ).then((ata) => ata.address);

    takerAtaB = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      taker,
      mintB,
      taker.publicKey
    ).then((ata) => ata.address);

    // Mint tokens to maker and taker
    await mintTo(
      provider.connection,
      maker,
      mintA,
      makerAtaA,
      maker,
      1000 * 1e9
    ); // 1000 Token A
    await mintTo(
      provider.connection,
      taker,
      mintB,
      takerAtaB,
      taker,
      1000 * 1e9
    ); // 1000 Token B

    it('Initialize escrow and deposit tokens', async () => {
      const seed = 123; // Unique seed for the escrow
      const depositAmount = new anchor.BN(100 * 1e9); // 100 Token A
      const receiveAmount = new anchor.BN(50 * 1e9); // 50 Token B

      // Initialize escrow
      escrowAccount = Keypair.generate();
      const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          maker.publicKey.toBuffer(),
          Buffer.from(seed.toString()),
        ],
        program.programId
      );

      await program.methods
        .make(new anchor.BN(seed), receiveAmount, depositAmount)
        .accounts({
          maker: maker.publicKey,
          mintA: mintA,
          mintB: mintB,
          makerAtaMintA: makerAtaA,
          escrow: escrowAccount.publicKey,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker, escrowAccount])
        .rpc();

      // Check escrow state
      const escrowState = await program.account.escrowState.fetch(
        escrowAccount.publicKey
      );
      assert.equal(escrowState.maker.toString(), maker.publicKey.toString());
      assert.equal(
        escrowState.receiveAmount.toString(),
        receiveAmount.toString()
      );

      // Check vault balance
      const vaultBalance = await getAccount(provider.connection, vaultPda);
      assert.equal(vaultBalance.amount.toString(), depositAmount.toString());
    });

    it('Taker completes the swap', async () => {
      await program.methods
        .take()
        .accounts({
          taker: taker.publicKey,
          maker: maker.publicKey, 
          mintA: mintA,
          mintB: mintB,
          takerAtaMintA: takerAtaA,
          takerAtaMintB: takerAtaB,
          makerAtaMintB: makerAtaB,
          escrow: escrowAccount.publicKey,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc();

      // Check balances after swap
      const makerBalanceB = await getAccount(provider.connection, makerAtaB);
      const takerBalanceA = await getAccount(provider.connection, takerAtaA);
      assert.equal(makerBalanceB.amount.toString(), '50000000000'); // 50 Token B
      assert.equal(takerBalanceA.amount.toString(), '100000000000'); // 100 Token A
    });

    it("Refund if taker doesn't have enough funds", async () => {
      // Attempt to take with insufficient funds
      try {
        await program.methods
          .take()
          .accounts({
            taker: taker.publicKey,
            maker: maker.publicKey,
            mintA: mintA,
            mintB: mintB,
            takerAtaMintA: takerAtaA,
            takerAtaMintB: takerAtaB,
            makerAtaMintB: makerAtaB,
            escrow: escrowAccount.publicKey,
            vault: vaultPda,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([taker])
          .rpc();
      } catch (err) {
        assert.include(err.message, 'InsufficientFunds');
      }

      // Refund tokens to maker
      await program.methods
        .refund()
        .accounts({
          maker: maker.publicKey,
          mintA: mintA,
          makerAtaMintA: makerAtaA,
          escrow: escrowAccount.publicKey,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      // Check maker's balance after refund
      const makerBalanceA = await getAccount(provider.connection, makerAtaA);
      assert.equal(makerBalanceA.amount.toString(), '1000000000000'); // 1000 Token A
    });
  });
});
