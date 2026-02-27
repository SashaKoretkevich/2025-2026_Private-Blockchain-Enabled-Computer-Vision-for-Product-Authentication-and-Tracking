// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract ProductRegistry
{

  struct Product 
  {
    string name;
    string serialNumber;
    uint256 manufacturer;
    string origin;
    string destination;
    uint256 mass;
    string[] certificats;
    uint256 timestamp;
  }

  address private Manager;
  mapping (uint256 => mapping(uint256 => Product)) productsByManufacturer;
  mapping (uint256 => address) private authManufacturers;
  uint256 public constant PHYSICAL_NONCE = 1;
    

  constructor()
  {
    Manager = msg.sender;
  }

  event ProductVerified(uint256 productId, address verifier, bool isValid);

  function addManufacturer(uint256 ID, address manufacturerAddress) public 
  {
    require (msg.sender == Manager,
    "Only manager can call this function");
    require (authManufacturers[ID] == address(0),
    "Manufacturer ID already exists");
    authManufacturers[ID] = manufacturerAddress;
  }

  function deleteManufacturer(uint256 ID) public 
  {
    require (msg.sender == Manager,
    "Only manager can call this function");
    delete(authManufacturers[ID]);
  }

  function getAuthManufacturer(uint256 ID) public view returns(address)
  {
    return authManufacturers[ID];
  }

  function addProductInfo (uint256 productId, string memory name, string memory serialNumber, uint256 manId, string memory origin, string memory destination, uint256 mass) public
  {
    require (msg.sender == authManufacturers[manId],
    "Only authenticated manufacturer can add product info");
    require (productsByManufacturer[manId][productId].timestamp == 0,
    "Product has already been registered");
    string[] memory cer;
    Product memory newProduct = Product(name, serialNumber, manId, origin, destination, mass, cer, block.timestamp);
    productsByManufacturer[manId][productId] = newProduct;
  }

  function addProductCertificate (uint256 productId, uint256 manId, string memory certificateURL) public
  {
    require (msg.sender == authManufacturers[manId],
    "Only authenticated manufacturer can add product certificate");
    productsByManufacturer[manId][productId].certificats.push(certificateURL);
  }

  function deleteProductInfo(uint256 productId, uint256 manId) public 
  {
    require (msg.sender == authManufacturers[manId],
    "Only manufacturer can delete product info");
    delete(productsByManufacturer[manId][productId]);
  }

  function deleteProductCertificate (uint256 productId, uint256 manId, uint256 index) public
  {
    require (msg.sender == authManufacturers[manId],
    "Only authenticated manufacturer can delete product certificate");
    for (uint j = index; j < productsByManufacturer[manId][productId].certificats.length - 1; j++)
    {
      productsByManufacturer[manId][productId].certificats[j] = productsByManufacturer[manId][productId].certificats[j+1];
    }
    productsByManufacturer[manId][productId].certificats.pop();
  }

  function getProductInfo(uint256 productId, uint256 manId) public view returns (string memory, string memory, uint256, string memory, string memory, uint256, string[] memory, uint256)
  {
    Product memory product = productsByManufacturer[manId][productId];
    return (product.name, product.serialNumber, product.manufacturer, product.origin, product.destination, product.mass, product.certificats, product.timestamp);
  }
    
  function verifyProduct(uint256 productId, uint256 manId, bytes memory hiddenSignature) public
  {
    Product memory product = productsByManufacturer[manId][productId];
    
    require(product.timestamp != 0, "Product does not exist");
    bytes32 messageHash = keccak256(abi.encodePacked(product.name, product.serialNumber, PHYSICAL_NONCE));
        
    bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
    address signer = recoverSigner(ethSignedHash, hiddenSignature);
    bool isValid = false;
    if (authManufacturers[product.manufacturer] != address(0) && signer == authManufacturers[product.manufacturer])
    {
      isValid = true;
    }
    
    emit ProductVerified(productId, msg.sender, isValid);
        
  }
    
  function recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address)
  {
    require(signature.length == 65, "Invalid signature length");
        
    bytes32 r;
    bytes32 s;
    uint8 v;
        
    assembly
    {
      r := mload(add(signature, 32))
      s := mload(add(signature, 64))
      v := byte(0, mload(add(signature, 96)))
    }
        
    return ecrecover(messageHash, v, r, s);
  }
}
