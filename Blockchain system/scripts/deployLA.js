async function main()
{
    const LogisticsAccount= await ethers.deployContract("LogisticsAccount", ["0x0000000071727De22E5E9d8BAf0edAc6f37da032", "deployed_ProductRegistry_address"]);
    const contractAddress = await LogisticsAccount.getAddress();
    console.log("Contract deployed to address:", contractAddress);
 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });