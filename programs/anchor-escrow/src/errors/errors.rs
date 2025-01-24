use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Cannot use same mint for both tokens")]
    SameMint,
    #[msg("Insufficient balance in maker's account")]
    InsufficientBalance,
    #[msg("Invalid vault account")]
    InvalidVault,
    #[msg("Overflow/underflow detected")]
    Overflow,
}
