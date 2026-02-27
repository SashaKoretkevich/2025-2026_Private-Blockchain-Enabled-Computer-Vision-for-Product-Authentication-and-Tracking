// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {SIG_VALIDATION_FAILED, SIG_VALIDATION_SUCCESS} from "@account-abstraction/contracts/core/Helpers.sol";


contract CompanyAccount is IAccount
{
    address private Admin;
    IEntryPoint private immutable _entryPoint;
    address private contractConnect;
    mapping(address => string) private employeeRoles;
    uint256 private constant SIGNER_SLOT = uint256(keccak256("SIGNER_SLOT"));

    constructor(IEntryPoint entryPointAdd, address contractAddress)
    {
        _entryPoint = entryPointAdd;
        Admin  = msg.sender;
        contractConnect = contractAddress;
    }

    function getEntryPoint() public view returns (IEntryPoint)
    {
        return _entryPoint;
    }

    function getDeposit() public virtual view returns (uint256)
    {
        return _entryPoint.balanceOf(address(this));
    }

    function addDeposit() public payable
    {
        require(msg.sender == Admin, "Only admin can add deposit");
        _entryPoint.depositTo{value: msg.value}(address(this));
    }


    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public virtual
    {
        require(msg.sender == Admin, "Only admin can withdraw deposit");
        _entryPoint.withdrawTo(withdrawAddress, amount);
    }

    function _payPrefund(uint256 missingAccountFunds) internal 
    {
        if (missingAccountFunds != 0)
        {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds, gas: type(uint256).max}("");
            if (!success)
            {
                revert("Failed to pay prefund");
            }
        }
    }

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash) internal returns (uint256 validationData)
    {
        address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(userOpHash), userOp.signature);
        if (bytes(employeeRoles[signer]).length != 0 || signer == Admin)
        { 
            uint256 slot = SIGNER_SLOT;
            uint256 signerVal = uint256(uint160(signer));
            assembly {
                tstore(slot, signerVal)
            }
            return SIG_VALIDATION_SUCCESS;
        }
        return SIG_VALIDATION_FAILED;
    }

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData)
    {
        require(msg.sender == address(_entryPoint), "Only entry point can call this function");
        validationData = _validateSignature(userOp, userOpHash);
        // _validateNonce()
        _payPrefund(missingAccountFunds);
    }

    function execute(address target, uint256 value, bytes calldata data) external
    {
        require(msg.sender == address(_entryPoint), "Only entry point can call this function");
        string memory role1 = "cert_responsible";
        string memory role2 = "employee";
        address signer;
        uint256 slot = SIGNER_SLOT;
        assembly {
            signer := tload(slot)
            tstore(slot, 0)
        }

        bytes4 selector = bytes4(data[:4]);

        if (selector == bytes4(keccak256("getProductInfo(uint256,uint256)")) || selector == bytes4(keccak256("getAuthManufacturer(uint256)")) || selector == bytes4(keccak256("verifyProduct(uint256,uint256,bytes)"))) 
        {
            _call(target, value, data);

        } 
        else if (keccak256(abi.encodePacked((employeeRoles[signer]))) == keccak256(abi.encodePacked((role1))) && (selector == bytes4(keccak256("addProductCertificate(uint256,uint256,string)")) || selector == bytes4(keccak256("deleteProductCertificate(uint256,uint256,uint256)"))))
        {
            _call(target, value, data);

        } 
        else if (keccak256(abi.encodePacked((employeeRoles[signer]))) == keccak256(abi.encodePacked((role2))) && (selector == bytes4(keccak256("addProductInfo(uint256,string,string,uint256,string,string,uint256)")) || selector == bytes4(keccak256("deleteProductInfo(uint256,uint256)"))))
        {
            _call(target, value, data);

        } 
        else 
        {
            revert("No role: access denied");
        }
    }

    function addEmployeeRole(address wallet, string memory role) external 
    {
        require(msg.sender == Admin, "Only admin can call this function");
        employeeRoles[wallet] = role;
    }

    function removeEmployeeRole(address wallet) external
    {
        require(msg.sender == Admin, "Only admin can call this function");
        delete(employeeRoles[wallet]);
    }

    function changeContractConnect(address contractAdd) external 
    {
        require(msg.sender == Admin, "Only admin can call this function");
        contractConnect = contractAdd;
    }

    function _call(address target, uint256 value, bytes memory data) internal 
    {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    receive() external payable {}
}