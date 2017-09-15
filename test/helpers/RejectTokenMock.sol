pragma solidity ^0.4.11;

import '../../contracts/token/RejectToken.sol';

// mock class using RejectToken
contract RejectTokenMock is RejectToken {

  function RejectTokenMock(address initialAccount, uint256 initialBalance) payable {
    balances[initialAccount] = initialBalance;
    totalSupply = initialBalance;
  }

}
