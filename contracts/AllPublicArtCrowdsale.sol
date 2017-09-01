pragma solidity ^0.4.13;

import "./AllPublicArtToken.sol";
import "zeppelin-solidity/crowdsale/CappedCrowdsale.sol";
import "zeppelin-solidity/crowdsale/RefundableCrowdsale.sol";

/**
 * @title All Public Art Crowdsale contract - crowdsale contract for the APA tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtCrowdsale is CappedCrowdsale, RefundableCrowdsale {

  function AllPublicArtCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, address _wallet)
    CappedCrowdsale(_cap)
    FinalizableCrowdsale()
    RefundableCrowdsale(_goal)
    Crowdsale(_startTime, _endTime, _rate, _wallet)
  {
    //As goal needs to be met for a successful crowdsale
    //the value needs to be less or equal than a cap which is the limit for accepted funds
    require(_goal <= _cap);
  }

  function createTokenContract() internal returns (MintableToken) {
    return new AllPublicArtToken();
  }
}
