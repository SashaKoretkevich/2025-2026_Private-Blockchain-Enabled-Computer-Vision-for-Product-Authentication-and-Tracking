const { expect } = require("chai");
const hre = require("hardhat");

const {loadFixture,} = require("@nomicfoundation/hardhat-toolbox/network-helpers");


describe("CompanyAccount: connection management", function ()
{
    async function deploy()
    {
        const [admin, employee1, employee2, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract("CompanyAccount",[EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await CompanyAccount.waitForDeployment();
        return { CompanyAccount, EntryPoint, ProductRegistry, admin, employee1, employee2, user };
    }

    it("Access denied (changeContractConnect)", async function ()
    {
        const { CompanyAccount, user } = await loadFixture(deploy);
        await expect(CompanyAccount.connect(user).changeContractConnect(user.address)).to.be.revertedWith("Only admin can call this function");
    });

    it("Admin can change the connected contract address", async function ()
    {
        const { CompanyAccount, admin, user } = await loadFixture(deploy);
        await expect(CompanyAccount.connect(admin).changeContractConnect(user.address)).to.not.be.reverted;
    });

    it("EntryPoint address is stored correctly", async function ()
    {
        const { CompanyAccount, EntryPoint } = await loadFixture(deploy);
        expect(await CompanyAccount.getEntryPoint()).to.equal(EntryPoint.target);
    });

    it("Admin checkRole returns 'admin'", async function ()
    {
        const { CompanyAccount, admin } = await loadFixture(deploy);
        expect(await CompanyAccount.checkRole(admin.address)).to.equal("admin");
    });

    it("Unknown address checkRole returns 'No role'", async function ()
    {
        const { CompanyAccount, user } = await loadFixture(deploy);
        expect(await CompanyAccount.checkRole(user.address)).to.equal("No role");
    });
});


describe("CompanyAccount: role management", function ()
{
    async function deploy()
    {
        const [admin, employee1, employee2, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract(
            "CompanyAccount",
            [EntryPoint.target, ProductRegistry.target],
            { signer: admin }
        );
        await CompanyAccount.waitForDeployment();
        return { CompanyAccount, EntryPoint, ProductRegistry, admin, employee1, employee2, user };
    }

    it("Access denied (addEmployeeRole)", async function ()
    {
        const { CompanyAccount, user, employee1 } = await loadFixture(deploy);
        await expect(
            CompanyAccount.connect(user).addEmployeeRole(employee1.address, "employee")
        ).to.be.revertedWith("Only admin can call this function");
    });

    it("Access denied (removeEmployeeRole)", async function ()
    {
        const { CompanyAccount, admin, employee1, user } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "employee");
        await expect(
            CompanyAccount.connect(user).removeEmployeeRole(employee1.address)
        ).to.be.revertedWith("Only admin can call this function");
    });

    it("Admin can add an employee with role 'employee'", async function ()
    {
        const { CompanyAccount, admin, employee1 } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "employee");
        expect(await CompanyAccount.checkRole(employee1.address)).to.equal("employee");
    });

    it("Admin can add an employee with role 'cert_responsible'", async function ()
    {
        const { CompanyAccount, admin, employee1 } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "cert_responsible");
        expect(await CompanyAccount.checkRole(employee1.address)).to.equal("cert_responsible");
    });

    it("Admin can overwrite an existing employee role", async function ()
    {
        const { CompanyAccount, admin, employee1 } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "employee");
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "cert_responsible");
        expect(await CompanyAccount.checkRole(employee1.address)).to.equal("cert_responsible");
    });

    it("Admin can remove an employee role", async function ()
    {
        const { CompanyAccount, admin, employee1 } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "employee");
        await CompanyAccount.connect(admin).removeEmployeeRole(employee1.address);
        expect(await CompanyAccount.checkRole(employee1.address)).to.equal("No role");
    });

    it("getAllEmployees returns correct wallets and roles", async function ()
    {
        const { CompanyAccount, admin, employee1, employee2 } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "employee");
        await CompanyAccount.connect(admin).addEmployeeRole(employee2.address, "cert_responsible");
        const [wallets, roles] = await CompanyAccount.getAllEmployees();
        expect(wallets.length).to.equal(2);
        expect(wallets).to.include(employee1.address);
        expect(wallets).to.include(employee2.address);
        const idx1 = wallets.indexOf(employee1.address);
        const idx2 = wallets.indexOf(employee2.address);
        expect(roles[idx1]).to.equal("employee");
        expect(roles[idx2]).to.equal("cert_responsible");
    });

    it("getAllEmployees list shrinks after removal", async function ()
    {
        const { CompanyAccount, admin, employee1, employee2 } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee1.address, "employee");
        await CompanyAccount.connect(admin).addEmployeeRole(employee2.address, "employee");
        await CompanyAccount.connect(admin).removeEmployeeRole(employee1.address);
        const [wallets] = await CompanyAccount.getAllEmployees();
        expect(wallets.length).to.equal(1);
        expect(wallets[0]).to.equal(employee2.address);
    });

    it("getAllEmployees returns empty list initially", async function ()
    {
        const { CompanyAccount } = await loadFixture(deploy);
        const [wallets, roles] = await CompanyAccount.getAllEmployees();
        expect(wallets.length).to.equal(0);
        expect(roles.length).to.equal(0);
    });
});


describe("CompanyAccount: deposit management", function ()
{
    async function deploy()
    {
        const [admin, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract(
            "CompanyAccount",
            [EntryPoint.target, ProductRegistry.target],
            { signer: admin }
        );
        await CompanyAccount.waitForDeployment();
        return { CompanyAccount, EntryPoint, ProductRegistry, admin, user };
    }

     it("Initial deposit is zero", async function ()
    {
        const { CompanyAccount } = await loadFixture(deploy);
        expect(await CompanyAccount.getDeposit()).to.equal(0n);
    });

    it("Access denied (withdrawDepositTo)", async function ()
    {
        const { CompanyAccount, user } = await loadFixture(deploy);
        await expect(CompanyAccount.connect(user).withdrawDepositTo(user.address, 1n)).to.be.revertedWith("Only admin can withdraw deposit");
    });

    it("Access denied (addDeposit)", async function ()
    {
        const { CompanyAccount, user } = await loadFixture(deploy);
        await expect(CompanyAccount.connect(user).addDeposit({ value: hre.ethers.parseEther("1") })).to.be.revertedWith("Only admin can withdraw deposit");
    });

    it("Admin can add a deposit and getDeposit increases", async function ()
    {
        const { CompanyAccount, admin } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addDeposit({ value: hre.ethers.parseEther("1") });
        expect(await CompanyAccount.getDeposit()).to.equal(hre.ethers.parseEther("1"));
    });

    it("receive() accepts ETH", async function ()
    {
        const { CompanyAccount, admin } = await loadFixture(deploy);
        await expect(admin.sendTransaction({ to: CompanyAccount.target, value: hre.ethers.parseEther("1") })).to.not.be.reverted;
    });
});

describe("CompanyAccount: validateUserOp()", function ()
{
    async function deploy()
    {
        const [admin, employee, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract("CompanyAccount",[EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await CompanyAccount.waitForDeployment();
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [EntryPoint.target] });
        await hre.network.provider.send("hardhat_setBalance", [EntryPoint.target, "0x1000000000000000000"]);
        const epSigner = await hre.ethers.getSigner(EntryPoint.target);
        return { CompanyAccount, EntryPoint, ProductRegistry, admin, employee, user, epSigner };
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
        const { CompanyAccount, ProductRegistry, admin } = await loadFixture(deploy);
        const userOpHash = hre.ethers.id("mwqlrlrwlr");
        const sig = await admin.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = CompanyAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(CompanyAccount.target, callData, sig);
        await expect(CompanyAccount.connect(admin).validateUserOp(fakeOp, userOpHash, 0n)).to.be.revertedWith("Only entry point can call this function");
    });

    it("validateUserOp returns SIG_VALIDATION_SUCCESS", async function ()
    {
        const { CompanyAccount, ProductRegistry, admin, epSigner } = await loadFixture(deploy);
        const userOpHash = hre.ethers.id("felajljflekjfklw");
        const sig = await admin.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = CompanyAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(CompanyAccount.target, callData, sig);
        const result = await CompanyAccount.connect(epSigner).validateUserOp.staticCall(fakeOp, userOpHash, 0n);
        expect(result).to.equal(0n);
    });

    it("validateUserOp returns SIG_VALIDATION_FAILED", async function ()
    {
        const { CompanyAccount, ProductRegistry, admin, user, epSigner } = await loadFixture(deploy);
        const userOpHash = hre.ethers.id("test-op-wrong");
        const sig = await user.signMessage(hre.ethers.getBytes(userOpHash)); 
        const callData = CompanyAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(CompanyAccount.target, callData, sig);
        const result = await CompanyAccount.connect(epSigner).validateUserOp.staticCall(fakeOp, userOpHash, 0n);
        expect(result).to.equal(1n);
    });

    it("validateUserOp triggers _payPrefund when missingAccountFunds > 0", async function ()
    {
        const { CompanyAccount, ProductRegistry, admin, epSigner } = await loadFixture(deploy);
        await admin.sendTransaction({ to: CompanyAccount.target, value: hre.ethers.parseEther("1") });
        const userOpHash = hre.ethers.id("ewjfslaskjfaskjf");
        const sig = await admin.signMessage(hre.ethers.getBytes(userOpHash));
        const callData = CompanyAccount.interface.encodeFunctionData("execute", [ProductRegistry.target, 0n, "0x", admin.address]);
        const fakeOp = buildUserOp(CompanyAccount.target, callData, sig);
        await expect(CompanyAccount.connect(epSigner).validateUserOp(fakeOp, userOpHash, hre.ethers.parseEther("0.1"))).to.not.be.reverted;
    });
});


describe("CompanyAccount: execute())", function ()
{
    async function deploy()
    {
        const [admin, employee, certEmployee, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract("CompanyAccount",[EntryPoint.target, ProductRegistry.target],{ signer: admin });
        await CompanyAccount.waitForDeployment();
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [EntryPoint.target] });
        await hre.network.provider.send("hardhat_setBalance", [EntryPoint.target, "0x1000000000000000000"]);
        const epSigner = await hre.ethers.getSigner(EntryPoint.target);
        return { CompanyAccount, EntryPoint, ProductRegistry, admin, employee, certEmployee, user, epSigner };
    }

    it("Access denied (execute) not EntryPoint", async function ()
    {
        const { CompanyAccount, admin, ProductRegistry } = await loadFixture(deploy);
        const callData = ProductRegistry.interface.encodeFunctionData("addProductInfo", [admin.address, "Device", "SN-001", "DE", "FR", 100, admin.address,]);
        await expect(CompanyAccount.connect(admin).execute(ProductRegistry.target, 0, callData, admin.address)
        ).to.be.revertedWith("Only entry point can call this function");
    });

    it("execute reverts when target is not the connected contract", async function ()
    {
        const { CompanyAccount, epSigner, admin, user } = await loadFixture(deploy);
        const fakeData = "0x47247294794974";
        await expect(CompanyAccount.connect(epSigner).execute(user.address, 0, fakeData, admin.address)
        ).to.be.revertedWith("Only connected contract can be called");
    });

    it("execute (employee) reverts when calers first arg is not their own address", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin, employee, user } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee.address, "employee");
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        const callData = ProductRegistry.interface.encodeFunctionData("addProductInfo", [user.address, "Device", "SN-001", "DE", "FR", 100, user.address,]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee.address)).to.be.revertedWith("Employee can add, delete or update product info under only his own account");
    });

    it("execute (certificate manager) reverts when first arg is not their own address", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin, certEmployee, user } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(certEmployee.address, "cert_responsible");
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        const callData = ProductRegistry.interface.encodeFunctionData("addProductCertificate", [user.address, 1, "ewfehfejkfhkfn",]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, certEmployee.address)).to.be.revertedWith("Employee can add or delete product certificate under only his own account");
    });

    it("No role causes execute to revert", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, user } = await loadFixture(deploy);
        await ProductRegistry.connect(user).addManufacturer;
        const callData = ProductRegistry.interface.encodeFunctionData("addProductInfo", [user.address, "Device", "SN-001", "DE", "FR", 100, user.address,]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, user.address)).to.be.revertedWith("No role: access denied");
    });

    it("Employee can call addProductInfo", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin, employee } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee.address, "employee");
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        const callData = ProductRegistry.interface.encodeFunctionData("addProductInfo", [employee.address, "Device", "SN-001", "DE", "FR", 100, admin.address,]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee.address)).to.not.be.reverted;
    });

    it("Certificate manager can addProductCertificate", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin, certEmployee } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(certEmployee.address, "cert_responsible");
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);

        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner).addProductInfo(certEmployee.address, "Device", "SN-001", "DE", "FR", 100, admin.address);
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        const callData = ProductRegistry.interface.encodeFunctionData("addProductCertificate", [certEmployee.address, 1, "jhdskdjwkld",]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, certEmployee.address)).to.not.be.reverted;
    });

    it("Admin can change status", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin } = await loadFixture(deploy);
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner).addProductInfo(admin.address, "Device", "SN-001", "DE", "FR", 100, admin.address);
        await ProductRegistry.connect(caSigner).addProductPublicKey(admin.address, 1, "pubkey");
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        const callData = ProductRegistry.interface.encodeFunctionData("changeStatus", [1, CompanyAccount.target]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, admin.address)).to.not.be.reverted;
    });

    it("Employee can call verifyProduct", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin, employee } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(employee.address, "employee");
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner).addProductInfo(admin.address, "Device", "SN-001", "DE", "FR", 100, admin.address);
        await ProductRegistry.connect(caSigner).addProductPublicKey(admin.address, 1, "pubkey");
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        const callData = ProductRegistry.interface.encodeFunctionData("verifyProduct", [1, CompanyAccount.target, true]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, employee.address)).to.not.be.reverted;
    });

    it("Certificate manager can call verifyProduct", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin, certEmployee } = await loadFixture(deploy);
        await CompanyAccount.connect(admin).addEmployeeRole(certEmployee.address, "cert_responsible");
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner).addProductInfo(admin.address, "Device", "SN-001", "DE", "FR", 100, admin.address);
        await ProductRegistry.connect(caSigner).addProductPublicKey(admin.address, 1, "pubkey");
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        const callData = ProductRegistry.interface.encodeFunctionData("verifyProduct", [1, CompanyAccount.target, true]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, certEmployee.address)).to.not.be.reverted;
    });

    it("Admin can call verifyProduct", async function ()
    {
        const { CompanyAccount, ProductRegistry, epSigner, admin } = await loadFixture(deploy);
        await ProductRegistry.connect(admin).addManufacturer(CompanyAccount.target);
        await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [CompanyAccount.target] });
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
        const caSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(caSigner).addProductInfo(admin.address, "Device", "SN-001", "DE", "FR", 100, admin.address);
        await ProductRegistry.connect(caSigner).addProductPublicKey(admin.address, 1, "pubkey");
        await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target] });
        const callData = ProductRegistry.interface.encodeFunctionData("verifyProduct", [1, CompanyAccount.target, true]);
        await expect(CompanyAccount.connect(epSigner).execute(ProductRegistry.target, 0, callData, admin.address)).to.not.be.reverted;
    });
});




