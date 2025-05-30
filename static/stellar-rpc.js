/**
 * Stellar RPC Client for leaderboard functionality
 */

let xdr = null;

async function initializeStellarXdr() {
  if (xdr) {
    return xdr;
  }

  try {
    xdr = await import(
      "https://unpkg.com/@stellar/stellar-xdr-json@22.0.0-rc.1.1/stellar_xdr_json.js"
    );

    // Initialize.
    await xdr.default();

    console.log("Stellar XDR JSON initialized successfully");
    return xdr;
  } catch (error) {
    console.error("Failed to initialize stellar-xdr-json:", error);
    throw new Error(`Failed to load stellar-xdr-json: ${error.message}`);
  }
}

// When searching events, look back this amount of time.
const startLedgerOffset = -2160; // 3 hours ago

class StellarRPCClient {
  constructor(rpcUrl = "https://soroban-testnet.stellar.org:443") {
    this.rpcUrl = rpcUrl;
    this.nativeAssetContract =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"; // Native XLM contract on testnet
    this.soroswapFactoryContract =
      "CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH"; // Soroswap factory contract
    this.soroswapRouterContract =
      "CACIQ6HWPBEMPQYKRRAZSM6ZQORTBTS7DNXCRTI6NQYMUP2BHOXTBUVD"; // Soroswap router contract
  }

  async makeRPCCall(method, params = {}) {
    try {
      const body = {
        jsonrpc: "2.0",
        id: 1,
        method: method,
      };
      if (Object.keys(params).length > 0) {
        body["params"] = params;
      }
      const response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
      const xdr = await initializeStellarXdr();

      const keyXdr = xdr.encode("LedgerKey", JSON.stringify({
        contract_data: {
          contract: contractAddress,
          key: "ledger_key_contract_instance",
          durability: "persistent",
        },
      }));

      const result = await this.makeRPCCall("getLedgerEntries", { keys: [keyXdr] });

      return result.entries && result.entries.length > 0;
    } catch (error) {
      console.error("Error checking contract deployment:", error);
      // Return false for now to allow app to continue
      return false;
    }
  }

  async getContractWasmHash(contractAddress) {
    try {
      const xdr = await initializeStellarXdr();

      const keyXdr = xdr.encode("LedgerKey", JSON.stringify({
        contract_data: {
          contract: contractAddress,
          key: "ledger_key_contract_instance",
          durability: "persistent",
        },
      }));

      const result = await this.makeRPCCall("getLedgerEntries", {
        keys: [keyXdr],
      });

      if (!result.entries || result.entries.length === 0) {
        throw new Error("Contract instance not found");
      }

      const instanceJson = xdr.decode("LedgerEntryData", result.entries[0].xdr);
      const instance = JSON.parse(instanceJson);
      const wasm = instance.contract_data.val.contract_instance.executable.wasm;
      console.log("wasm: ", wasm);
      return wasm;
    } catch (error) {
      console.error("Error getting contract wasm:", error);
      return null;
    }
  }

  async getContractWasm(wasmHash) {
    try {
      const xdr = await initializeStellarXdr();

      const keyXdr = xdr.encode("LedgerKey", JSON.stringify({
        contract_code: {
          hash: wasmHash,
        },
      }));

      const result = await this.makeRPCCall("getLedgerEntries", {
        keys: [keyXdr],
      });

      if (!result.entries || result.entries.length === 0) {
        throw new Error("Contract code not found");
      }

      const codeJson = xdr.decode("LedgerEntryData", result.entries[0].xdr);
      const code = JSON.parse(codeJson);
      const wasm = code.contract_code.code;
      console.log("wasm: ", wasm);
      const bytes = wasm.match(/.{2}/g)?.map(b => parseInt(b, 16)) || [];
      return new Uint8Array(bytes).buffer;
    } catch (error) {
      console.error("Error getting contract wasm:", error);
      return null;
    }
  }

  async checkBuildVerified(contractAddress) {
    try {
      const xdr = await initializeStellarXdr();

      const wasmHash = await this.getContractWasmHash(contractAddress);
      if (!wasmHash) {
        return false;
      }

      const wasm = await this.getContractWasm(wasmHash);
      if (!wasm) {
        return false;
      }

      const module = await WebAssembly.compile(wasm);
      const sections = WebAssembly.Module.customSections(module, "contractmetav0");
      for (const section of sections) {
        const xdrbase64 = btoa(new Uint8Array(section).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        const entriesJson = xdr.decode_stream("ScMetaEntry", xdrbase64);
        const entries = entriesJson.map((json) => JSON.parse(json));
        for (const entry of entries) {
          if (entry.sc_meta_v0.key === "source_repo") {
            const source_repo = entry.sc_meta_v0.val;
            const prefix = "github:";
            if (source_repo.startsWith(prefix)) {
              const github_repo = source_repo.slice(prefix.length);

              const resp = await fetch(`/attestation?repo=${github_repo}&hash=${wasmHash}`);
              console.log(resp);
              return resp.status == 200;
            }
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking build verification:", error);
      throw error;
    }
  }

  async checkMintEvents(contractAddress, currentLedgerSequence = null) {
    try {
      const xdr = await initializeStellarXdr();

      if (currentLedgerSequence === null) {
        const latestLedger = await this.makeRPCCall("getLatestLedger");
        currentLedgerSequence = latestLedger.sequence;
      }

      const startLedger = Math.max(1, currentLedgerSequence + startLedgerOffset);

      const mintSymbol = xdr.encode("ScVal", JSON.stringify({ symbol: "mint" }));

      const result = await this.makeRPCCall("getEvents", {
        filters: [{
          type: "contract",
          contractIds: [contractAddress],
          topics: [[mintSymbol, "*"]],
        }],
        startLedger,
        pagination: {
          limit: 100,
        },
      });

      console.log("getEvents result:", result);
      return result.events && result.events.length > 0;
    } catch (error) {
      console.error("Error checking mint events:", error);
      return false; // Return false instead of throwing
    }
  }

  async checkSoroswapPair(contractAddress, currentLedgerSequence = null) {
    try {
      const xdr = await initializeStellarXdr();

      if (currentLedgerSequence === null) {
        const latestLedger = await this.makeRPCCall("getLatestLedger");
        currentLedgerSequence = latestLedger.sequence;
      }

      const startLedger = Math.max(1, currentLedgerSequence + startLedgerOffset);

      const soroswapTopic = xdr.encode("ScVal", JSON.stringify({ string: "SoroswapFactory" }));
      const newPairTopic = xdr.encode("ScVal", JSON.stringify({ symbol: "new_pair" }));

      const result = await this.makeRPCCall("getEvents", {
        filters: [{
          type: "contract",
          contractIds: [this.soroswapFactoryContract],
          topics: [[soroswapTopic, newPairTopic]],
        }],
        startLedger,
        pagination: {
          limit: 100,
        },
      });
      console.log("soroswap pair: getEvents result:", result);

      for (const event of result.events) {
        const valueJson = xdr.decode_stream("ScVal", event.value);
        const value = JSON.parse(valueJson);
        for (const mapEntry of value.map) {
          if (mapEntry.key["symbol"] == "token_0" || mapEntry.key["symbol"] == "token_1") {
            if (mapEntry.val["address"] == contractAddress) {
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking Soroswap pair:", error);
      return false;
    }
  }

  async checkSoroswapLiquidity(contractAddress, currentLedgerSequence = null) {
    try {
      const xdr = await initializeStellarXdr();

      if (currentLedgerSequence === null) {
        const latestLedger = await this.makeRPCCall("getLatestLedger");
        currentLedgerSequence = latestLedger.sequence;
      }

      const startLedger = Math.max(1, currentLedgerSequence + startLedgerOffset);

      const soroswapTopic = xdr.encode("ScVal", JSON.stringify({ string: "SoroswapRouter" }));
      const addTopic = xdr.encode("ScVal", JSON.stringify({ symbol: "add" }));

      const result = await this.makeRPCCall("getEvents", {
        filters: [{
          type: "contract",
          contractIds: [this.soroswapRouterContract],
          topics: [[soroswapTopic, addTopic]],
        }],
        startLedger,
        pagination: {
          limit: 100,
        },
      });
      console.log("soroswap liquidity: getEvents result:", result);

      for (const event of result.events) {
        const valueJson = xdr.decode_stream("ScVal", event.value);
        const value = JSON.parse(valueJson);
        for (const mapEntry of value.map) {
          if (mapEntry.key["symbol"] == "token_a" || mapEntry.key["symbol"] == "token_b") {
            if (mapEntry.val["address"] == contractAddress) {
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking Soroswap liquidity:", error);
      return false;
    }
  }

  async checkSoroswapSwapped(contractAddress, currentLedgerSequence = null) {
    try {
      const xdr = await initializeStellarXdr();

      if (currentLedgerSequence === null) {
        const latestLedger = await this.makeRPCCall("getLatestLedger");
        currentLedgerSequence = latestLedger.sequence;
      }

      const startLedger = Math.max(1, currentLedgerSequence + startLedgerOffset);

      const soroswapTopic = xdr.encode("ScVal", JSON.stringify({ string: "SoroswapRouter" }));
      const swapTopic = xdr.encode("ScVal", JSON.stringify({ symbol: "swap" }));

      const result = await this.makeRPCCall("getEvents", {
        filters: [{
          type: "contract",
          contractIds: [this.soroswapRouterContract],
          topics: [[soroswapTopic, swapTopic]],
        }],
        startLedger,
        pagination: {
          limit: 100,
        },
      });
      console.log("soroswap swap: getEvents result:", result);

      for (const event of result.events) {
        const valueJson = xdr.decode_stream("ScVal", event.value);
        const value = JSON.parse(valueJson);
        for (const mapEntry of value.map) {
          if (mapEntry.key["symbol"] == "path") {
            for (const address of mapEntry.val["vec"]) {
              if (address["address"] == contractAddress) {
                return true;
              }
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking Soroswap swapped events:", error);
      return false; // Return false instead of throwing
    }
  }

  async getFullContractStatus(contractAddress) {
    const status = {
      deployed: false,
      buildVerified: false,
      minted: false,
      soroswapPair: false,
      soroswapLiquidity: false,
      soroswapSwapped: false,
    };

    try {
      // Get the latest ledger once to use across all checks
      const latestLedger = await this.makeRPCCall("getLatestLedger");
      const currentLedgerSequence = latestLedger.sequence;

      status.deployed = await this.checkContractDeployed(contractAddress);
      status.buildVerified = await this.checkBuildVerified(contractAddress);
      status.minted = await this.checkMintEvents(contractAddress, currentLedgerSequence);
      status.soroswapPair = await this.checkSoroswapPair(contractAddress, currentLedgerSequence);
      status.soroswapLiquidity = await this.checkSoroswapLiquidity(contractAddress, currentLedgerSequence);
      status.soroswapSwapped = await this.checkSoroswapSwapped(contractAddress, currentLedgerSequence);
    } catch (error) {
      console.error("Error getting full contract status:", error);
    }

    return status;
  }
}

// Export for use in other modules
export default StellarRPCClient;
