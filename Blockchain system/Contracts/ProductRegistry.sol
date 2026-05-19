// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface ICompanyAccount 
{
    function checkRole(address wallet) external view returns (string memory);
}

contract ProductRegistry
{
    
    enum ProductStatus {Awaiting, Initialized, InTransit, Delivered, Received}

    struct Product 
    {
        uint256 id;
        string name;
        string serialNumber;
        address manufacturer;
        string origin;
        string destination;
        ProductStatus status;
        uint256 mass;
        string[] certificats;
        address recipient;
        string publicKey;
        uint256 timestamp;
    }

    struct PathRecord
    {
        address from;
        address to;
        string  location;
        string  note;
        uint256 timestamp;
    }

    struct Manufacturer
    {
        address manufacturerAddress;
        bool status;
        mapping(uint256 => Product) products;
        uint256[] productsIds;
        uint256 productCount;
    }

    struct ConditionLog
    {
        string conditionType;  
        int256 value;          
        string unit;    
        uint256 timestamp;
    }

    struct ProductRef 
    {
        address manufacturer;
        uint256 productId;
    }

    address private Manager;
    mapping(address => Manufacturer) private authManufacturers;  
    mapping(address => bool) private authLogistics;       
    mapping(address => ProductRef[]) private recipientProducts;
    mapping(address => mapping(uint256 => PathRecord[])) private productPath;
    mapping(address => mapping(uint256 => ConditionLog[])) private conditionLogs;

    constructor()
    {
        Manager = msg.sender;
    }

    event ProductAdded(uint256 indexed productId, address indexed manf, address indexed employee, uint256 timestamp);
    event ProductDeleted(uint256 indexed productId, address indexed manf, address indexed employee, uint256 timestamp);
    event CertificateAdded(uint256 indexed productId, address indexed manf, address indexed employee, uint256 timestamp);
    event CertificateDeleted(uint256 indexed productId, address indexed manf, address indexed employee, uint256 timestamp);
    event ProductPath(uint256 indexed productId, address indexed manf, address from, address to, string location);
    event ConditionLogged(uint256 indexed productId, address indexed manf, string conditionType, int256 value);
    event StatusChanged(uint256 indexed productId, address indexed manf, ProductStatus newStatus,  uint256 timestamp);
    event ProductPublicKeyAdded(uint256 indexed productId, address indexed manf, address indexed employee, uint256 timestamp);
    event ProductVerificationResult(uint256 indexed productId, address indexed manufacturerAddress, address indexed verifier, bool isValid, uint256 timestamp);

    function addManufacturer(address manufacturerAddress) public 
    {
        require (msg.sender == Manager,
        "Only manager can call this function");
        require (authManufacturers[manufacturerAddress].manufacturerAddress == address(0),
        "Manufacturer with such address already exists");
        authManufacturers[manufacturerAddress].manufacturerAddress = manufacturerAddress;
        authManufacturers[manufacturerAddress].status = true;
        authManufacturers[manufacturerAddress].productCount = 0;
    }

    function disableManufacturer(address manufacturerAddress) public 
    {
        require (msg.sender == Manager,
        "Only manager can call this function");
        authManufacturers[manufacturerAddress].status = false;
    }

    function enableManufacturer(address manufacturerAddress) public 
    {
        require (msg.sender == Manager,
        "Only manager can call this function");
        authManufacturers[manufacturerAddress].status = true;
    }

    function checkManufacturerStatus(address manufacturerAddress) public view returns(bool)
    {
        return authManufacturers[manufacturerAddress].status;
    }

    function checkManufacturer(address manufacturerAddress, address employee) public view returns(bool, string memory)
    {
        bool res = false;
        string memory role = "No role";
        if (authManufacturers[manufacturerAddress].manufacturerAddress == manufacturerAddress)
        {
            role = ICompanyAccount(manufacturerAddress).checkRole(employee);
            res = true;
        }
        return (res, role);
    }

    function isManufacturer(address manufacturerAddress) public view returns(bool)
    {
        bool res = false;
        if (authManufacturers[manufacturerAddress].manufacturerAddress == manufacturerAddress)
        {
            res = true;
        }
        return res;
    }

    function addLogisticsProvider(address logisticsAddress) public 
    {
        require (msg.sender == Manager,
        "Only manager can call this function");
        authLogistics[logisticsAddress] = true;
    }

    function deleteLogisticsProvider(address logisticsAddress) public 
    {
        require (msg.sender == Manager,
        "Only manager can call this function");
        delete(authLogistics[logisticsAddress]);
    }

    function checkLogisticsProvider(address logisticsAddress, address employee) public view returns(bool, string memory)
    {
        bool res = false;
        string memory role = "No role";
        if (authLogistics[logisticsAddress] == true)
        {
            role = ICompanyAccount(logisticsAddress).checkRole(employee);
            res = true;
        }

        return (res, role);
    }

    function isLogistic(address logisticsAddress) public view returns(bool)
    {
        bool res = false;
        if (authLogistics[logisticsAddress] == true)
        {
            res = true;
        }

        return (res);
    }

    function addProductInfo (address employee, string memory name, string memory serialNumber, string memory origin, string memory destination, uint256 mass, address recipient) public
    {
        require (authManufacturers[msg.sender].manufacturerAddress != address(0),
        "Only authenticated manufacturer can add product info");
        require (authManufacturers[msg.sender].status == true,
        "Only active in the system manufacturer can add product info");
        uint256 productId = authManufacturers[msg.sender].productCount + 1;
        string[] memory cer;
        string memory emptyKey;
        Product memory newProduct = Product(productId, name, serialNumber, msg.sender, origin, destination, ProductStatus.Awaiting, mass, cer, recipient, emptyKey, block.timestamp);
        authManufacturers[msg.sender].products[productId] = newProduct;
        authManufacturers[msg.sender].productsIds.push(productId);
        ProductRef memory newRef = ProductRef(msg.sender, productId);
        recipientProducts[recipient].push(newRef);
        authManufacturers[msg.sender].productCount++;

        emit ProductAdded(productId, msg.sender, employee, block.timestamp);
    }

    function addProductPublicKey(address employee, uint256 productId, string memory publicKey) public
    {
        require(authManufacturers[msg.sender].manufacturerAddress != address(0),
        "Only authenticated manufacturer can add public key");
        require (authManufacturers[msg.sender].status == true,
        "Only active in the system manufacturer can add public key");
        require(authManufacturers[msg.sender].products[productId].timestamp != 0,
        "Product does not exist");
        require(authManufacturers[msg.sender].products[productId].status == ProductStatus.Awaiting,
        "Product status must be Awaiting");
        require(bytes(publicKey).length > 0,
        "Public key cannot be empty");
        authManufacturers[msg.sender].products[productId].publicKey = publicKey;
        authManufacturers[msg.sender].products[productId].status = ProductStatus.Initialized;

        emit ProductPublicKeyAdded(productId, msg.sender, employee, block.timestamp);
    }

    function addProductCertificate (address employee, uint256 productId, string memory certificateURL) public
    {
        require (authManufacturers[msg.sender].manufacturerAddress != address(0),
        "Only authenticated manufacturer can add product certificate");
        require (authManufacturers[msg.sender].status == true,
        "Only active in the system manufacturer can add product certificate");
        require (authManufacturers[msg.sender].products[productId].timestamp != 0,
        "Product does not exist");
        authManufacturers[msg.sender].products[productId].certificats.push(certificateURL);
        emit CertificateAdded(productId, msg.sender, employee, block.timestamp);
    }

    function deleteProductInfo(address employee, uint256 productId) public 
    {
        require (authManufacturers[msg.sender].manufacturerAddress != address(0),
        "Only manufacturer can delete product info");
        require (authManufacturers[msg.sender].status == true,
        "Only active in the system manufacturer can delete product info");
        require (authManufacturers[msg.sender].products[productId].timestamp != 0,
        "Product does not exist");
        require (authManufacturers[msg.sender].products[productId].status == ProductStatus.Awaiting || authManufacturers[msg.sender].products[productId].status == ProductStatus.Initialized,
        "Only product with Awaiting or Initialized status can be deleted");
        uint256[] storage ids = authManufacturers[msg.sender].productsIds;
        Product memory product = authManufacturers[msg.sender].products[productId];
        ProductRef[] storage ref = recipientProducts[product.recipient];
        for (uint256 i = 0; i < ids.length; i++)
        {
            if (ids[i] == productId)
            {
                ids[i] = ids[ids.length - 1]; 
                ids.pop();
                break;  
            }
        }

        for (uint256 j = 0; j < ref.length; j++)
        {
            if (ref[j].productId == productId && ref[j].manufacturer == msg.sender)
            {
                ref[j] = ref[ref.length - 1]; 
                ref.pop();
                break;  
            }
        }

        delete(authManufacturers[msg.sender].products[productId]);
        delete(productPath[msg.sender][productId]);
        delete(conditionLogs[msg.sender][productId]);

        emit ProductDeleted(productId, msg.sender, employee, block.timestamp);
    }

    function deleteProductCertificate (address employee, uint256 productId, uint256 index) public
    {
        require (authManufacturers[msg.sender].manufacturerAddress != address(0),
        "Only authenticated manufacturer can delete product certificate");
        require (authManufacturers[msg.sender].status == true,
        "Only active in the system manufacturer can delete product certificate");
        require (authManufacturers[msg.sender].products[productId].timestamp != 0,
        "Product does not exist");
        string[] storage certs = authManufacturers[msg.sender].products[productId].certificats;
        require (index < certs.length,
        "Certificate index out of bounds");
        for (uint j = index; j < certs.length - 1; j++)
        {
            certs[j] = certs[j+1];
        }
        authManufacturers[msg.sender].products[productId].certificats.pop();

        emit CertificateDeleted(productId, msg.sender, employee, block.timestamp);
    }

    function changeStatus(uint256 productId, address manufacturerAddress) public
    {
        Product storage product = authManufacturers[manufacturerAddress].products[productId];
        require(product.timestamp != 0,
        "Product does not exist");

        if (msg.sender == authManufacturers[manufacturerAddress].products[productId].recipient)
        {
            require(product.status == ProductStatus.Delivered,
            "Product status must be Delivered");
            product.status = ProductStatus.Received;
            emit StatusChanged(productId, manufacturerAddress, product.status, block.timestamp);
        } 
        else if (msg.sender == authManufacturers[manufacturerAddress].manufacturerAddress)
        {
            require (authManufacturers[msg.sender].status == true,
            "Only active in the system manufacturer can change product status");
            require(product.status == ProductStatus.Initialized,
            "Product status must be Initialized");
            product.status = ProductStatus.InTransit;
            emit StatusChanged(productId, manufacturerAddress, product.status, block.timestamp);
        }
        else if (authLogistics[msg.sender] == true)
        {
            require(product.status == ProductStatus.InTransit,
            "Product status must be InTransit");
            product.status = ProductStatus.Delivered;
            emit StatusChanged(productId, manufacturerAddress, product.status, block.timestamp);
        }
        else 
        {
            revert("Access denied");
        }
    }

    function logPathHistory(uint256 productId, address manufacturerAddress, address to, string memory location, string memory note) public
    {
        Product memory product = authManufacturers[manufacturerAddress].products[productId];
        require(product.timestamp != 0,
        "Product does not exist");
        require(authLogistics[msg.sender] == true || (msg.sender == authManufacturers[manufacturerAddress].manufacturerAddress && productPath[manufacturerAddress][productId].length == 0), "Only logistics providers or manufacturer can log path history");
        if (msg.sender == authManufacturers[manufacturerAddress].manufacturerAddress)
        {
            require (authManufacturers[msg.sender].status == true,
            "Only active in the system manufacturer can transfer product");
        }
        require(product.status == ProductStatus.InTransit,
        "Product status must be InTransit");
        PathRecord memory newRecord;
        if (productPath[manufacturerAddress][productId].length > 0)
        {
            newRecord = PathRecord(productPath[manufacturerAddress][productId][productPath[manufacturerAddress][productId].length - 1].to, to, location, note, block.timestamp);
        } 
        else
        {
            newRecord = PathRecord(msg.sender, to, location, note, block.timestamp);
        }
        productPath[manufacturerAddress][productId].push(newRecord);

        emit ProductPath(productId, manufacturerAddress, newRecord.from, newRecord.to, location);
    }

    function getProductPathHistory(uint256 productId, address manufacturerAddress) public view returns (PathRecord[] memory)
    {
        return productPath[manufacturerAddress][productId];
    }

    function logCondition(uint256 productId, address manufacturerAddress, string memory conditionType, int256 value, string memory unit) public
    {
        Product memory product = authManufacturers[manufacturerAddress].products[productId];
        require(product.timestamp != 0,
        "Product does not exist");
        require(authLogistics[msg.sender] == true,
        "Only logistics provider can log condition");
        require(product.status == ProductStatus.InTransit,
        "Product status must be InTransit");
        ConditionLog memory newLog = ConditionLog(conditionType, value, unit, block.timestamp);
        conditionLogs[manufacturerAddress][productId].push(newLog);
        
        emit ConditionLogged(productId, manufacturerAddress, conditionType, int256(value));
    }

    function getConditionLogs(uint256 productId, address manufacturerAddress) public view returns (ConditionLog[] memory)
    {
        return conditionLogs[manufacturerAddress][productId];  
    }

    function getProductInfo(uint256 productId, address manufacturerAddress) public view returns (Product memory)
    {
        Product memory product = authManufacturers[manufacturerAddress].products[productId];
        return product;
    }

    function getProductPublicKey(uint256 productId, address manufacturerAddress) public view returns (string memory) 
    {
        Product memory product = authManufacturers[manufacturerAddress].products[productId];
        return product.publicKey;
    }

    function getProductsByManufacturerPaginated(address manA, uint256 offset, uint256 limit) public view returns (Product[] memory result, uint256 total)
    {
        uint256[] memory ids = authManufacturers[manA].productsIds;
        total = ids.length;

        uint256 end;
        if (offset + limit > total)
        {
            end = total;
        } 
        else 
        {
            end = offset + limit;
        }
        uint256 count;
        if (end > offset)
        {
            count = end - offset;
        } 
        else 
        {
            count = 0;
        }

        result = new Product[](count);
        for (uint256 i = 0; i < count; i++) 
        {
            result[i] = authManufacturers[manA].products[ids[offset + i]];
        }
        return (result, total);
    }

    function getProductsByUserPaginated(address user, uint256 offset, uint256 limit) public view returns (Product[] memory result, uint256 total)
    {
        ProductRef[] memory productsUser = recipientProducts[user];
        total = productsUser.length;

        uint256 end;
        if (offset + limit > total)
        {
            end = total;
        } 
        else 
        {
            end = offset + limit;
        }
        uint256 count;
        if (end > offset)
        {
            count = end - offset;
        } 
        else 
        {
            count = 0;
        }

        result = new Product[](count);
        for (uint256 i = 0; i < count; i++) 
        {
            result[i] = authManufacturers[productsUser[offset + i].manufacturer].products[productsUser[offset + i].productId];
        }
        return (result, total);
    }
    
    function verifyProduct(uint256 productId, address manufacturerAddress, bool isValid) public
    {
        Product memory product = authManufacturers[manufacturerAddress].products[productId];
        require(product.timestamp != 0,
        "Product does not exist");
        require(bytes(product.publicKey).length > 0,"Product public key is not set");
        require(authManufacturers[msg.sender].manufacturerAddress != address(0) || authLogistics[msg.sender] == true || product.recipient == msg.sender,
        "Only authorized entities can verify products");
        emit ProductVerificationResult(productId, manufacturerAddress, msg.sender, isValid, block.timestamp);
    }
    
}
