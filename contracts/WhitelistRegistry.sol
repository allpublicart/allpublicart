pragma solidity 0.4.18;

/**
 * @title All Public Art whitelist registry - check for address whitelist for special buyers.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract WhitelistRegistry {
    address public owner;
    // price at which whitelisted buyers will be able to buy tokens
    uint256 public preferentialRate;

    // customize the rate for each whitelisted buyer
    mapping (address => uint256) public buyerRate;

    // list of addresses that can purchase before crowdsale opens
    mapping (address => bool) public whitelist;
    // list of artist addresses that can purchase during the presale without a minimum amount
    mapping (address => bool) public artistWhitelist;

    // Events
    event PreferentialUserRateChange(address indexed buyer, uint256 rate);
    event PreferentialRateChange(uint256 rate);

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Contructor function
     * @param _preferentialRate Integer for the initial preferential rate
     */
    function WhitelistRegistry(uint256 _preferentialRate) public {
        owner = msg.sender;
        preferentialRate = _preferentialRate;
        PreferentialRateChange(_preferentialRate);
    }

    /**
     * @dev Add whitelist addresses that can participate in the pre and crowdsale with a preferential rate
     * @param buyer Purchaser's address to be whitelisted
     */
    function addToWhitelist(address buyer) public onlyOwner {
        require(buyer != address(0));
        whitelist[buyer] = true;
    }

    /**
     * @dev checks whether address is whitelisted
     * @param buyer Purchaser's address to check
     * @return true if buyer is whitelisted
     */
    function isWhitelisted(address buyer) public constant returns (bool) {
        return whitelist[buyer];
    }

    /**
     * @dev Add artists addresses as a whitelist mechanism
     * @param artist Artist's address to be whitelisted
     */
    function whitelistArtist(address artist) public onlyOwner {
        require(artist != address(0));
        artistWhitelist[artist] = true;
    }

    /**
     * @dev checks whether artist address is whitelisted
     * @param artist Artist's address to check
     * @return true if artist is whitelisted
     */
    function isArtist(address artist) public constant returns (bool) {
        return artistWhitelist[artist];
    }

    /**
     * @dev sets preferentialRate for a whitelisted buyer
     * @param buyer Address that is whitelisted already
     * @param rate Customizable rate
     */
    function setBuyerRate(address buyer, uint256 rate) public onlyOwner {
        require(rate != 0);
        require(isWhitelisted(buyer));

        buyerRate[buyer] = rate;

        PreferentialUserRateChange(buyer, rate);
    }

    /**
     * @dev sets global preferentialRate for whitelisted buyer that has no customized rate
     * @param rate New global preferentialRate
     */
    function setPreferentialRate(uint256 rate) public onlyOwner {
        require(rate != 0);

        preferentialRate = rate;

        PreferentialRateChange(rate);
    }
}
