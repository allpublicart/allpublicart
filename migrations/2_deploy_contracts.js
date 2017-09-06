const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const CompanyAllocation = artifacts.require("./CompanyAllocation.sol");
const BigNumber = web3.BigNumber

const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 80
const endTime = startTime + (86400 * 20) // 20 days
const rate = new BigNumber(500)
const goal = new BigNumber(900)
const cap = new BigNumber(1000)

module.exports = function(deployer, network, [_, wallet]) {
  deployer.deploy(AllPublicArtToken);
  deployer.deploy(AllPublicArtCrowdsale, startTime, endTime, rate, goal, cap, wallet);
  deployer.deploy(CompanyAllocation);
};
