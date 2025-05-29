/**
 * Stellar RPC Client for leaderboard functionality
 */

// Global stellar XDR JSON instance
let stellar_xdr_json = null;
let stellarXdrInitialized = false;

// Initialize stellar-xdr-json
async function initializeStellarXdr() {
    if (stellarXdrInitialized && stellar_xdr_json) {
        return stellar_xdr_json;
    }
    
    try {
        // Import the module
        const module = await import('https://unpkg.com/@stellar/stellar-xdr-json@22.0.0-rc.1.1/stellar_xdr_json.js');
        
        // The module export structure might be different
        if (module.default) {
            stellar_xdr_json = module.default;
        } else {
            stellar_xdr_json = module;
        }
        
        // Call the init function to load the WASM file  
        if (stellar_xdr_json.init) {
            await stellar_xdr_json.init();
        } else if (stellar_xdr_json.default && stellar_xdr_json.default.init) {
            await stellar_xdr_json.default.init();
            stellar_xdr_json = stellar_xdr_json.default;
        } else {
            console.warn('No init function found on stellar-xdr-json module');
        }
        
        stellarXdrInitialized = true;
        console.log('Stellar XDR JSON initialized successfully');
        return stellar_xdr_json;
        
    } catch (error) {
        console.error('Failed to initialize stellar-xdr-json:', error);
        throw new Error(`Failed to load stellar-xdr-json: ${error.message}`);
    }
}

class StellarRPCClient {
    constructor(rpcUrl = 'https://soroban-testnet.stellar.org:443') {
        this.rpcUrl = rpcUrl;
        this.nativeAssetContract = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID'; // Native XLM contract on testnet
        this.soroswapFactoryContract = 'CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH'; // Soroswap factory contract
    }

    async makeRPCCall(method, params = {}) {
        try {
            const response = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: method,
                    params: params
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`);
            }

            return data.result;
        } catch (error) {
            console.error(`Error calling ${method}:`, error);
            throw error;
        }
    }

    async checkContractDeployed(contractAddress) {
        try {
            // Initialize stellar-xdr-json if not already done
            const xdr = await initializeStellarXdr();
            
            if (!xdr || typeof xdr.encode !== 'function') {
                throw new Error('stellar-xdr-json not properly initialized or missing encode function');
            }
            
            // Create the contract instance key in JSON format
            // Try a simplified structure
            const keyJson = {
                contractData: {
                    contract: contractAddress,
                    key: 'instance',
                    durability: 'persistent'
                }
            };

            console.log('Encoding LedgerKey with JSON:', keyJson);
            
            // Convert to XDR using stellar-xdr-json
            const keyXdr = xdr.encode('LedgerKey', keyJson);
            
            if (!keyXdr) {
                throw new Error('XDR encoding returned null/undefined');
            }
            
            console.log('LedgerKey encoded to XDR:', keyXdr.substring(0, 50) + '...');
            
            // Pass parameters in the correct format for getLedgerEntries
            const result = await this.makeRPCCall('getLedgerEntries', {
                keys: [keyXdr]
            });

            return result.entries && result.entries.length > 0;
        } catch (error) {
            console.error('Error checking contract deployment:', error);
            throw error;
        }
    }

    async getContractWasm(contractAddress) {
        try {
            // Initialize stellar-xdr-json if not already done
            const xdr = await initializeStellarXdr();
            
            // First get the contract instance to find the wasm hash
            // Create the contract instance key in JSON format
            const keyJson = {
                contractData: {
                    contract: contractAddress,
                    key: 'instance',
                    durability: 'persistent'
                }
            };

            // Convert to XDR using stellar-xdr-json
            const keyXdr = xdr.encode('LedgerKey', keyJson);
            
            // Pass parameters in the correct format for getLedgerEntries
            const instanceResult = await this.makeRPCCall('getLedgerEntries', {
                keys: [keyXdr]
            });

            if (!instanceResult.entries || instanceResult.entries.length === 0) {
                throw new Error('Contract instance not found');
            }

            // Decode the XDR response
            const instanceData = xdr.decode('LedgerEntryData', instanceResult.entries[0].xdr);
            // This would need proper XDR parsing in a real implementation
            // For now, we'll simulate the check
            return null; // Placeholder - would return actual wasm data
        } catch (error) {
            console.error('Error getting contract wasm:', error);
            return null;
        }
    }

    async checkBuildVerified(contractAddress) {
        try {
            const wasm = await this.getContractWasm(contractAddress);
            if (!wasm) {
                // Cannot verify without wasm data
                return false;
            }

            // This would implement the SEP contract build info verification
            // For now, we'll return false since we don't have full implementation
            // In a real implementation, this would:
            // 1. Extract source_repo from wasm metadata
            // 2. Clone the repo at the specified commit
            // 3. Build the contract
            // 4. Compare the resulting wasm hash
            
            return false; // Cannot verify without full implementation
        } catch (error) {
            console.error('Error checking build verification:', error);
            throw error;
        }
    }

    async checkMintEvents(contractAddress) {
        try {
            // Initialize stellar-xdr-json if not already done
            const xdr = await initializeStellarXdr();
            
            // Get the latest ledger to calculate 2 days ago
            const latestLedger = await this.makeRPCCall('getLatestLedger', {});
            const currentLedgerSequence = latestLedger.sequence;
            
            // Calculate ledger sequence from 2 days ago
            // 1 ledger every 5 seconds, so 2 days = 2 * 24 * 60 * 60 / 5 = 34,560 ledgers
            const twoDaysAgoLedger = Math.max(1, currentLedgerSequence - 34560);
            
            // Encode 'mint' as an ScVal Symbol - try simplified structure
            const mintSymbol = xdr.encode('ScVal', {
                sym: 'mint'
            });
            
            const result = await this.makeRPCCall('getEvents', {
                filters: [{
                    type: 'contract',
                    contractIds: [contractAddress],
                    topics: [[mintSymbol, '*']] // Mint event with any second field
                }],
                startLedger: twoDaysAgoLedger,
                pagination: {
                    limit: 100
                }
            });

            return result.events && result.events.length > 0;
        } catch (error) {
            console.error('Error checking mint events:', error);
            throw error;
        }
    }

    async checkSoroswapPair(contractAddress) {
        try {
            // Initialize stellar-xdr-json if not already done
            const xdr = await initializeStellarXdr();
            
            // Build the transaction in JSON format first
            const transactionJson = this.buildGetPairTransactionJson(contractAddress);
            
            // Convert to XDR using stellar-xdr-json
            const transactionXdr = xdr.encode('TransactionEnvelope', transactionJson);
            
            // Simulate a transaction to call get_pair function
            // Pass parameters in the correct format for simulateTransaction
            const result = await this.makeRPCCall('simulateTransaction', {
                transaction: transactionXdr
            });

            // Decode the response if successful
            if (result && result.results && result.results.length > 0) {
                // Would decode the XDR result here in a real implementation
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking Soroswap pair:', error);
            throw error;
        }
    }

    buildGetPairTransactionJson(tokenAddress) {
        // This builds a transaction JSON structure to call get_pair on the Soroswap factory
        // For now, returning a simplified structure that would work with XDR encoding
        return {
            sourceAccount: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            fee: 100,
            seqNum: 1,
            timeBounds: null,
            memo: {
                type: 'none'
            },
            operations: [{
                sourceAccount: null,
                body: {
                    type: 'invokeHostFunction',
                    invokeHostFunctionOp: {
                        hostFunction: {
                            type: 'invokeContract',
                            invokeContract: {
                                contractAddress: this.soroswapFactoryContract,
                                functionName: 'get_pair',
                                args: [
                                    { type: 'address', address: tokenAddress },
                                    { type: 'address', address: this.nativeAssetContract }
                                ]
                            }
                        },
                        auth: []
                    }
                }
            }],
            ext: {
                v: 0
            }
        };
    }

    async checkSoroswapSwapped(contractAddress) {
        try {
            // Initialize stellar-xdr-json if not already done
            const xdr = await initializeStellarXdr();
            
            // Encode 'swap' as an ScVal Symbol - try simplified structure
            const swapSymbol = xdr.encode('ScVal', {
                sym: 'swap'
            });
            
            // Look for swap events involving this contract
            const result = await this.makeRPCCall('getEvents', {
                filters: [{
                    type: 'contract',
                    contractIds: [contractAddress],
                    topics: [[swapSymbol]] // Soroswap swap event encoded as XDR ScVal Symbol
                }],
                pagination: {
                    limit: 100
                }
            });

            return result.events && result.events.length > 0;
        } catch (error) {
            console.error('Error checking Soroswap swapped events:', error);
            throw error;
        }
    }

    async getFullContractStatus(contractAddress) {
        const status = {
            deployed: false,
            buildVerified: false,
            minted: false,
            soroswapPair: false,
            soroswapSwapped: false
        };

        try {
            // Run all checks in parallel for better performance
            const [deployed, buildVerified, minted, soroswapPair, soroswapSwapped] = await Promise.allSettled([
                this.checkContractDeployed(contractAddress),
                this.checkBuildVerified(contractAddress),
                this.checkMintEvents(contractAddress),
                this.checkSoroswapPair(contractAddress),
                this.checkSoroswapSwapped(contractAddress)
            ]);

            status.deployed = deployed.status === 'fulfilled' ? deployed.value : false;
            status.buildVerified = buildVerified.status === 'fulfilled' ? buildVerified.value : false;
            status.minted = minted.status === 'fulfilled' ? minted.value : false;
            status.soroswapPair = soroswapPair.status === 'fulfilled' ? soroswapPair.value : false;
            status.soroswapSwapped = soroswapSwapped.status === 'fulfilled' ? soroswapSwapped.value : false;
        } catch (error) {
            console.error('Error getting full contract status:', error);
        }

        return status;
    }
}

// Export for use in other modules
export default StellarRPCClient;