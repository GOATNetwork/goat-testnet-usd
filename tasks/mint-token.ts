import { readFile } from "node:fs/promises";
import path from "node:path";

import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";

interface MintTokenTaskArguments {
  token: string;
  recipient: string;
  amount: string;
}

type TokenName = "TestUSDC" | "TestUSDT";
type DeploymentAddresses = Record<string, `0x${string}`>;
const moduleIdByToken: Record<TokenName, string> = {
  TestUSDC: "TestTokensModule#TestUSDC",
  TestUSDT: "TestTokensModule#TestUSDT",
};

function resolveTokenName(value: string): TokenName {
  const normalized = value.toLowerCase();

  if (
    normalized === "usdc" ||
    normalized === "tusdc" ||
    normalized === "testusdc"
  ) {
    return "TestUSDC";
  }

  if (
    normalized === "usdt" ||
    normalized === "tusdt" ||
    normalized === "testusdt"
  ) {
    return "TestUSDT";
  }

  throw new Error(`Unsupported token "${value}". Use usdc or usdt.`);
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
  tokenName: TokenName,
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

  const moduleId = moduleIdByToken[tokenName];
  const deployedAddress = addresses[moduleId];

  if (deployedAddress === undefined) {
    throw new Error(
      `Deployment record ${moduleId} not found in ${deploymentFile}. Re-run the TestTokens Ignition deployment for this network.`,
    );
  }

  return getAddress(deployedAddress);
}

export default async function (
  taskArguments: MintTokenTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { token, recipient, amount } = taskArguments;

  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`);
  }

  const tokenName = resolveTokenName(token);
  const recipientAddress = getAddress(recipient);
  const mintAmount = parseUnits(amount, 18);

  const connection = await hre.network.connect();
  const { viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();
  const tokenAddress = await loadDeploymentAddress(chainId, tokenName);
  const explorerUrl = resolveExplorerUrl(hre, connection.networkName, chainId);

  console.log(
    `Minting ${amount} ${token.toUpperCase()} to ${recipientAddress}`,
  );
  console.log(`Token contract: ${tokenAddress}`);
  console.log(`Resolved from chain ID: ${chainId}`);
  console.log(`Network: ${connection.networkName}`);
  console.log(`Sender: ${walletClient.account.address}`);

  const txHash =
    tokenName === "TestUSDC"
      ? await (
          await viem.getContractAt("TestUSDC", tokenAddress)
        ).write.mint([recipientAddress, mintAmount], {
          account: walletClient.account,
        })
      : await (
          await viem.getContractAt("TestUSDT", tokenAddress)
        ).write.mint([recipientAddress, mintAmount], {
          account: walletClient.account,
        });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  const balance =
    tokenName === "TestUSDC"
      ? await (
          await viem.getContractAt("TestUSDC", tokenAddress)
        ).read.balanceOf([recipientAddress])
      : await (
          await viem.getContractAt("TestUSDT", tokenAddress)
        ).read.balanceOf([recipientAddress]);

  console.log(`Transaction hash: ${txHash}`);
  if (explorerUrl !== undefined) {
    console.log(
      `Transaction URL: ${explorerUrl.replace(/\/$/, "")}/tx/${txHash}`,
    );
  }
  console.log(`Block number: ${receipt.blockNumber}`);
  console.log(`Recipient balance: ${formatUnits(balance, 18)}`);
}
