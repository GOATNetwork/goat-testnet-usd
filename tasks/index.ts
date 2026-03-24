import { task } from "hardhat/config";

const printAccounts = task("accounts", "Print the accounts")
  .setAction(() => import("./accounts.js"))
  .build();

const mintToken = task("mint-token", "Mint tUSDC, tUSDT, or both to a recipient")
  .addPositionalArgument({
    name: "token",
    description: "Token selector: tusdc, tusdt, usdc, usdt, testusdc, testusdt, or all",
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
