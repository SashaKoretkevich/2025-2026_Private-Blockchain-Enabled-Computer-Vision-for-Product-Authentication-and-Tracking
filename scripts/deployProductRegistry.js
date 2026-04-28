async function main()
{
    const ProductRegistry= await ethers.deployContract("ProductRegistry");
    const contractAddress = await ProductRegistry.getAddress();
    console.log("Contract deployed to address:", contractAddress);
 }
 
 main()
   .then(() => process.exit(0))
   .catch(error => {
     console.error(error);
     process.exit(1);
   });