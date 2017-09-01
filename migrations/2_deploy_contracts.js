const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");

module.exports = function(deployer) {
  deployer.deploy(AllPublicArtToken);
  deployer.deploy(AllPublicArtCrowdsale);
};
