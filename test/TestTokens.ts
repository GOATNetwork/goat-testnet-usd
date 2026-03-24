import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { getAddress, parseSignature } from "viem";

describe("Test tokens", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, spender, recipient] = await viem.getWalletClients();
  const ownerAddress = getAddress(owner.account.address);
  const spenderAddress = getAddress(spender.account.address);
  const recipientAddress = getAddress(recipient.account.address);

  const permitTypes = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;

  async function deployTokens() {
    const usdc = await viem.deployContract("TestUSDC");
    const usdt = await viem.deployContract("TestUSDT");

    return { usdc, usdt };
  }

  async function signPermit(
    usdc: Awaited<ReturnType<typeof viem.deployContract<"TestUSDC">>>,
    signer: typeof owner,
    ownerAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    value: bigint,
    deadline: bigint,
  ) {
    const nonce = await usdc.read.nonces([ownerAddress]);
    const chainId = await publicClient.getChainId();

    const signature = await signer.signTypedData({
      account: signer.account,
      domain: {
        name: "Test USDC",
        version: "1",
        chainId,
        verifyingContract: usdc.address,
      },
      types: permitTypes,
      primaryType: "Permit",
      message: {
        owner: ownerAddress,
        spender: spenderAddress,
        value,
        nonce,
        deadline,
      },
    });

    const parsed = parseSignature(signature);

    return {
      nonce,
      v: parsed.v ? Number(parsed.v) : parsed.yParity + 27,
      r: parsed.r,
      s: parsed.s,
    };
  }

  it("deploys both tokens with the expected metadata", async function () {
    const { usdc, usdt } = await deployTokens();

    assert.equal(await usdc.read.name(), "Test USDC");
    assert.equal(await usdc.read.symbol(), "tUSDC");
    assert.equal(await usdc.read.decimals(), 18);
    assert.equal(await usdc.read.owner(), ownerAddress);
    assert.equal(await usdc.read.totalSupply(), 0n);

    assert.equal(await usdt.read.name(), "Test USDT");
    assert.equal(await usdt.read.symbol(), "tUSDT");
    assert.equal(await usdt.read.decimals(), 18);
    assert.equal(await usdt.read.owner(), ownerAddress);
    assert.equal(await usdt.read.totalSupply(), 0n);
  });

  it("lets the owner mint and rejects non-owner mint attempts", async function () {
    const { usdc, usdt } = await deployTokens();

    await usdc.write.mint([recipientAddress, 100n]);
    await usdt.write.mint([recipientAddress, 250n]);

    assert.equal(await usdc.read.balanceOf([recipientAddress]), 100n);
    assert.equal(await usdc.read.totalSupply(), 100n);
    assert.equal(await usdt.read.balanceOf([recipientAddress]), 250n);
    assert.equal(await usdt.read.totalSupply(), 250n);

    await viem.assertions.revertWithCustomErrorWithArgs(
      usdc.write.mint([recipientAddress, 1n], { account: spender.account }),
      usdc,
      "OwnableUnauthorizedAccount",
      [spenderAddress],
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      usdt.write.mint([recipientAddress, 1n], { account: spender.account }),
      usdt,
      "OwnableUnauthorizedAccount",
      [spenderAddress],
    );
  });

  it("supports permit on TestUSDC and allows transferFrom after approval", async function () {
    const { usdc } = await deployTokens();
    const value = 25n;
    const deadline = (1n << 255n) - 1n;

    await usdc.write.mint([ownerAddress, value]);

    const signature = await signPermit(
      usdc,
      owner,
      ownerAddress,
      spenderAddress,
      value,
      deadline,
    );

    await usdc.write.permit(
      [
        ownerAddress,
        spenderAddress,
        value,
        deadline,
        signature.v,
        signature.r,
        signature.s,
      ],
      { account: spender.account },
    );

    assert.equal(
      await usdc.read.allowance([ownerAddress, spenderAddress]),
      value,
    );

    await usdc.write.transferFrom([ownerAddress, recipientAddress, value], {
      account: spender.account,
    });

    assert.equal(await usdc.read.balanceOf([ownerAddress]), 0n);
    assert.equal(await usdc.read.balanceOf([recipientAddress]), value);
  });

  it("rejects expired permits on TestUSDC without changing allowance", async function () {
    const { usdc } = await deployTokens();
    const value = 10n;
    const latestBlock = await publicClient.getBlock();
    const deadline = latestBlock.timestamp - 1n;

    await usdc.write.mint([ownerAddress, value]);

    const signature = await signPermit(
      usdc,
      owner,
      ownerAddress,
      spenderAddress,
      value,
      deadline,
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      usdc.write.permit(
        [
          ownerAddress,
          spenderAddress,
          value,
          deadline,
          signature.v,
          signature.r,
          signature.s,
        ],
        { account: spender.account },
      ),
      usdc,
      "ERC2612ExpiredSignature",
      [deadline],
    );

    assert.equal(await usdc.read.allowance([ownerAddress, spenderAddress]), 0n);
  });

  it("rejects invalid permit signers on TestUSDC without changing allowance", async function () {
    const { usdc } = await deployTokens();
    const value = 10n;
    const deadline = (1n << 255n) - 1n;

    await usdc.write.mint([ownerAddress, value]);

    const signature = await signPermit(
      usdc,
      spender,
      ownerAddress,
      spenderAddress,
      value,
      deadline,
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      usdc.write.permit(
        [
          ownerAddress,
          spenderAddress,
          value,
          deadline,
          signature.v,
          signature.r,
          signature.s,
        ],
        { account: spender.account },
      ),
      usdc,
      "ERC2612InvalidSigner",
      [spenderAddress, ownerAddress],
    );

    assert.equal(await usdc.read.allowance([ownerAddress, spenderAddress]), 0n);
  });

  it("uses standard approve and transferFrom flow on TestUSDT", async function () {
    const { usdt } = await deployTokens();
    const value = 40n;

    await usdt.write.mint([ownerAddress, value]);
    await usdt.write.approve([spenderAddress, value]);

    assert.equal(
      await usdt.read.allowance([ownerAddress, spenderAddress]),
      value,
    );

    await usdt.write.transferFrom([ownerAddress, recipientAddress, value], {
      account: spender.account,
    });

    assert.equal(await usdt.read.balanceOf([ownerAddress]), 0n);
    assert.equal(await usdt.read.balanceOf([recipientAddress]), value);
  });
});
