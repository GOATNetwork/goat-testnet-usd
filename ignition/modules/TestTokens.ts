import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TestTokensModule", (m) => {
  const testUSDC = m.contract("TestUSDC");
  const testUSDT = m.contract("TestUSDT");

  return { testUSDC, testUSDT };
});
