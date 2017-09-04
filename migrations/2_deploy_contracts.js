const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const CompanyAllocation = artifacts.require("./CompanyAllocation.sol");

module.exports = function(deployer) {
  deployer.deploy(AllPublicArtToken);
  deployer.deploy(AllPublicArtCrowdsale);
  deployer.deploy(CompanyAllocation);
};
