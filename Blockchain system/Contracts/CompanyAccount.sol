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
    address[] private employeeList;

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
        require(msg.sender == Admin, "Only admin can withdraw deposit");
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

    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash) internal view returns (uint256 validationData)
    {
        address signer = ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(userOpHash), userOp.signature);
        ( ,  ,  , address claimedSigner) = abi.decode(userOp.callData[4:], (address, uint256, bytes, address));
        if (claimedSigner == signer && (bytes(employeeRoles[signer]).length != 0 || signer == Admin))
        {
            return SIG_VALIDATION_SUCCESS;
        }
        return SIG_VALIDATION_FAILED;
    }

    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256 validationData)
    {
        require(msg.sender == address(_entryPoint), "Only entry point can call this function");
        validationData = _validateSignature(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }

    function execute(address target, uint256 value, bytes calldata data, address signer) external
    {
        require(msg.sender == address(_entryPoint), "Only entry point can call this function");
        require(target == contractConnect, "Only connected contract can be called");
        string memory role1 = "cert_responsible";
        string memory role2 = "employee";

        bytes4 selector = bytes4(data[:4]);

        if (keccak256(abi.encodePacked((employeeRoles[signer]))) == keccak256(abi.encodePacked((role1))) && 
        (selector == bytes4(keccak256("addProductCertificate(address,uint256,string)")) || selector == bytes4(keccak256("deleteProductCertificate(address,uint256,uint256)"))))
        {
            address firstArg = abi.decode(data[4:36], (address));
            require(signer == firstArg, "Employee can add or delete product certificate under only his own account");
            _call(target, value, data);
        } 
        else if (keccak256(abi.encodePacked((employeeRoles[signer]))) == keccak256(abi.encodePacked((role2))) && 
        (selector == bytes4(keccak256("addProductInfo(address,string,string,string,string,uint256,address)")) || selector == bytes4(keccak256("deleteProductInfo(address,uint256)")) || selector == bytes4(keccak256("addProductPublicKey(address,uint256,string)"))))
        {
            address firstArg = abi.decode(data[4:36], (address));
            require(signer == firstArg, "Employee can add, delete or update product info under only his own account");
            _call(target, value, data);
        }
        else if (signer == Admin && (selector == bytes4(keccak256("changeStatus(uint256,address)")) || selector == bytes4(keccak256("logPathHistory(uint256,address,address,string,string)"))))
        {
            _call(target, value, data);
        }
        else if((signer == Admin || keccak256(abi.encodePacked((employeeRoles[signer]))) == keccak256(abi.encodePacked((role1))) || keccak256(abi.encodePacked((employeeRoles[signer]))) == keccak256(abi.encodePacked((role2)))) && selector == bytes4(keccak256("verifyProduct(uint256,address,bool)")))
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
        if (bytes(employeeRoles[wallet]).length == 0)
        {
            employeeList.push(wallet);
        }
        employeeRoles[wallet] = role;
    }

    function checkRole(address wallet) external view returns (string memory)
    {
        if (wallet == Admin)
        {
            return "admin";
        }
        else if (bytes(employeeRoles[wallet]).length != 0)
        {
            return employeeRoles[wallet];
        }
        else
        {
            return "No role";
        }
    }

    function removeEmployeeRole(address wallet) external
    {
        require(msg.sender == Admin, "Only admin can call this function");
        delete employeeRoles[wallet];
        uint256 len = employeeList.length;
        for (uint256 i = 0; i < len; i++)
        {
            if (employeeList[i] == wallet)
            {
                employeeList[i] = employeeList[len - 1];
                employeeList.pop();
                break;
            }
        }
    }

    function getAllEmployees() external view returns (address[] memory wallets, string[] memory roles)
    {
        uint256 len = employeeList.length;
        wallets = new address[](len);
        roles = new string[](len);

        for (uint256 i = 0; i < len; i++)
        {
            wallets[i] = employeeList[i];
            roles[i] = employeeRoles[employeeList[i]];
        }
        return (wallets, roles);
    }

    function changeContractConnect(address contractAdd) external 
    {
        require(msg.sender == Admin, "Only admin can call this function");
        contractConnect = contractAdd;
    }

    function _call(address target, uint256 value, bytes memory data) internal 
    {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) 
        {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    receive() external payable {}
}