import { HardhatRuntimeEnvironment } from "hardhat/types/hre";

interface AccountTaskArguments {
  // No argument in this case
}

export default async function (
  taskArguments: AccountTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const { provider } = await hre.network.connect();
  console.log(await provider.request({ method: "eth_accounts" }));
}
