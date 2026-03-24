// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Test} from "forge-std/Test.sol";

import {TestUSDC} from "./TestUSDC.sol";
import {TestUSDT} from "./TestUSDT.sol";

contract TestTokensTest is Test {
    TestUSDC internal usdc;
    TestUSDT internal usdt;

    address internal user = makeAddr("user");

    function setUp() public {
        usdc = new TestUSDC();
        usdt = new TestUSDT();
    }

    function test_InitialMetadata() public view {
        assertEq(usdc.name(), "Test USDC");
        assertEq(usdc.symbol(), "tUSDC");
        assertEq(usdc.decimals(), 18);
        assertEq(usdc.owner(), address(this));
        assertEq(usdc.totalSupply(), 0);

        assertEq(usdt.name(), "Test USDT");
        assertEq(usdt.symbol(), "tUSDT");
        assertEq(usdt.decimals(), 18);
        assertEq(usdt.owner(), address(this));
        assertEq(usdt.totalSupply(), 0);
    }

    function test_OwnerCanMintTestUSDC() public {
        usdc.mint(user, 100 ether);

        assertEq(usdc.balanceOf(user), 100 ether);
        assertEq(usdc.totalSupply(), 100 ether);
    }

    function test_OwnerCanMintTestUSDT() public {
        usdt.mint(user, 250 ether);

        assertEq(usdt.balanceOf(user), 250 ether);
        assertEq(usdt.totalSupply(), 250 ether);
    }

    function test_NonOwnerCannotMintTestUSDC() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                user
            )
        );
        usdc.mint(user, 1 ether);
    }

    function test_NonOwnerCannotMintTestUSDT() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                Ownable.OwnableUnauthorizedAccount.selector,
                user
            )
        );
        usdt.mint(user, 1 ether);
    }
}
