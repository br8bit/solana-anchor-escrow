# Use the latest Rust version as the base image
FROM rust:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libssl-dev \
    pkg-config \
    python3 \
    git \
    curl \
    && apt-get clean

# Ensure Rust is updated to the latest stable version
RUN rustup update stable && rustup default stable

# Install Solana CLI
RUN curl -sSfL https://release.solana.com/v1.16.10/install | bash
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked \
    && avm install latest \
    && avm use latest

# Verify installations
RUN solana --version && anchor --version

# Set the working directory inside the container
WORKDIR /workdir
