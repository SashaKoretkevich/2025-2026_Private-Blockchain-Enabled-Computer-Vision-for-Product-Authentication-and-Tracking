# Blockchain Supply Chain Verification System

Greetings all! In this repository, you willfind how you can build a decentralized supply chain verification system powered by Ethereum smart contracts, Account Abstraction, and QR code-based product authentication. The system allows manufacturers, logistics providers and recipients to track products on-chain, generate verifiable QR codes, and store certificates on IPFS. 
Task is divided into two parts:

**1. Smart Contracts (Blockchain system):**

  a. Write and compile Solidity contracts

  b. Test the contracts

  c. Deploy to the Sepolia test network

  d. Verify Smart Contracts on Etherscan

**2. Backend API (FastApi):**

  a. Configure environment variables

  b. Run the FastAPI server (locally or via Docker)

  c. Use the API to manage products, QR codes, and certificates


## Overview

The system consists of two layers:

- **Smart Contracts (Blockchain system)** — on-chain state management. Stores product records, supply chain path history, condition logs, and certificate URLs on Ethereum using Account Abstraction (ERC-4337).
- **Backend API (FastApi)** — off-chain orchestration. A FastAPI server that constructs Account Abstraction user operations, generates and verifies ECDSA-signed QR codes, and uploads certificates to Pinata (IPFS).

## Setup the environment

Clone the repository and navigate into it

```
git clone https://github.com/SashaKoretkevich/2025-2026_Private-Blockchain-Enabled-Computer-Vision-for-Product-Authentication-and-Tracking
cd <Systemr>
```

The repository contains two subfolders:

+ Blockchain system
+ FastApi

---

## Part 1: Smart Contracts Setup

**Pre-requisites:**

* Node.js and npm installed
* An Infura or Alchemy RPC URL for the Sepolia testnet
* An Etherscan API key for contract verification
* A wallet private key with Sepolia ETH for deployment (use MetaMask or similar)

**Setting up the contract environment:**

* Navigate to the contracts folder

```
cd Blockchain system
```

* Install the required dependencies

```
npm i
```
npm install --save-dev @nomicfoundation/hardhat-toolbox
```

* Create a `.env` file

```
touch .env
```

Open `.env` in any editor and fill in the following, then save:

```
API_URL='#Your Infura or Alchemy Sepolia RPC HTTPS URL'
PRIVATE_KEY='#Your wallet private key'
ETHERSCAN_API_KEY='#Your Etherscan API key'
```

* Compile the contracts

```
npx hardhat compile
```

* Run the test suite

```
npx hardhat test
```

* (Optional) Generate a coverage report

```
npx hardhat coverage
```

**Deploy contracts:**

Update `hardhat.config.js` to set the default network:

```
defaultNetwork: "sepolia",
```

Deploy all contracts to Sepolia:

```
npx hardhat run specify_deploy_file --network sepolia
```

Note the deployed addresses printed to the console — you will need them for the FastApi `.env`.

**Verify contracts:**

```
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```
---

## Part 2: Backend API Setup

**Pre-requisites:**

* Python 3.10+ installed, or Docker and Docker Compose
* A Pinata account and JWT token for IPFS certificate storage
* Deployed contract addresses from Part 1
* An Alchemy Bundler URL for submitting Account Abstraction user operations
* Mobile App

**Setting up the API environment:**

* Navigate to the backend folder

```
cd ../FastApi
```

* Create a `.env` file

```
touch .env
```

Open `.env` in any editor and fill in the following, then save:

```
API_URL='#Your Sepolia RPC HTTPS URL'
BUNDLER_URL='#Your Alchemy Bundler URL for Sepolia'
PINATA_JWT='#Your Pinata JWT token'
PRODUCT_REGISTRY_ADDRESS='#Deployed ProductRegistry1 contract address'
ENTRY_POINT_ADDRESS='0x0000000071727De22E5E9d8BAf0edAc6f37da032'
```

**Running locally:**

* Install dependencies

```
pip install -r requirements.txt
```

* Start the server

```
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`. Interactive docs are at `http://localhost:8000/docs`.

**Running with Docker:**

* Build and start the container

```
docker-compose up --build
```

The API will be available at `http://localhost:8000`.

**Running the tests:**

```
pytest tests/
```

## Architecture

```
┌──────────────────────┐        ┌──────────────────────────┐
│   Client Application │        │      Pinata (IPFS)       │
│     (mobile app)     │        |    Certificate storage   │
└──────────┬───────────┘        └────────────▲─────────────┘
           │ HTTP                            │
           ▼                                 │
┌──────────────────────┐                     │
│   FastAPI Backend    │─────────────────────┘
│  - QR generation     │
│  - QR decoding       │
│  - Signature verify  │
│  - UserOp builder    │ 
│       and sender    │
│  - Certificate       │
│      manegment       │
└──────────┬───────────┘
           │ JSON-RPC (eth_sendUserOperation)
           ▼
┌──────────────────────┐
│   Alchemy Bundler    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                  Ethereum Sepolia Testnet                │
│                                                          │
│  ┌─────────────────┐    ┌───────────────────────────┐    │
│  │   Entry Point   │───▶│  CompanyAccount /          │   │
│  │  (ERC-4337)     │    │  LogisticsAccount          │   │
│  └─────────────────┘    └─────────────┬─────────────┘    │
│                                       │                  │
│                                       ▼                  │
│                          ┌────────────────────────┐      │
│                          │   ProductRegistry      │      │
│                          │  - Products            │      │
│                          │  - Path history        │      │
│                          │  - Condition logs      │      │
│                          │  - Certificates        │      │
│                          └────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```
