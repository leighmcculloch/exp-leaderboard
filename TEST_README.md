# Stellar RPC Client Test Suite

This directory contains test files to validate the Stellar RPC client functions against the soroban-testnet.stellar.org RPC endpoint.

## Test Files

### 1. test.html - Browser-based Test Suite
A comprehensive HTML test page that tests all the check functions in the browser environment.

**Features:**
- Tests all RPC client functions: `checkContractDeployed`, `checkBuildVerified`, `checkMintEvents`, `checkSoroswapPair`, `checkSoroswapSwapped`
- Uses the same stellar-xdr-json library as the main application
- Tests with known contract addresses:
  - Native XLM: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID`
  - Soroswap Factory: `CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH`
- Visual results display with success/error indicators
- Individual and bulk test execution

**Usage:**
```bash
# Start a local server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080/test.html
```

### 2. test.js - Node.js Command-line Test
A simplified Node.js test script that validates basic RPC connectivity and endpoint accessibility.

**Features:**
- Tests basic RPC connectivity (`getLatestLedger`)
- Tests RPC method endpoints without XDR encoding
- Command-line output with emojis for easy reading
- Can be run without browser dependencies

**Usage:**
```bash
node test.js
```

## Test Contract Addresses

The tests use the following known contract addresses on Stellar testnet:

- **Native XLM Contract**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID`
- **Soroswap Factory Contract**: `CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH`

## What the Tests Validate

### checkContractDeployed
Tests whether a contract exists on the network by calling `getLedgerEntries` with the contract instance key.

### checkBuildVerified  
Tests the SEP contract build verification by attempting to retrieve and verify contract WASM data.

### checkMintEvents
Tests event retrieval by looking for mint events over the last 2 days using `getEvents`.

### checkSoroswapPair
Tests Soroswap pair existence by simulating `get_pair` transaction calls.

### checkSoroswapSwapped
Tests for Soroswap swap events by filtering contract events for swap topics.

## Expected Results

When run with proper network access to soroban-testnet.stellar.org:

1. **Basic Connectivity**: Should successfully retrieve latest ledger information
2. **Contract Deployment**: Known contracts should return `true`, non-existent contracts should return `false`
3. **Build Verification**: Currently returns `false` (placeholder implementation)
4. **Event Queries**: May return `true` or `false` depending on recent blockchain activity
5. **XDR Encoding**: Should successfully encode/decode data using stellar-xdr-json

## Troubleshooting

### Network Access Issues
If you see "Request error: getaddrinfo EAI_AGAIN soroban-testnet.stellar.org", this indicates network firewall restrictions. The tests are designed to validate functionality when network access is available.

### XDR Encoding Errors
The stellar-xdr-json library requires proper initialization. Errors like "stellar_xdr_json.init is not a function" indicate module loading issues that need to be resolved.

### RPC Parameter Errors
Errors like "RPC error: invalid parameters" indicate that the XDR encoding of request parameters needs to be fixed.

## Test Output Examples

### Successful Basic Connectivity:
```
✅ Basic connectivity successful
📊 Latest ledger: 123456
🕐 Timestamp: 2024-01-01T12:00:00.000Z
```

### Successful Contract Check:
```
checkContractDeployed - CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID
Result: true
```

### Failed RPC Call:
```
Error: RPC error: invalid parameters
```

This indicates the XDR encoding needs to be fixed in the stellar-rpc.js implementation.