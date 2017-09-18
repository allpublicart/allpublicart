pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/token/MintableToken.sol";
import "zeppelin-solidity/contracts/token/PausableToken.sol";

/**
 * @title All Public Art Token contract - ERC20 compatible token contract.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtToken is PausableToken, MintableToken {
    string public constant name = "All Public Art";
    string public constant symbol = "APA";
    uint8 public constant decimals = 18;
}
