const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");

module.exports = function(deployer) {
  deployer.deploy(AllPublicArtToken);
};
