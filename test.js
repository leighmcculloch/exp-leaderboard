#!/usr/bin/env node

/**
 * Command-line test script for Stellar RPC Client
 * Tests each check function against soroban-testnet.stellar.org
 */

// Note: This is a simplified test that doesn't use the stellar-xdr-json library
// to avoid module loading complexity in Node.js

const https = require('https');

class SimpleStellarRPCClient {
    constructor(rpcUrl = 'https://soroban-testnet.stellar.org:443') {
        this.rpcUrl = rpcUrl;
        this.nativeAssetContract = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID';
        this.soroswapFactoryContract = 'CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH';
    }

    async makeRPCCall(method, params = {}) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: method,
                params: params
            });

            const url = new URL(this.rpcUrl);
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.error) {
                            reject(new Error(`RPC error: ${response.error.message}`));
                        } else {
                            resolve(response.result);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request error: ${error.message}`));
            });

            req.write(postData);
            req.end();
        });
    }

    async testBasicConnectivity() {
        try {
            const result = await this.makeRPCCall('getLatestLedger', {});
            return {
                success: true,
                data: {
                    sequence: result.sequence,
                    protocolVersion: result.protocolVersion,
                    timestamp: new Date(result.timestamp * 1000).toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async testGetLedgerEntries(contractAddress) {
        try {
            // Test with basic parameters (without XDR encoding for simplicity)
            const result = await this.makeRPCCall('getLedgerEntries', {
                keys: [] // Empty for this test
            });
            return {
                success: true,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                note: 'Expected to fail without proper XDR encoding'
            };
        }
    }

    async testGetEvents(contractAddress) {
        try {
            // Get latest ledger for recent events
            const latestLedger = await this.makeRPCCall('getLatestLedger', {});
            const startLedger = Math.max(1, latestLedger.sequence - 100); // Last 100 ledgers

            const result = await this.makeRPCCall('getEvents', {
                filters: [{
                    type: 'contract',
                    contractIds: [contractAddress]
                }],
                startLedger: startLedger,
                pagination: {
                    limit: 10
                }
            });
            return {
                success: true,
                data: {
                    eventCount: result.events ? result.events.length : 0,
                    latestLedger: result.latestLedger
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async testSimulateTransaction() {
        try {
            // Test with empty transaction (will fail but tests RPC endpoint)
            const result = await this.makeRPCCall('simulateTransaction', {});
            return {
                success: true,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                note: 'Expected to fail without transaction parameter'
            };
        }
    }
}

// Test contracts
const TEST_CONTRACTS = {
    nativeXLM: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID',
    soroswapFactory: 'CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH'
};

async function runTests() {
    const client = new SimpleStellarRPCClient();
    
    console.log('🧪 Stellar RPC Client Test Suite');
    console.log('================================');
    console.log('Testing against:', client.rpcUrl);
    console.log('');

    // Test basic connectivity
    console.log('1️⃣  Testing Basic Connectivity...');
    const connectivityResult = await client.testBasicConnectivity();
    if (connectivityResult.success) {
        console.log('✅ Basic connectivity successful');
        console.log('📊 Latest ledger:', connectivityResult.data.sequence);
        console.log('🕐 Timestamp:', connectivityResult.data.timestamp);
    } else {
        console.log('❌ Basic connectivity failed:', connectivityResult.error);
        console.log('🚫 Cannot proceed with other tests');
        return;
    }
    console.log('');

    // Test RPC methods with each contract
    for (const [contractName, contractAddress] of Object.entries(TEST_CONTRACTS)) {
        console.log(`2️⃣  Testing RPC Methods for ${contractName}...`);
        console.log(`📍 Contract: ${contractAddress}`);
        
        // Test getLedgerEntries
        console.log('  📚 Testing getLedgerEntries...');
        const ledgerResult = await client.testGetLedgerEntries(contractAddress);
        if (ledgerResult.success) {
            console.log('  ✅ getLedgerEntries successful');
        } else {
            console.log('  ❌ getLedgerEntries failed:', ledgerResult.error);
            if (ledgerResult.note) console.log('  📝', ledgerResult.note);
        }

        // Test getEvents
        console.log('  📅 Testing getEvents...');
        const eventsResult = await client.testGetEvents(contractAddress);
        if (eventsResult.success) {
            console.log('  ✅ getEvents successful');
            console.log('  📊 Event count:', eventsResult.data.eventCount);
        } else {
            console.log('  ❌ getEvents failed:', eventsResult.error);
        }

        console.log('');
    }

    // Test simulateTransaction
    console.log('3️⃣  Testing simulateTransaction...');
    const simulateResult = await client.testSimulateTransaction();
    if (simulateResult.success) {
        console.log('✅ simulateTransaction successful');
    } else {
        console.log('❌ simulateTransaction failed:', simulateResult.error);
        if (simulateResult.note) console.log('📝', simulateResult.note);
    }
    console.log('');

    console.log('🏁 Test suite completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Basic RPC connectivity:', connectivityResult.success ? '✅' : '❌');
    console.log('- This simplified test validates RPC endpoint accessibility');
    console.log('- Full functionality requires proper XDR encoding with stellar-xdr-json');
    console.log('- Use the browser test (test.html) for complete function testing');
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests().catch(error => {
        console.error('💥 Test suite failed:', error.message);
        process.exit(1);
    });
}

module.exports = { SimpleStellarRPCClient, runTests };