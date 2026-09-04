# WHOOSH

Group payment infrastructure sandbox for simulating shared purchases, authorization logic, ledger updates, and settlement workflows.

WHOOSH explores a payment model where group expenses are handled as part of the authorization flow instead of being settled manually afterward.

The current prototype uses simulated CAD balances only and does not connect to real payment rails.

## Demo

The developer sandbox lets you simulate a group purchase and inspect the full flow:

![WHOOSH developer sandbox showing a simulated group purchase, API inspector, balances, and settlement queue](docs/images/whoosh-sandbox.png)

- choose a merchant
- enter a transaction amount
- select participating members
- choose who fronts the purchase
- simulate authorization
- inspect the API request and response
- view updated member balances
- view generated settlement obligations
- process pending settlements
- simulate settlement failures such as insufficient funds

Example:

```text
Merchant: Uber Eats
Amount: $200 CAD
Participants: 4
Fronting member: Sarah
Split method: Equal
```
