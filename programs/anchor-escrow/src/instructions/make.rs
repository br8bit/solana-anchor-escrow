use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken, 
    token_interface::{
        transfer_checked,
        Mint,
        TokenAccount,
        TokenInterface,
        TransferChecked
    }
};

use crate::{
    events::DepositEvent,
    state::EscrowState,
    errors::EscrowError,
};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct Make<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(constraint = mint_a.key() != mint_b.key() @ EscrowError::SameMint)]
    pub mint_a: InterfaceAccount<'info, Mint>,
    pub mint_b: InterfaceAccount<'info, Mint>,

    #[account(
        mut, 
        associated_token::mint = mint_a, 
        associated_token::authority = maker,
    )]
    pub maker_ata_mint_a: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init, 
        payer = maker, 
        space = 8 + EscrowState::INIT_SPACE, 
        seeds=[b"escrow", maker.key().as_ref(), seed.to_le_bytes().as_ref()], 
        bump
    )] 
    pub escrow: Account<'info, EscrowState>,

    #[account(
        init,
        payer = maker,
        associated_token::mint = mint_a, 
        associated_token::authority = escrow,
        associated_token::token_program = token_program
    )] 
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl Make<'_> {
    pub fn init_escrow_state(
        &mut self, 
        seed: u64, 
        receive_amount: u64, 
        bumps: &MakeBumps
    ) -> Result<()> {
        self.escrow.set_inner(EscrowState {
            receive_amount,
            maker: self.maker.key(),
            mint_a: self.mint_a.key(),
            mint_b: self.mint_b.key(),
            seed,
            bump: bumps.escrow,
            created_at: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {

        require!(self.maker_ata_mint_a.amount >= amount, EscrowError::InsufficientBalance);

        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            from: self.maker_ata_mint_a.to_account_info(),
            to: self.vault.to_account_info(),
            mint: self.mint_a.to_account_info(),
            authority: self.maker.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_ctx, amount, self.mint_a.decimals)?;

        emit!(DepositEvent {
            maker: self.maker.key(),
            amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}
