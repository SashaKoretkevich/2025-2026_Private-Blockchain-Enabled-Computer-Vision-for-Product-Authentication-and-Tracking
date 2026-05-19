/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

const { API_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

module.exports = {
   solidity: {
      version: "0.8.28",
      settings: {
         evmVersion: "cancun",
         optimizer: {
            enabled: true,
            runs: 200
         },
      }
   },
   gasReporter: {
    enabled: true,
    excludeContracts: ["Mocks"],
    outputFile: "gas-report.txt",
    noColors: true,
   },
   defaultNetwork: "hardhat",
   networks: {
      hardhat: { hardfork: "cancun" },
      sepolia: {
         url: API_URL,
         accounts: [`0x${PRIVATE_KEY}`]
      }
   },
   etherscan: 
   {
      apiKey: ETHERSCAN_API_KEY,
      customChains: [
         {
            network: "sepolia",
            chainId: 11155111,
            urls: {
               apiURL: "https://api.etherscan.io/v2/api?chainid=11155111",
               browserURL: "https://sepolia.etherscan.io"
            }
         }
      ]
   },
   sourcify: {
      enabled: false
   },
   mocha: {
      timeout: 100000000
   },
   paths: {
      sources: "./Contracts",
   },

};