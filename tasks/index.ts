import { task } from "hardhat/config";

const printAccounts = task("accounts", "Print the accounts")
  .setAction(() => import("./accounts.js"))
  .build();

const mintToken = task("mint-token", "Mint TestUSDC or TestUSDT to a recipient")
  .addPositionalArgument({
    name: "token",
    description: "Token selector: usdc or usdt",
  })
  .addPositionalArgument({
    name: "recipient",
    description: "Recipient address",
  })
  .addPositionalArgument({
    name: "amount",
    description: "Human-readable token amount with 18 decimals",
  })
  .setAction(() => import("./mint-token.js"))
  .build();

export const tasks = [printAccounts, mintToken];
