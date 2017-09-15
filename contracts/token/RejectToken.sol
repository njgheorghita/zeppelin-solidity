pragma solidity ^0.4.11;

import './StandardToken.sol';
import '../ownership/NoOwner.sol';

/**
 * @title RejectToken
 * 
 * @dev StandardToken modified to include HasNoEther, HasNoTokens, HasNoContracts
 * @dev Prevents token contracts from holding unclaimable ETH, token balances or contracts, 
 *      which happens a lot by user error.
 */

contract RejectToken is StandardToken, NoOwner {
    /**
    * @dev Constructor that rejects incoming Ether
    * @dev The `payable` flag is added so we can access `msg.value` without compiler warning. If we
    * leave out payable, then Solidity will allow inheriting contracts to implement a payable
    * constructor. By doing it this way we prevent a payable constructor from working. Alternatively
    * we could use assembly to access msg.value.
    */
    function RejectToken() payable {
        require(msg.value == 0);
    }

}