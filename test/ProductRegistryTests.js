const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = require("ethers");


const 
{
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");


describe("Access management", function ()
{
    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        return {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Access denied (addManufacturer)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).addManufacturer(authManufacturer.address)).to.be.revertedWith("Only manager can call this function");
    });

    it("Access denied (deleteManufacturer)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).deleteManufacturer(authManufacturer.address)).to.be.revertedWith("Only manager can call this function");
    });

    it("Access denied (addLogisticsProvider)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).addLogisticsProvider(authLogistics.address)).to.be.revertedWith("Only manager can call this function");
    });

    it("Access denied (deleteLogisticsProvider)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).deleteLogisticsProvider(authLogistics.address)).to.be.revertedWith("Only manager can call this function");
    });

    it("Manager can add a manufacturer", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        expect(await ProductRegistry.isManufacturer(authManufacturer.address)).to.be.true;
    });

    it("Manager cannot register the same address twice", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await expect(ProductRegistry.connect(manager).addManufacturer(authManufacturer.address)).to.be.revertedWith("Manufacturer with such address already exists");
    });

    it("СheckManufacturer returns false for unknown address", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        expect(await ProductRegistry.isManufacturer(user.address)).to.be.false;
    });

    it("Manager can delete a manufacturer", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).deleteManufacturer(authManufacturer.address);
        expect(await ProductRegistry.isManufacturer(authManufacturer.address)).to.be.false;
    });

    it("Manager can add a logistics provider", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        expect(await ProductRegistry.isLogistic(authLogistics.address)).to.be.true;
    });

    it("CheckLogisticsProvider returns false for unknown address", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        expect(await ProductRegistry.isLogistic(user.address)).to.be.false;
    });

    it("Manager can delete a logistics provider", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(manager).deleteLogisticsProvider(authLogistics.address);
        expect(await ProductRegistry.isLogistic(authLogistics.address)).to.be.false;
    });

});


describe("Manufacturer role", function () 
{
    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        return {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Access denied (addProductInfo)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).addProductInfo(user.address, "Test Product", "SN123456", "Origin", "Destination", 100, user.address)).to.be.revertedWith("Only authenticated manufacturer can add product info");
    });

    it("Access denied (addProductCertificate)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).addProductCertificate(user.address, 1, "https://cert.example.com/iso")).to.be.revertedWith("Only authenticated manufacturer can add product certificate");
    });

    it("Access denied (deleteProductInfo)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).deleteProductInfo(user.address, 1)).to.be.revertedWith("Only manufacturer can delete product info");
    });

    it("Access denied (deleteProductCertificate)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await expect(ProductRegistry.connect(user).deleteProductCertificate(user.address, 1, 0)).to.be.revertedWith("Only authenticated manufacturer can delete product certificate");
    });

     it("Out-of-bounds certificate index revert", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/1");
        await expect(ProductRegistry.connect(authManufacturer).deleteProductCertificate(user.address, 1, 5)).to.be.revertedWith("Certificate index out of bounds");
    });

    it("Manufacturer cannot add certificate to non-existent product", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await expect(ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 999, "https://cert.example.com/iso")).to.be.revertedWith("Product does not exist");
    });
    
    it("Auth manufacturer can add a product", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 500, recipient.address);
        const info = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        expect(info[0]).to.equal("Device");
        expect(info[1]).to.equal("SN-001");
        expect(info[2]).to.equal(authManufacturer.address);
        expect(info[5]).to.equal(0n);
        expect(info[8]).to.equal(recipient.address);
    });

    it("Emits ProductAdded event", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        const tx = await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 500, recipient.address);
        const receipt = await tx.wait();
        const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
        await expect(tx).to.emit(ProductRegistry, "ProductAdded").withArgs(1, authManufacturer.address, user.address, block.timestamp);
    });

    it("Product IDs incrementation", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-002", "DE", "FR", 200, recipient.address);
        const product1 = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        const product2 = await ProductRegistry.getProductInfo(2, authManufacturer.address);
        expect(product1[1]).to.equal("SN-001");
        expect(product2[1]).to.equal("SN-002");
    });

    it("Manufacturer can delete a product", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).deleteProductInfo(authManufacturer.address, 1);
        const product = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        expect(product[9]).to.equal(0n);
    });

    it("Emits ProductDeleted event", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        const tx = await ProductRegistry.connect(authManufacturer).deleteProductInfo(user.address, 1);
        const receipt = await tx.wait();
        const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
        await expect(tx).to.emit(ProductRegistry, "ProductDeleted").withArgs(1, authManufacturer.address, user.address, block.timestamp);
    });

    it("Cleans up path and condition logs", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "initial");
        await ProductRegistry.connect(authManufacturer).deleteProductInfo(authManufacturer.address, 1);
        const path = await ProductRegistry.getProductPathHistory(1, authManufacturer.address);
        expect(path.length).to.equal(0);
    });

    it("Manufacturer can add a certificate", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/iso");
        const product = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        expect(product[7].length).to.equal(1);
        expect(product[7][0]).to.equal("https://cert.example.com/iso");
    });

    it("Emits CertificateAdded event", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        const tx = await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/iso");
        const receipt = await tx.wait();
        const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
        await expect(tx).to.emit(ProductRegistry, "CertificateAdded").withArgs(1, authManufacturer.address, user.address, block.timestamp);
    });

    it("Manufacturer can delete a certificate", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/1");
        await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/2");
        await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/3");
        await ProductRegistry.connect(authManufacturer).deleteProductCertificate(user.address, 1, 1);
        const info = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        expect(info[7].length).to.equal(2);
        expect(info[7][0]).to.equal("https://cert.example.com/1");
        expect(info[7][1]).to.equal("https://cert.example.com/3");
    });

    it("Emits CertificateDeleted event", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductCertificate(user.address, 1, "https://cert.example.com/1");
        const tx = await ProductRegistry.connect(authManufacturer).deleteProductCertificate(user.address, 1, 0);
        const receipt = await tx.wait();
        const block = await hre.ethers.provider.getBlock(receipt.blockNumber);
        await expect(tx).to.emit(ProductRegistry, "CertificateDeleted").withArgs(1, authManufacturer.address, user.address, block.timestamp);
    });

    it("Manufacturer can change product status", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        const infoAfter = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        expect(infoAfter[5]).to.equal(1n); 
    });

    it("Manufacturer can log the first path record", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg Port", "Handoff to DHL");
        const path = await ProductRegistry.getProductPathHistory(1, authManufacturer.address);
        expect(path.length).to.equal(1);
        expect(path[0].from).to.equal(authManufacturer.address);
        expect(path[0].to).to.equal(authLogistics.address);
        expect(path[0].location).to.equal("Hamburg Port");
    });

    it("Emits ProductPath event", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await expect(ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "note")
        ).to.emit(ProductRegistry, "ProductPath")
        .withArgs(1, authManufacturer.address, authManufacturer.address, authLogistics.address, "Hamburg");
    });
});

describe("Logistics Providers", function () 
{
    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        return {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Access denied (logPathHistory)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Test Product", "SN123456", "Origin", "Destination", 100, recipient.address);
        await expect(ProductRegistry.connect(user).logPathHistory(1, authManufacturer.address, recipient.address, "Location", "Note")).to.be.revertedWith("Only logistics providers or manufacturer can log path history");
    });

    it("Access denied (logCondition)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Test Product", "SN123456", "Origin", "Destination", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Test Product", "SN123456", "Origin", "Destination", 100, recipient.address);
        await expect(ProductRegistry.connect(user).logCondition(1, authManufacturer.address, "humidity", 65n, "percent")).to.be.revertedWith("Only logistics provider can log condition");
    });

    it("LogPathHistory reverts for non-existent product", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await expect(ProductRegistry.connect(authLogistics).logPathHistory(999, authManufacturer.address, user.address, "Hamburg", "")).to.be.revertedWith("Product does not exist");
    });

    it("Non-current-holder cannot log path history", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "");
        await expect(ProductRegistry.connect(user).logPathHistory(1, authManufacturer.address, recipient.address, "Paris", "")).to.be.revertedWith("Only logistics providers or manufacturer can log path history");
    });

    it("Logistics provider can log path history after receiving the product", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "");
        await ProductRegistry.connect(authLogistics).logPathHistory(1, authManufacturer.address, user.address, "Berlin Hub", "");
        const path = await ProductRegistry.getProductPathHistory(1, authManufacturer.address);
        expect(path.length).to.equal(2);
        expect(path[1].from).to.equal(authLogistics.address);
    });

    it("Logistics provider can log product condition", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "");
        await ProductRegistry.connect(authLogistics).logCondition(1, authManufacturer.address, "temperature", -18n, "celsius");
        const logs = await ProductRegistry.getConditionLogs(1, authManufacturer.address);
        expect(logs.length).to.equal(1);
        expect(logs[0].conditionType).to.equal("temperature");
        expect(logs[0].value).to.equal(-18n);
        expect(logs[0].unit).to.equal("celsius");
    });

    it("Emits ConditionLogged event", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "");
        await expect(ProductRegistry.connect(authLogistics).logCondition(1, authManufacturer.address, "humidity", 65n, "percent")
        ).to.emit(ProductRegistry, "ConditionLogged")
        .withArgs(1, authManufacturer.address, "humidity", 65n);
    });

    it("Condition logs are stored in order check", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).logPathHistory(1, authManufacturer.address, authLogistics.address, "Hamburg", "");
        await ProductRegistry.connect(authLogistics).logCondition(1, authManufacturer.address, "temperature", -18n, "celsius");
        await ProductRegistry.connect(authLogistics).logCondition(1, authManufacturer.address, "humidity",    65n,  "percent");
        const logs = await ProductRegistry.getConditionLogs(1, authManufacturer.address);
        expect(logs.length).to.equal(2);
        expect(logs[1].conditionType).to.equal("humidity");
    });

    it("Logistics provider can call changeStatus when status is InTransit", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(manager).addLogisticsProvider(authLogistics.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).changeStatus(1, authManufacturer.address);
        await ProductRegistry.connect(authLogistics).changeStatus(1, authManufacturer.address);
        const infoAfter = await ProductRegistry.getProductInfo(1, authManufacturer.address);
        expect(infoAfter[5]).to.equal(2n);
    });

  });

describe("Recipient communication", function () 
{

    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        return {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Access denied (changeStatus)", async function ()
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Test Product", "SN123456", "Origin", "Destination", 100, recipient.address);
        await expect(ProductRegistry.connect(user).changeStatus(1, authManufacturer.address)).to.be.revertedWith("Access denied");
    });

    it("Product status must be Delivered for recipient to change status", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Test Product", "SN123456", "Origin", "Destination", 100, recipient.address);
        await expect(ProductRegistry.connect(recipient).changeStatus(1, authManufacturer.address)).to.be.revertedWith("Product status must be Delivered");
    });

    it("ChangeStatus reverts for non-existent product", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await expect(ProductRegistry.connect(authManufacturer).changeStatus(999, authManufacturer.address)).to.be.revertedWith("Product does not exist");
    });
});


describe("Products by manufacturer", function () 
{
    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        return {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Pagination products by manufacturer check", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        for (let i = 0; i < 5; i++) 
        {
            await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Device", `SN-00${i}`,"DE", "FR", 100 + i, recipient.address);
        }
        const [result] = await ProductRegistry.getProductsByManufacturerPaginated(authManufacturer.address, 0, 3);
        expect(result.length).to.equal(3);
        expect(result[0].serialNumber).to.equal("SN-000");
        const [result1] = await ProductRegistry.getProductsByManufacturerPaginated(authManufacturer.address, 3, 3);
        expect(result1.length).to.equal(2);
    });

    it("Offset beyond total returns empty array", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        for (let i = 0; i < 5; i++) 
        {
            await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Device", `SN-00${i}`,"DE", "FR", 100 + i, recipient.address);
        }
        const [result, total] = await ProductRegistry.getProductsByManufacturerPaginated(authManufacturer.address, 10, 5);
        expect(result.length).to.equal(0);
        expect(total).to.equal(5n);
    });

    it("Limit larger than available returns only remaining", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        for (let i = 0; i < 5; i++) 
        {
            await ProductRegistry.connect(authManufacturer).addProductInfo(authManufacturer.address, "Device", `SN-00${i}`,"DE", "FR", 100 + i, recipient.address);
        }
        const [result] = await ProductRegistry.getProductsByManufacturerPaginated(authManufacturer.address, 4, 100);
        expect(result.length).to.equal(1);
    });
});

describe("Products by recipient", function () 
{
    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        return {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Pagination products by recipient check", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-002", "DE", "FR", 100, user.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-003", "DE", "FR", 200, recipient.address);
        const [page1, ] = await ProductRegistry.connect(recipient).getProductsByUserPaginated(recipient.address, 0, 1);
        const [page2, ] = await ProductRegistry.connect(recipient).getProductsByUserPaginated(recipient.address, 1, 1);
        const [pageUser, ] = await ProductRegistry.connect(user).getProductsByUserPaginated(user.address, 0, 1);
        expect(page1.length).to.equal(1);
        expect(page1[0].id).to.equal(1n);
        expect(page2.length).to.equal(1);
        expect(page2[0].id).to.equal(3n);
        expect(pageUser.length).to.equal(1);
        expect(pageUser[0].id).to.equal(2n);
    });

    it("Stranger sees no products", async function () 
    {
        const {ProductRegistry, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(authManufacturer.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-002", "DE", "FR", 100, user.address);
        await ProductRegistry.connect(authManufacturer).addProductInfo(user.address, "Device", "SN-003", "DE", "FR", 200, recipient.address);
        const [result, total] = await ProductRegistry.connect(authLogistics).getProductsByUserPaginated(authLogistics.address, 0, 10);
        expect(total).to.equal(0n);
        expect(result.length).to.equal(0);
    });

});

describe("Product autheticity check", function () 
{   
    async function deploy() 
    {
        const [manager, authManufacturer, authLogistics, recipient, user] = await hre.ethers.getSigners();
        const EntryPoint = await hre.ethers.deployContract("MockEntryPoint");
        await EntryPoint.waitForDeployment();
        const ProductRegistry = await hre.ethers.deployContract("ProductRegistry");
        await ProductRegistry.waitForDeployment();
        const CompanyAccount = await hre.ethers.deployContract("CompanyAccount",[EntryPoint.target, ProductRegistry.target],{ signer: authManufacturer });
        await CompanyAccount.waitForDeployment();
        return {ProductRegistry, CompanyAccount, manager, authManufacturer, authLogistics, recipient, user};
    }

    it("Emits ProductVerified true for valid manufacturer signature", async function () 
    {
        const {ProductRegistry, CompanyAccount, manager, authManufacturer, authLogistics, recipient, user} = await loadFixture(deploy);
        await ProductRegistry.connect(manager).addManufacturer(CompanyAccount.target);
        await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [CompanyAccount.target],});
        await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000",]);
        const companyAccountSigner = await hre.ethers.getSigner(CompanyAccount.target);
        await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
        await hre.network.provider.request({method: "hardhat_stopImpersonatingAccount",params: [CompanyAccount.target],});
        const messageHash = ethers.solidityPackedKeccak256(["uint256","address", "string", "string"],[1, CompanyAccount.target, "Device", "SN-001"]);
        const signature = await authManufacturer.signMessage(ethers.getBytes(messageHash));
        expect(await ProductRegistry.connect(recipient).verifyProduct(1, CompanyAccount.target, signature)).to.equal(true);
    });

//     it("Emits ProductVerified false for wrong signer", async function ()
//     {
//         const {ProductRegistry, CompanyAccount, manager, authManufacturer, recipient, user} = await loadFixture(deploy);
//         await ProductRegistry.connect(manager).addManufacturer(CompanyAccount.target);
//         await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [CompanyAccount.target]});
//         await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
//         const companyAccountSigner = await hre.ethers.getSigner(CompanyAccount.target);
//         await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
//         await hre.network.provider.request({method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target]});
//         const messageHash = ethers.solidityPackedKeccak256(["address", "uint256", "string"],[CompanyAccount.target, 1, "SN-001"]);
//         const signature = await user.signMessage(ethers.getBytes(messageHash));
//         await expect(
//             ProductRegistry.connect(recipient).verifyProduct(1, CompanyAccount.target, signature)
//         ).to.emit(ProductRegistry, "ProductVerified")
//         .withArgs(1, CompanyAccount.target, recipient.address, false);
//     });

//     it("Emits ProductVerified false for wrong serialNumber in hash", async function ()
//     {
//         const {ProductRegistry, CompanyAccount, manager, authManufacturer, recipient} = await loadFixture(deploy);
//         await ProductRegistry.connect(manager).addManufacturer(CompanyAccount.target);
//         await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [CompanyAccount.target]});
//         await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
//         const companyAccountSigner = await hre.ethers.getSigner(CompanyAccount.target);
//         await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
//         await hre.network.provider.request({method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target]});
//         const messageHash = ethers.solidityPackedKeccak256(["address", "uint256", "string"],[CompanyAccount.target, 1, "SN-FAKE"]);
//         const signature = await authManufacturer.signMessage(ethers.getBytes(messageHash));
//         await expect(
//             ProductRegistry.connect(recipient).verifyProduct(1, CompanyAccount.target, signature)
//         ).to.emit(ProductRegistry, "ProductVerified")
//         .withArgs(1, CompanyAccount.target, recipient.address, false);
//     });

//     it("Emits ProductVerified false for wrong productId in hash", async function ()
//     {
//         const {ProductRegistry, CompanyAccount, manager, authManufacturer, recipient} = await loadFixture(deploy);
//         await ProductRegistry.connect(manager).addManufacturer(CompanyAccount.target);
//         await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [CompanyAccount.target]});
//         await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
//         const companyAccountSigner = await hre.ethers.getSigner(CompanyAccount.target);
//         await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
//         await hre.network.provider.request({method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target]});
//         const messageHash = ethers.solidityPackedKeccak256(["address", "uint256", "string"],[CompanyAccount.target, 999, "SN-001"]);
//         const signature = await authManufacturer.signMessage(ethers.getBytes(messageHash));
//         await expect(
//             ProductRegistry.connect(recipient).verifyProduct(1, CompanyAccount.target, signature)
//         ).to.emit(ProductRegistry, "ProductVerified")
//         .withArgs(1, CompanyAccount.target, recipient.address, false);
//     });

//     it("Signature from product 1 cannot verify product 2", async function ()
//     {
//         const {ProductRegistry, CompanyAccount, manager, authManufacturer, recipient} = await loadFixture(deploy);
//         await ProductRegistry.connect(manager).addManufacturer(CompanyAccount.target);
//         await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [CompanyAccount.target]});
//         await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
//         const companyAccountSigner = await hre.ethers.getSigner(CompanyAccount.target);
//         await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
//         await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device2", "SN-002", "DE", "FR", 200, recipient.address);
//         await hre.network.provider.request({method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target]});
//         const messageHash = ethers.solidityPackedKeccak256(["address", "uint256", "string"],[CompanyAccount.target, 1, "SN-001"]);
//         const signature = await authManufacturer.signMessage(ethers.getBytes(messageHash));
//         await expect(
//             ProductRegistry.connect(recipient).verifyProduct(2, CompanyAccount.target, signature)
//         ).to.emit(ProductRegistry, "ProductVerified")
//         .withArgs(2, CompanyAccount.target, recipient.address, false);
//     });

//     it("VerifyProduct reverts for non-existent product", async function ()
//     {
//         const {ProductRegistry, CompanyAccount, manager, authManufacturer, recipient} = await loadFixture(deploy);
//         await ProductRegistry.connect(manager).addManufacturer(CompanyAccount.target);
//         await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [CompanyAccount.target]});
//         await hre.network.provider.send("hardhat_setBalance", [CompanyAccount.target, "0x1000000000000000000"]);
//         const companyAccountSigner = await hre.ethers.getSigner(CompanyAccount.target);
//         await ProductRegistry.connect(companyAccountSigner).addProductInfo(authManufacturer.address, "Device", "SN-001", "DE", "FR", 100, recipient.address);
//         await hre.network.provider.request({method: "hardhat_stopImpersonatingAccount", params: [CompanyAccount.target]});
//         const fakeSignature = "0x" + "ab".repeat(65);
//         await expect(
//             ProductRegistry.connect(recipient).verifyProduct(999, CompanyAccount.target, fakeSignature)
//         ).to.be.revertedWith("Product does not exist");
//     });
});
