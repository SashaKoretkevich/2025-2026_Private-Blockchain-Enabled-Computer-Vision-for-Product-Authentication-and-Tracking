async function main()
{
    const LogisticsAccount= await ethers.deployContract("LogisticsAccount", ["0x0000000071727De22E5E9d8BAf0edAc6f37da032", "0xcbbC6D8F8cE99908aeF5B0aa38f82F740E519455"]);
    const contractAddress = await LogisticsAccount.getAddress();
    console.log("Contract deployed to address:", contractAddress);
 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });