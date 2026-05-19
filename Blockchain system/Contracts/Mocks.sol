// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IStakeManager.sol";
import "@account-abstraction/contracts/interfaces/ISenderCreator.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

contract MockEntryPoint is IEntryPoint {

    mapping(address => uint256) private _deposits;

    function depositTo(address account) external payable override
    {
        _deposits[account] += msg.value;
    }

    function balanceOf(address account) external view override returns (uint256)
    {
        return _deposits[account];
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external override
    {
        require(_deposits[msg.sender] >= withdrawAmount, "MockEP: insufficient deposit");
        _deposits[msg.sender] -= withdrawAmount;
        (bool ok,) = withdrawAddress.call{value: withdrawAmount}("");
        require(ok, "MockEP: withdraw failed");
    }

    function getDepositInfo(address account) external view override returns (IStakeManager.DepositInfo memory info)
    {
        info.deposit = uint112(_deposits[account]);
    }

    function addStake(uint32) external payable override {}
    function unlockStake() external override {}
    function withdrawStake(address payable) external override {}
    function handleOps(PackedUserOperation[] calldata, address payable) external override {}
    function handleAggregatedOps(UserOpsPerAggregator[] calldata, address payable) external override {}
    function getSenderAddress(bytes memory) external override {}
    function delegateAndRevert(address, bytes calldata) external override {}
    function incrementNonce(uint192) external override {}

    function getUserOpHash(PackedUserOperation calldata) external pure override returns (bytes32)
    {
        return bytes32(0);
    }

    function getNonce(address, uint192) external pure override returns (uint256)
    {
        return 0;
    }

    function senderCreator() external pure override returns (ISenderCreator)
    {
        return ISenderCreator(address(0));
    }

    receive() external payable {}
}