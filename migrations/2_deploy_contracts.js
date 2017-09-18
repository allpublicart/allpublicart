const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const BigNumber = web3.BigNumber

const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 80
const endTime = startTime + (86400 * 20) // 20 days
const rate = new BigNumber(500)
const cap = new BigNumber(1000)
const preferentialRate = new BigNumber(100)

module.exports = function(deployer, network, [_, wallet]) {
  deployer.deploy(AllPublicArtToken);
  deployer.deploy(AllPublicArtCrowdsale, startTime, endTime, rate, cap, preferentialRate, wallet);
};
