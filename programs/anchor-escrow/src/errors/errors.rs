use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Cannot use same mint for both tokens")]
    SameMint,
    #[msg("Insufficient balance in maker's account")]
    InsufficientBalance,
    #[msg("Overflow/underflow detected")]
    Overflow,
    #[msg("Account is frozen")]
    AccountFrozen,
    #[msg("Invalid vault authority")]
    InvalidVaultAuthority,
    #[msg("Vault already contains funds")]
    VaultAlreadyFunded,
}
