import { readFile } from "node:fs/promises";
import path from "node:path";

import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { Account } from "viem";
import { getAddress, isAddress, parseUnits } from "viem";

interface MintTokenTaskArguments {
  token: string;
  recipient: string;
  amount: string;
}

type DeploymentAddresses = Record<string, `0x${string}`>;
const tokenSpecs = {
  tusdt: {
    selector: "tusdt",
    symbol: "tUSDT",
    contractName: "TestUSDT",
    moduleId: "TestTokensModule#TestUSDT",
  },
  tusdc: {
    selector: "tusdc",
    symbol: "tUSDC",
    contractName: "TestUSDC",
    moduleId: "TestTokensModule#TestUSDC",
  },
} as const;

type TokenSelector = keyof typeof tokenSpecs;
type TokenSpec = (typeof tokenSpecs)[TokenSelector];
const tokenAliases: Record<string, TokenSpec> = {
  tusdt: tokenSpecs.tusdt,
  usdt: tokenSpecs.tusdt,
  testusdt: tokenSpecs.tusdt,
  tusdc: tokenSpecs.tusdc,
  usdc: tokenSpecs.tusdc,
  testusdc: tokenSpecs.tusdc,
};

function resolveTokenSpecs(value: string): TokenSpec[] {
  const normalized = value.toLowerCase();

  if (normalized === "all") {
    return [tokenSpecs.tusdt, tokenSpecs.tusdc];
  }

  const tokenSpec = tokenAliases[normalized];

  if (tokenSpec === undefined) {
    throw new Error(
      `Unsupported token "${value}". Use tusdt, tusdc, usdt, usdc, testusdt, testusdc, or all.`,
    );
  }

  return [tokenSpec];
}

function resolveExplorerUrl(
  hre: HardhatRuntimeEnvironment,
  networkName: string,
  chainId: number,
): string | undefined {
  const networkExplorerUrl =
    hre.config.networks[networkName]?.ignition?.explorerUrl;

  if (networkExplorerUrl !== undefined) {
    return networkExplorerUrl;
  }

  const chainDescriptor = hre.config.chainDescriptors.get(BigInt(chainId));

  if (chainDescriptor === undefined) {
    return undefined;
  }

  for (const explorer of Object.values(chainDescriptor.blockExplorers)) {
    if (explorer.url !== undefined) {
      return explorer.url;
    }
  }

  return undefined;
}

async function loadDeploymentAddress(
  chainId: number,
  tokenSpec: TokenSpec,
): Promise<`0x${string}`> {
  const deploymentFile = path.resolve(
    process.cwd(),
    "ignition",
    "deployments",
    `chain-${chainId}`,
    "deployed_addresses.json",
  );

  let addresses: DeploymentAddresses;

  try {
    const file = await readFile(deploymentFile, "utf8");
    addresses = JSON.parse(file) as DeploymentAddresses;
  } catch (error) {
    throw new Error(
      `Ignition deployment record not found for chain ${chainId} at ${deploymentFile}. Run "npx hardhat --network <network> ignition deploy ignition/modules/TestTokens.ts" first.`,
      { cause: error },
    );
  }

  const deployedAddress = addresses[tokenSpec.moduleId];

  if (deployedAddress === undefined) {
    throw new Error(
      `Deployment record ${tokenSpec.moduleId} not found in ${deploymentFile}. Re-run the TestTokens Ignition deployment for this network.`,
    );
  }

  return getAddress(deployedAddress);
}

async function sendMintTransaction(
  viem: Awaited<
    ReturnType<HardhatRuntimeEnvironment["network"]["connect"]>
  >["viem"],
  tokenSpec: TokenSpec,
  tokenAddress: `0x${string}`,
  recipientAddress: `0x${string}`,
  mintAmount: bigint,
  account: Account,
) {
  if (tokenSpec.contractName === "TestUSDC") {
    const contract = await viem.getContractAt("TestUSDC", tokenAddress);
    return contract.write.mint([recipientAddress, mintAmount], {
      account,
    });
  }

  const contract = await viem.getContractAt("TestUSDT", tokenAddress);
  return contract.write.mint([recipientAddress, mintAmount], {
    account,
  });
}

async function readRecipientBalance(
  viem: Awaited<
    ReturnType<HardhatRuntimeEnvironment["network"]["connect"]>
  >["viem"],
  tokenSpec: TokenSpec,
  tokenAddress: `0x${string}`,
  recipientAddress: `0x${string}`,
) {
  if (tokenSpec.contractName === "TestUSDC") {
    const contract = await viem.getContractAt("TestUSDC", tokenAddress);
    return contract.read.balanceOf([recipientAddress]);
  }

  const contract = await viem.getContractAt("TestUSDT", tokenAddress);
  return contract.read.balanceOf([recipientAddress]);
}

function formatExplorerTransactionUrl(
  explorerUrl: string | undefined,
  txHash: `0x${string}`,
): string | undefined {
  if (explorerUrl === undefined) {
    return undefined;
  }

  return `${explorerUrl.replace(/\/$/, "")}/tx/${txHash}`;
}

function printSection(
  title: string,
  rows: Array<[string, string | number | bigint | undefined]>,
) {
  console.log(`\n=== ${title} ===`);

  for (const [label, value] of rows) {
    if (value === undefined) {
      continue;
    }

    console.log(`${label.padEnd(10)} ${value}`);
  }
}

export default async function (
  taskArguments: MintTokenTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { token, recipient, amount } = taskArguments;

  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`);
  }

  const selectedTokenSpecs = resolveTokenSpecs(token);
  const recipientAddress = getAddress(recipient);
  const mintAmount = parseUnits(amount, 18);

  const connection = await hre.network.connect();
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();
  const explorerUrl = resolveExplorerUrl(hre, connection.networkName, chainId);

  printSection("Context", [
    ["Network", connection.networkName],
    ["Chain ID", chainId],
    ["Recipient", recipientAddress],
    ["Amount", amount],
    ["Sender", walletClient.account.address],
  ]);

  for (const tokenSpec of selectedTokenSpecs) {
    const tokenAddress = await loadDeploymentAddress(chainId, tokenSpec);
    const txHash = await sendMintTransaction(
      viem,
      tokenSpec,
      tokenAddress,
      recipientAddress,
      mintAmount,
      walletClient.account,
    );
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    const transactionUrl = formatExplorerTransactionUrl(explorerUrl, txHash);

    printSection(tokenSpec.symbol, [
      ["Contract", tokenAddress],
      ["Tx Hash", txHash],
      ["Explorer", transactionUrl],
      ["Block", receipt.blockNumber],
    ]);
  }
}
