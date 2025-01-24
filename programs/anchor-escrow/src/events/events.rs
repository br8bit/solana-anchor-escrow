use anchor_lang::prelude::*;

#[event]
pub struct DepositEvent {
    pub maker: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
