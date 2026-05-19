const { expect } = require("chai");
const hre = require("hardhat");

const {loadFixture,} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("LogisticsAccount: connection management", function ()
{
    async function deploy()
    {
        const [admin, employee1, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const LogisticsAccount = await hre.ethers.deployContract("LogisticsAccount",[EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await LogisticsAccount.waitForDeployment();
        return { LogisticsAccount, EntryPoint, ProductRegistry, admin, employee1, user};
    }

    it("Access denied (changeContractConnect) ", async function ()
    {
        const { LogisticsAccount, user } = await loadFixture(deploy);
        await expect(LogisticsAccount.connect(user).changeContractConnect(user.address)).to.be.revertedWith("Only admin can call this function");
    });

    it("Admin can change the connected contract address", async function ()
    {
        const { LogisticsAccount, admin, user } = await loadFixture(deploy);
        await expect(LogisticsAccount.connect(admin).changeContractConnect(user.address)).to.not.be.reverted;
    });

    it("EntryPoint address is stored correctly", async function ()
    {
        const { LogisticsAccount, EntryPoint } = await loadFixture(deploy);
        expect(await LogisticsAccount.getEntryPoint()).to.equal(EntryPoint.target);
    });

    it("Admin checkRole returns 'admin'", async function ()
    {
        const { LogisticsAccount, admin } = await loadFixture(deploy);
        expect(await LogisticsAccount.checkRole(admin.address)).to.equal("admin");
    });

    it("Unknown address checkRole returns 'No role'", async function ()
    {
        const { LogisticsAccount, user } = await loadFixture(deploy);
        expect(await LogisticsAccount.checkRole(user.address)).to.equal("No role");
    });
});


describe("LogisticsAccount: role management", function ()
{
    async function deploy()
    {
        const [admin, employee1, employee2, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const LogisticsAccount = await hre.ethers.deployContract("LogisticsAccount",[EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await LogisticsAccount.waitForDeployment();
        return { LogisticsAccount, EntryPoint, ProductRegistry, admin, employee1, employee2, user };
    }

    it("Access denied (addEmployeeRole)", async function ()
    {
        const { LogisticsAccount, user, employee1 } = await loadFixture(deploy);
        await expect(LogisticsAccount.connect(user).addEmployeeRole(employee1.address)).to.be.revertedWith("Only admin can call this function");
    });

    it("Access denied (removeEmployeeRole)", async function ()
    {
        const { LogisticsAccount, admin, employee1, user } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee1.address);
        await expect(LogisticsAccount.connect(user).removeEmployeeRole(employee1.address)).to.be.revertedWith("Only admin can call this function");
    });

    it("Cannot add the same employee twice", async function ()
    {
        const { LogisticsAccount, admin, employee1 } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee1.address);
        await expect(LogisticsAccount.connect(admin).addEmployeeRole(employee1.address)).to.be.revertedWith("This wallet already has employee role");
    });

    it("Admin can add an employee", async function ()
    {
        const { LogisticsAccount, admin, employee1 } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee1.address);
        expect(await LogisticsAccount.checkRole(employee1.address)).to.equal("employee");
    });

    it("Admin can remove an employee", async function ()
    {
        const { LogisticsAccount, admin, employee1 } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee1.address);
        await LogisticsAccount.connect(admin).removeEmployeeRole(employee1.address);
        expect(await LogisticsAccount.checkRole(employee1.address)).to.equal("No role");
    });

    it("getAllEmployees returns registered wallets", async function ()
    {
        const { LogisticsAccount, admin, employee1, employee2 } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee1.address);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee2.address);
        const wallets = await LogisticsAccount.getAllEmployees();
        expect(wallets.length).to.equal(2);
        expect(wallets).to.include(employee1.address);
        expect(wallets).to.include(employee2.address);
    });

    it("getAllEmployees list shrinks after removal", async function ()
    {
        const { LogisticsAccount, admin, employee1, employee2 } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee1.address);
        await LogisticsAccount.connect(admin).addEmployeeRole(employee2.address);
        await LogisticsAccount.connect(admin).removeEmployeeRole(employee1.address);
        const wallets = await LogisticsAccount.getAllEmployees();
        expect(wallets.length).to.equal(1);
        expect(wallets[0]).to.equal(employee2.address);
    });

    it("getAllEmployees returns empty list initially", async function ()
    {
        const { LogisticsAccount } = await loadFixture(deploy);
        const wallets = await LogisticsAccount.getAllEmployees();
        expect(wallets.length).to.equal(0);
    });
});


describe("LogisticsAccount: deposit management", function ()
{
    async function deploy()
    {
        const [admin, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const LogisticsAccount = await hre.ethers.deployContract("LogisticsAccount",[EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await LogisticsAccount.waitForDeployment();
        return { LogisticsAccount, EntryPoint, ProductRegistry, admin, user };
    }

    it("Initial deposit is zero", async function ()
    {
        const { LogisticsAccount } = await loadFixture(deploy);
        expect(await LogisticsAccount.getDeposit()).to.equal(0n);
    });

    it("Access denied (withdrawDepositTo)", async function ()
    {
        const { LogisticsAccount, user } = await loadFixture(deploy);
        await expect(LogisticsAccount.connect(user).withdrawDepositTo(user.address, 1n)).to.be.revertedWith("Only admin can withdraw deposit");
    });

    it("Access denied (addDeposit)", async function ()
    {
        const { LogisticsAccount, user } = await loadFixture(deploy);
        await expect( LogisticsAccount.connect(user).addDeposit({ value: hre.ethers.parseEther("1") })).to.be.revertedWith("Only admin can withdraw deposit");
    });

    it("Admin can add a deposit and getDeposit increases", async function ()
    {
        const { LogisticsAccount, admin } = await loadFixture(deploy);
        await LogisticsAccount.connect(admin).addDeposit({ value: hre.ethers.parseEther("1") });
        expect(await LogisticsAccount.getDeposit()).to.equal(hre.ethers.parseEther("1"));
    });

    it("receive() accepts ETH", async function ()
    {
        const { LogisticsAccount, admin } = await loadFixture(deploy);
        await expect(
            admin.sendTransaction({ to: LogisticsAccount.target, value: hre.ethers.parseEther("1") })
        ).to.not.be.reverted;
    });
});

describe("LogisticsAccount: validateUserOp()", function ()
{
    async function deploy()
    {
        const [admin, employee, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const LogisticsAccount = await hre.ethers.deployContract( "LogisticsAccount", [EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await LogisticsAccount.waitForDeployment();
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [EntryPoint.target] });
        await hre.network.provider.send("hardhat_setBalance", [EntryPoint.target, "0x1000000000000000000"]);
        const epSigner = await hre.ethers.getSigner(EntryPoint.target);
        return { LogisticsAccount, EntryPoint, ProductRegistry, admin, employee, user, epSigner };
    }

    function buildUserOp(sender, callData, signature)
    {
        return {
            sender,
            nonce: 0n,
            initCode: "0x",
            callData,
            accountGasLimits: hre.ethers.ZeroHash,
            preVerificationGas: 0n,
            gasFees: hre.ethers.ZeroHash,
            paymasterAndData: "0x",
            signature,
        };
    }

    it("Access denied (validateUserOp) not EntryPoint", async function ()
    {
        const { LogisticsAccount, ProductRegistry, admin } = await loadFixture(deploy);
        const userOpHash = hre.ethers.id("test");
        const sig = await admin.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = LogisticsAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(LogisticsAccount.target, callData, sig);
        await expect(LogisticsAccount.connect(admin).validateUserOp(fakeOp, userOpHash, 0n)).to.be.revertedWith("Only entry point can call this function");
    });

    it("validateUserOp returns SIG_VALIDATION_SUCCESS", async function ()
    {
        const { LogisticsAccount, ProductRegistry, admin, epSigner } = await loadFixture(deploy);
        const userOpHash = hre.ethers.id("kjfnskjfkj");
        const sig = await admin.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = LogisticsAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(LogisticsAccount.target, callData, sig);
        const result = await LogisticsAccount.connect(epSigner).validateUserOp.staticCall(fakeOp, userOpHash, 0n);
        expect(result).to.equal(0n);
    });

    it("validateUserOp returns SIG_VALIDATION_FAILED", async function ()
    {
        const { LogisticsAccount, ProductRegistry, admin, user, epSigner } = await loadFixture(deploy);
        const userOpHash = hre.ethers.id("lkafkjfkaj");
        const sig = await user.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = LogisticsAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(LogisticsAccount.target, callData, sig);
        const result = await LogisticsAccount.connect(epSigner).validateUserOp.staticCall(fakeOp, userOpHash, 0n);
        expect(result).to.equal(1n);
    });

    it("validateUserOp triggers _payPrefund when missingAccountFunds > 0", async function ()
    {
        const { LogisticsAccount, ProductRegistry, admin, epSigner } = await loadFixture(deploy);
        await admin.sendTransaction({ to: LogisticsAccount.target, value: hre.ethers.parseEther("1") });
        const userOpHash = hre.ethers.id("jawkfkajwfkajhf");
        const sig = await admin.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = LogisticsAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(LogisticsAccount.target, callData, sig);
        await expect(LogisticsAccount.connect(epSigner).validateUserOp(fakeOp, userOpHash, hre.ethers.parseEther("0.1"))).to.not.be.reverted;
    });
});


describe("LogisticsAccount: execute())", function ()
{
    async function deploy()
    {
        const [registryManager, manufacturer, logisticsAdmin, employee1, employee2, recipient] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract("CompanyAccount", [EntryPoint.target, ProductRegistry.target],{ signer: manufacturer });
        await CompanyAccount.waitForDeployment();
        const LogisticsAccount = await hre.ethers.deployContract("LogisticsAccount", [EntryPoint.target, ProductRegistry.target], { signer: logisticsAdmin });
        await LogisticsAccount.waitForDeployment();
        await ProductRegistry.connect(registryManager).addManufacturer(CompanyAccount.target);
        await ProductRegistry.connect(registryManager).addLogisticsProvider(LogisticsAccount.target);
        await LogisticsAccount.connect(logisticsAdmin).addEmployeeRole(employee1.address);
        await LogisticsAccount.connect(logisticsAdmin).addEmployeeRole(employee2.address);

        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner).addProductInfo(manufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(caSigner).addProductPublicKey(manufacturer.address, 1, "pubkey");
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner2 = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner2).changeStatus(1, CompanyAccount.target);
        await ProductRegistry.connect(caSigner2).logPathHistory(1, CompanyAccount.target, LogisticsAccount.target, "Origin Warehouse", "initial handoff");
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [EntryPoint.target] });
        await hre.network.provider.send("hardhat_setBalance", [EntryPoint.target, "0x1000000000000000000"]);
        const epSigner = await hre.ethers.getSigner(EntryPoint.target);

        return {LogisticsAccount, CompanyAccount, ProductRegistry, EntryPoint,
            registryManager, manufacturer, logisticsAdmin, employee1, employee2, recipient, epSigner,};
    }

    it("Access denied (execute) not EntryPoint", async function ()
    {
        const { LogisticsAccount, ProductRegistry, logisticsAdmin, employee1 } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("logCondition", [1, employee1.address, "temperature", -18n, "celsius",]);
        await expect(LogisticsAccount.connect(logisticsAdmin).execute(ProductRegistry.target, 0, callData, employee1.address)
        ).to.be.revertedWith("Only entry point can call this function");
    });

    it("execute reverts when target is not the connected contract", async function ()
    {
        const { LogisticsAccount, epSigner, employee1, recipient } = await loadFixture(deploy);
        const fakeData = "0x27419284741290";
        await expect(LogisticsAccount.connect(epSigner).execute(recipient.address, 0, fakeData, employee1.address)
        ).to.be.revertedWith("Only connected contract can be called");
    });

    it("Reverts (logPathHistory) when 'to' is not a registered employee", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, employee1, recipient } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("logPathHistory", [1, CompanyAccount.target, recipient.address, "Russia", "leg 2",]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee1.address)
        ).to.be.revertedWith("Only registered employees can transfer the product");
    });

    it("Reverts (logCondition) when employee is not the current holder", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, employee1, employee2 } = await loadFixture(deploy);

        const transferData = ProductRegistry.interface.encodeFunctionData("logPathHistory", [1, CompanyAccount.target, employee2.address, "Russia", "",]);
        await LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, transferData, employee1.address);
        const condData = ProductRegistry.interface.encodeFunctionData("logCondition", [1, CompanyAccount.target, "humidity", 65n, "percent",]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, condData, employee1.address)
        ).to.be.revertedWith("Only current holder can log condition");
    });

    it("No role causes execute to revert'", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, recipient } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("logCondition", [1, CompanyAccount.target, "temperature", -18n, "celsius",]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, recipient.address)
        ).to.be.revertedWith("No role: access denied");
    });

    it("Employee can log a condition for a product", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, employee1 } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("logCondition", [1, CompanyAccount.target, "temperature", -10n, "celsius",]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee1.address)).to.not.be.reverted;
        const logs = await ProductRegistry.getConditionLogs(1, CompanyAccount.target);
        expect(logs.length).to.equal(1);
        expect(logs[0].conditionType).to.equal("temperature");
        expect(logs[0].value).to.equal(-10n);
    });

    it("Employee can transfer product to another registered employee", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, employee1, employee2 } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("logPathHistory", [1, CompanyAccount.target, employee2.address, "Russia", "leg 2",]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee1.address)
        ).to.not.be.reverted;
        const path = await ProductRegistry.getProductPathHistory(1, CompanyAccount.target);
        expect(path.length).to.equal(2);
        expect(path[1].to).to.equal(employee2.address);
    });

    it("Employee can call changeStatus to mark product as Delivered", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, employee1 } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("changeStatus", [1, CompanyAccount.target]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee1.address)
        ).to.not.be.reverted;
        const info = await ProductRegistry.getProductInfo(1, CompanyAccount.target);
        expect(info[6]).to.equal(3n);
    });

     it("Employee can call verifyProduct via execute", async function ()
    {
        const { LogisticsAccount, ProductRegistry, CompanyAccount, epSigner, employee1 } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("verifyProduct", [1, CompanyAccount.target, true]);
        await expect(LogisticsAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee1.address)).to.not.be.reverted;
    });
});