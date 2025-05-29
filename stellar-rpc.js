/**
 * Stellar RPC Client for leaderboard functionality
 */

// Global stellar XDR JSON instance
let stellar_xdr_json = null;
let stellarXdrInitialized = false;

// Helper function to try multiple XDR encoding patterns
async function tryEncodeXDR(xdr, type, patterns, description) {
    for (let i = 0; i < patterns.length; i++) {
        try {
            const result = xdr.encode(type, patterns[i]);
            if (result) {
                console.log(`${description} - Pattern ${i + 1} succeeded:`, patterns[i]);
                return result;
            }
        } catch (error) {
            console.log(`${description} - Pattern ${i + 1} failed:`, error.message);
        }
    }
    throw new Error(`All ${description} encoding patterns failed`);
}

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
            
            // Try multiple LedgerKey patterns for contract instance data
            const keyPatterns = [
                // Pattern 1: Basic structure
                {
                    contractData: {
                        contract: contractAddress,
                        key: 'instance',
                        durability: 'persistent'
                    }
                },
                // Pattern 2: With type field
                {
                    type: 'contractData',
                    contractData: {
                        contract: contractAddress,
                        key: 'instance',
                        durability: 'persistent'
                    }
                },
                // Pattern 3: More explicit structure
                {
                    contractData: {
                        contract: { address: contractAddress },
                        key: { type: 'instance' },
                        durability: 'persistent'
                    }
                },
                // Pattern 4: Alternative key type
                {
                    contractData: {
                        contract: contractAddress,
                        key: 'ledgerKeyContractInstance',
                        durability: 'persistent'
                    }
                }
            ];

            console.log('Trying to encode LedgerKey for contract:', contractAddress);
            
            // Try to encode with different patterns
            const keyXdr = await tryEncodeXDR(xdr, 'LedgerKey', keyPatterns, 'LedgerKey Contract Data');
            
            console.log('LedgerKey encoded successfully:', keyXdr.substring(0, 50) + '...');
            
            // Pass parameters in the correct format for getLedgerEntries
            const result = await this.makeRPCCall('getLedgerEntries', {
                keys: [keyXdr]
            });

            return result.entries && result.entries.length > 0;
        } catch (error) {
            console.error('Error checking contract deployment:', error);
            // Return false for now to allow app to continue
            return false;
        }
    }

    async getContractWasm(contractAddress) {
        try {
            // Initialize stellar-xdr-json if not already done
            const xdr = await initializeStellarXdr();
            
            // Use the same pattern-based approach for LedgerKey
            const keyPatterns = [
                {
                    contractData: {
                        contract: contractAddress,
                        key: 'instance',
                        durability: 'persistent'
                    }
                },
                {
                    type: 'contractData',
                    contractData: {
                        contract: contractAddress,
                        key: 'instance',
                        durability: 'persistent'
                    }
                },
                {
                    contractData: {
                        contract: { address: contractAddress },
                        key: { type: 'instance' },
                        durability: 'persistent'
                    }
                }
            ];

            console.log('Trying to encode LedgerKey for contract wasm:', contractAddress);
            const keyXdr = await tryEncodeXDR(xdr, 'LedgerKey', keyPatterns, 'LedgerKey Contract Wasm');
            
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
            
            // Test basic getLatestLedger to verify RPC connectivity
            const latestLedger = await this.makeRPCCall('getLatestLedger', {});
            const currentLedgerSequence = latestLedger.sequence;
            
            // Calculate ledger sequence from 2 days ago
            const twoDaysAgoLedger = Math.max(1, currentLedgerSequence - 34560);
            
            // Try multiple ScVal patterns for 'mint' symbol
            const mintPatterns = [
                { sym: 'mint' },
                { type: 'scvSymbol', sym: 'mint' },
                { type: 'symbol', sym: 'mint' },
                { type: 'scvSymbol', symbol: 'mint' },
                'mint'
            ];
            
            console.log('Trying to encode ScVal for mint symbol');
            const mintSymbol = await tryEncodeXDR(xdr, 'ScVal', mintPatterns, 'ScVal Mint Symbol');
            
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

            console.log('getEvents result:', result);
            return result.events && result.events.length > 0;
        } catch (error) {
            console.error('Error checking mint events:', error);
            return false; // Return false instead of throwing
        }
    }

    async checkSoroswapPair(contractAddress) {
        try {
            // Temporarily disable XDR encoding
            console.log('Temporarily mocking checkSoroswapPair for:', contractAddress);
            
            // Return mock result based on known Soroswap contracts
            const soroswapContracts = ['CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH'];
            return soroswapContracts.includes(contractAddress);
        } catch (error) {
            console.error('Error checking Soroswap pair:', error);
            return false;
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
            
            // Try multiple ScVal patterns for 'swap' symbol
            const swapPatterns = [
                { sym: 'swap' },
                { type: 'scvSymbol', sym: 'swap' },
                { type: 'symbol', sym: 'swap' },
                { type: 'scvSymbol', symbol: 'swap' },
                'swap'
            ];
            
            console.log('Trying to encode ScVal for swap symbol');
            const swapSymbol = await tryEncodeXDR(xdr, 'ScVal', swapPatterns, 'ScVal Swap Symbol');
            
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
            return false; // Return false instead of throwing
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