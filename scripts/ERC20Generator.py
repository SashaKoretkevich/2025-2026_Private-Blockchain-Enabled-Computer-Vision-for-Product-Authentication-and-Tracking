import json
from jinja2 import Template
from pathlib import Path

template = """// SPDX-License-Identifier: {{ license }}
pragma solidity {{ solidity_version }};

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
{% if access_control == "ownable" %}import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";{% endif %}
{% if access_control == "roles" %}import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";{% endif %}
{% if access_control == "managed" %}import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";{% endif %}

{% if features.burnable %}import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";{% endif %}
{% if features.pausable %}import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";{% endif %}
{% if features.callback %}import {ERC1363} from "@openzeppelin/contracts/token/ERC20/extensions/ERC1363.sol";{% endif %}
{% if features.permit %}import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";{% endif %}
{% if features.flashMint %}import {ERC20FlashMint} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20FlashMint.sol";{% endif %}

contract {{ token_name }} is ERC20{% if access_control == "ownable" %}, Ownable{% endif %}{% if access_control == "roles" %}, AccessControl{% endif %}{% if access_control == "managed" %}, AccessManaged{% endif %}{% if features.burnable %}, ERC20Burnable{% endif %}{% if features.pausable %}, ERC20Pausable{% endif %}{% if features.callback %}, ERC1363{% endif %}{% if features.permit %}, ERC20Permit{% endif %}{% if features.flashMint %}, ERC20FlashMint{% endif %}
{
    {% if access_control == "roles" and features.mintable -%}bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");{%- endif %}
    {% if access_control == "roles" and features.pausable %}bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");{% endif %}

    constructor(address recipient{% if access_control == "ownable" %}, address initialOwner{% endif %}{% if access_control == "roles" %}, address defaultAdmin{% endif %}{% if access_control == "managed" %}, address initialAuthority{% endif %}{% if access_control == "roles" and features.mintable %}, address minter{% endif %}{% if access_control == "roles" and features.pausable %}, address pauser{% endif %})
        ERC20("{{ token_name }}", "{{ token_symbol }}")
        {% if access_control == "ownable" %}Ownable(initialOwner){% endif %}{% if access_control == "managed" %}AccessManaged(initialAuthority){% endif %}
        {% if features.permit %}ERC20Permit("{{ token_name }}"){% endif %}
    {
        _mint(recipient, {{ initial_supply }} * 10 ** decimals());
        {% if access_control == "roles" %}_grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);{% endif %}
        {% if access_control == "roles" and features.mintable %}_grantRole(MINTER_ROLE, minter);{% endif %}
        {% if access_control == "roles" and features.pausable %}_grantRole(PAUSER_ROLE, pauser);{% endif %}
    }

    {% if features.pausable %}
    function pause() public {% if access_control == "ownable" %}onlyOwner{% endif %}{% if access_control == "roles" %}onlyRole(PAUSER_ROLE){% endif %}{% if access_control == "managed" %}restricted{% endif %}
    {
        _pause();
    }

    function unpause() public {% if access_control == "ownable" %}onlyOwner{% endif %}{% if access_control == "roles" %}onlyRole(PAUSER_ROLE){% endif %}{% if access_control == "managed" %}restricted{% endif %}
    {
        _unpause();
    }
    {% endif %}

    {% if features.mintable %}
    function mint(address to, uint256 amount) public {% if access_control == "ownable" %}onlyOwner{% endif %}{% if access_control == "roles" %}onlyRole(MINTER_ROLE){% endif %}{% if access_control == "managed" %}restricted{% endif %}
    {
        _mint(to, amount);
    }
    {% endif %}

    {% if features.pausable %}
    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
    {% endif %}

    {% if features.callback and access_control == "roles" %}
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl, ERC1363) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    {% endif %}
}"""

class ERC20Generator:
    def __init__(self, config_path):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        self.template = Template(template)
    
    def generate(self, output_path=None):
        context = {
            'token_name': self.config.get('token_name', 'MyToken'),
            'token_symbol': self.config.get('token_symbol', 'MTK'),
            'initial_supply': self.config.get('initial_supply', 1000000),
            'solidity_version': self.config.get('solidity_version', '0.8.20'),
            'license': self.config.get('license', 'MIT'),
            'features': self.config.get('features', {}),
            'access_control': self.config.get('access_control')
        }
        
        contract_code = self.template.render(**context)
        
        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                f.write(contract_code)
            print(f"Contract generated successfully at: {output_path}")
        
        return contract_code

if __name__ == "__main__":
    generator = ERC20Generator('config.json')
    contract = generator.generate('Сontracts/MyToken.sol')
    print("Done")