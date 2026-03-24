# tUSDT/tUSDC Test Tokens for goat testnet networks

This project is a Hardhat 3 + TypeScript + viem setup for two OpenZeppelin-based ERC20 test tokens:

- `TestUSDC`: `Test USDC` / `tUSDC`, standard ERC20 plus EIP-2612 permit.
- `TestUSDT`: `Test USDT` / `tUSDT`, standard ERC20 without permit.

Both tokens:

- use 18 decimals,
- start with zero supply,
- set the deployer as `owner`,
- expose `mint(address to, uint256 amount)` restricted to the owner.

## Requirements

- Node.js `22.10.0+` LTS is recommended by Hardhat 3.
- npm dependencies include `@openzeppelin/contracts`, `hardhat`, `viem`, and the Hardhat viem toolbox.

## Running Tests

Run the full test suite:

```shell
npx hardhat test
```

The Solidity tests cover metadata, owner minting, and access control. The `node:test` suite covers deployment, minting, `permit`, expired/invalid signatures, and the normal `approve` / `transferFrom` flow.

## Deploying With Ignition

Deploy both tokens to a local simulated chain:

```shell
npx hardhat ignition deploy ignition/modules/TestTokens.ts
```

Deploy to Testnet3:

```shell
npx hardhat keystore set GOAT_TESTNET3_DEPLOY_PRIVATE_KEY
npx hardhat ignition deploy --network testnet3 ignition/modules/TestTokens.ts
```

The deployment module returns both contract instances:

- `testUSDC`
- `testUSDT`

## Minting Tokens

Use the Hardhat task below to mint tokens from the owner account configured for the target network:

```shell
npx hardhat --network testnet3 mint-token tusdc <recipient-address> 1000
npx hardhat --network testnet3 mint-token tusdt <recipient-address> 500
npx hardhat --network testnet3 mint-token all <recipient-address> 1000
```

- The first argument accepts `tusdc`, `tusdt`, or `all`.
- The second argument is the recipient address.
- The third argument is the human-readable token amount.
- `all` will mint the same amount of both `tUSDT` and `tUSDC` to the recipient.
- The task resolves the token contract address from `ignition/deployments/chain-<chainId>/deployed_addresses.json`.
- `amount` is parsed with 18 decimals.
- You must already have deployed `TestTokensModule` to the target network with Ignition.
- The configured signer for the selected network must be the token owner, otherwise the transaction will revert.

## Contracts

- [contracts/TestUSDC.sol](./contracts/TestUSDC.sol)
- [contracts/TestUSDT.sol](./contracts/TestUSDT.sol)
