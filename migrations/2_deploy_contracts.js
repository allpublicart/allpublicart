const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const BigNumber = web3.BigNumber

const dayInSecs = 86400
const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 80
const preSaleEnds = startTime + dayInSecs * 10 // 10 days
const firstBonusSalesEnds = startTime + dayInSecs * 20 // 20 days
const secondBonusSalesEnds = startTime + dayInSecs * 30 // 30 days
const thirdBonusSalesEnds = startTime + dayInSecs * 40 // 40 days
const endTime = startTime + (dayInSecs * 60) // 60 days
const rate = new BigNumber(500)
const preferentialRate = new BigNumber(100)

module.exports = function(deployer, network, [_, wallet]) {
    if(network == "testnet" || network == "rinkeby") {
        deployer.deploy(
            AllPublicArtCrowdsale,
            startTime,
            preSaleEnds,
            firstBonusSalesEnds,
            secondBonusSalesEnds,
            thirdBonusSalesEnds,
            endTime,
            rate,
            preferentialRate,
            wallet
        );
    } else {
      deployer.deploy(AllPublicArtToken);
      deployer.deploy(
          AllPublicArtCrowdsale,
          startTime,
          preSaleEnds,
          firstBonusSalesEnds,
          secondBonusSalesEnds,
          thirdBonusSalesEnds,
          endTime,
          rate,
          preferentialRate,
          wallet
      );
  }
};
