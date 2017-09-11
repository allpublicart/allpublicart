pragma solidity ^0.4.13;

import './WhitelistedCrowdsale.sol';

contract WhitelistedCrowdsaleMock is WhitelistedCrowdsale {

  function WhitelistedCrowdsaleMock (
    uint256 _startTime,
    uint256 _endTime,
    uint256 _rate,
    address _wallet
  )
    Crowdsale(_startTime, _endTime, _rate, _wallet)
    WhitelistedCrowdsale()
  {
  }
}
