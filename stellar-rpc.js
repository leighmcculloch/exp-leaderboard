/**
 * Stellar RPC Client for leaderboard functionality
 */

class StellarRPCClient {
    constructor(rpcUrl = 'https://soroban-testnet.stellar.org') {
        this.rpcUrl = rpcUrl;
        this.nativeAssetContract = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID'; // Native XLM contract on testnet
        this.soroswapFactoryContract = 'CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH'; // Soroswap factory contract
    }

    async makeRPCCall(method, params = []) {
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
            const result = await this.makeRPCCall('getLedgerEntries', {
                keys: [{
                    contractData: {
                        contract: contractAddress,
                        key: {
                            type: 'instance'
                        },
                        durability: 'persistent'
                    }
                }]
            });

            return result.entries && result.entries.length > 0;
        } catch (error) {
            console.error('Error checking contract deployment:', error);
            return false;
        }
    }

    async getContractWasm(contractAddress) {
        try {
            // First get the contract instance to find the wasm hash
            const instanceResult = await this.makeRPCCall('getLedgerEntries', {
                keys: [{
                    contractData: {
                        contract: contractAddress,
                        key: {
                            type: 'instance'
                        },
                        durability: 'persistent'
                    }
                }]
            });

            if (!instanceResult.entries || instanceResult.entries.length === 0) {
                throw new Error('Contract instance not found');
            }

            // Extract wasm hash from the instance data
            const instanceData = instanceResult.entries[0];
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
                return false;
            }

            // This would implement the SEP contract build info verification
            // For now, we'll return a simulated result
            // In a real implementation, this would:
            // 1. Extract source_repo from wasm metadata
            // 2. Clone the repo at the specified commit
            // 3. Build the contract
            // 4. Compare the resulting wasm hash
            
            return Math.random() > 0.5; // Simulated result
        } catch (error) {
            console.error('Error checking build verification:', error);
            return false;
        }
    }

    async checkMintEvents(contractAddress) {
        try {
            // Get events from the last 2 days
            const twoDaysAgo = Math.floor((Date.now() - 2 * 24 * 60 * 60 * 1000) / 1000);
            
            const result = await this.makeRPCCall('getEvents', {
                filters: [{
                    type: 'contract',
                    contractIds: [contractAddress],
                    topics: [['mint', 'Mint']] // Common mint event topics
                }],
                startLedger: twoDaysAgo,
                pagination: {
                    limit: 100
                }
            });

            return result.events && result.events.length > 0;
        } catch (error) {
            console.error('Error checking mint events:', error);
            return false;
        }
    }

    async checkSoroswapPair(contractAddress) {
        try {
            // Simulate a transaction to call get_pair function
            const result = await this.makeRPCCall('simulateTransaction', {
                transaction: this.buildGetPairTransaction(contractAddress)
            });

            // Check if the simulation was successful and returned a valid pair
            return result && result.results && result.results.length > 0;
        } catch (error) {
            console.error('Error checking Soroswap pair:', error);
            return false;
        }
    }

    buildGetPairTransaction(tokenAddress) {
        // This would build a proper transaction to call get_pair on the Soroswap factory
        // For now, returning a placeholder structure
        return {
            sourceAccount: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
            fee: '100',
            seqNum: '1',
            timeBounds: null,
            memo: null,
            operations: [{
                type: 'invokeHostFunction',
                hostFunction: {
                    type: 'invokeContract',
                    contractAddress: this.soroswapFactoryContract,
                    functionName: 'get_pair',
                    args: [
                        { type: 'address', value: tokenAddress },
                        { type: 'address', value: this.nativeAssetContract }
                    ]
                }
            }]
        };
    }

    async checkSoroswapSwapped(contractAddress) {
        try {
            // Look for swap events involving this contract
            const result = await this.makeRPCCall('getEvents', {
                filters: [{
                    type: 'contract',
                    topics: [['swap', 'Swap'], [contractAddress]]
                }],
                pagination: {
                    limit: 100
                }
            });

            return result.events && result.events.length > 0;
        } catch (error) {
            console.error('Error checking Soroswap swapped events:', error);
            return false;
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
window.StellarRPCClient = StellarRPCClient;