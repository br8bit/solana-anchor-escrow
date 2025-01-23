use anchor_lang::prelude::*;

declare_id!("YWmvbfPjngWsrCzm8grWzTpP5FVeJRCZuELtFV9EWxX");

#[program]
pub mod anchor_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
