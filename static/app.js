/**
 * Main application logic for the Stellar Contract Leaderboard
 */

import StellarRPCClient from "./stellar-rpc.js";

class LeaderboardApp {
  constructor() {
    this.contracts = [];
    this.stellarRPC = new StellarRPCClient();
    this.sessionStorageKey = "stellar_leaderboard_contracts";

    // Load contracts from session storage on startup
    this.loadContractsFromStorage();
    this.renderTable();

    // Refresh data every 30 seconds
    setInterval(() => this.refreshAllContractData(), 10000);
  }

  loadContractsFromStorage() {
    try {
      const stored = sessionStorage.getItem(this.sessionStorageKey);
      if (stored) {
        this.contracts = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading contracts from storage:", error);
      this.contracts = [];
    }
  }

  saveContractsToStorage() {
    try {
      sessionStorage.setItem(
        this.sessionStorageKey,
        JSON.stringify(this.contracts),
      );
    } catch (error) {
      console.error("Error saving contracts to storage:", error);
    }
  }

  isValidContractAddress(address) {
    // Stellar contract addresses are 56 characters long and use base32 encoding
    return typeof address === "string" &&
      address.length === 56 &&
      /^[A-Z2-7]+$/.test(address);
  }

  addContract(address, name = "") {
    if (!address) {
      alert("Please enter a contract address");
      return;
    }

    if (!this.isValidContractAddress(address)) {
      alert(
        "Please enter a valid Stellar contract address (56 characters, A-Z and 2-7)",
      );
      return;
    }

    // Check if contract already exists
    if (this.contracts.find((contract) => contract.address === address)) {
      alert("This contract is already in the leaderboard");
      return;
    }

    // Use name if provided, otherwise use shortened address
    const contractName = name.trim() || this.shortenAddress(address);

    // Add new contract
    const newContract = {
      address: address,
      name: contractName,
      shortAddress: this.shortenAddress(address),
      status: {
        deployed: null,
        buildVerified: null,
        minted: null,
        soroswapPair: null,
        soroswapLiquidity: null,
        soroswapSwapped: null,
      },
      lastUpdated: null,
    };

    this.contracts.push(newContract);
    this.saveContractsToStorage();
    this.renderTable();

    // Start checking the contract status
    this.updateContractStatus(address);

    // Clear the inputs
    document.getElementById("contractAddress").value = "";
    document.getElementById("contractName").value = "";
  }

  removeContract(address) {
    this.contracts = this.contracts.filter((contract) =>
      contract.address !== address
    );
    this.saveContractsToStorage();
    this.renderTable();
  }

  shortenAddress(address) {
    return `${address.substring(0, 6)}...${
      address.substring(address.length - 6)
    }`;
  }

  async updateContractStatus(address) {
    const contract = this.contracts.find((c) => c.address === address);
    if (!contract) return;

    try {
      // Show loading state
      this.updateContractStatusInTable(address, "loading");

      // Get status from Stellar RPC
      const status = await this.stellarRPC.getFullContractStatus(address);

      // Update contract data
      contract.status = status;
      contract.lastUpdated = new Date().toISOString();

      // Save to storage
      this.saveContractsToStorage();

      // Update table
      this.updateContractStatusInTable(address, "success", status);
    } catch (error) {
      console.error(`Error updating status for contract ${address}:`, error);
      this.updateContractStatusInTable(address, "error");
    }
  }

  updateContractStatusInTable(address, state, status = null) {
    const metrics = [
        "deployed",
        "buildVerified",
        "minted",
        "soroswapPair",
        "soroswapLiquidity",
        "soroswapSwapped"
    ];

    metrics.forEach(metric => {
        const cell = document.querySelector(
            `.status-cell[data-contract="${address}"][data-metric="${metric}"]`
        );
        if (!cell) return;

        if (state === "loading") {
            if (!cell.innerHTML.includes("✅")) {
                cell.innerHTML = '<span class="status-loading">...</span>';
                cell.className = "status-cell status-loading";
            }
        } else if (state === "error") {
            cell.innerHTML = '<span class="status-error">❌</span>';
            cell.className = "status-cell status-error";
        } else if (state === "success" && status) {
            const isSuccess = status[metric];
            cell.innerHTML = isSuccess ? "✅" : "❌";
            cell.className = "status-cell";
        }
    });
}

renderTable() {
    const tbody = document.getElementById("leaderboardTable").querySelector("tbody");
    
    // Clear existing rows
    tbody.innerHTML = "";

    // Sort contracts by number of completed steps
    const sortedContracts = [...this.contracts].sort((a, b) => {
        const aComplete = Object.values(a.status || {}).filter(Boolean).length;
        const bComplete = Object.values(b.status || {}).filter(Boolean).length;
        return bComplete - aComplete; // Sort descending (most checkmarks first)
    });
    
    // Add a row for each contract
    sortedContracts.forEach(contract => {
        const row = document.createElement("tr");
        row.className = "contract-row";
        
        // Contract info cell
        const contractCell = document.createElement("td");
        contractCell.className = "contract-info";
        contractCell.innerHTML = `
            <div class="contract-name">${contract.name}</div>
            <div class="contract-address">${contract.address}</div>
            <button class="remove-contract" onclick="app.removeContract('${contract.address}')">Remove</button>
        `;
        row.appendChild(contractCell);
        
        // Status cells
        const metrics = [
            "deployed",
            "buildVerified",
            "minted",
            "soroswapPair",
            "soroswapLiquidity",
            "soroswapSwapped"
        ];
        
        metrics.forEach(metric => {
            const td = document.createElement("td");
            td.className = "status-cell";
            td.setAttribute("data-contract", contract.address);
            td.setAttribute("data-metric", metric);
            td.innerHTML = '<span class="status-loading">➖</span>';
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });

    // If we have contracts, start updating their status
    this.contracts.forEach(contract => {
        if (!contract.lastUpdated || this.isDataStale(contract.lastUpdated)) {
            this.updateContractStatus(contract.address);
        } else {
            // Use cached data
            this.updateContractStatusInTable(contract.address, "success", contract.status);
        }
    });
}

  isDataStale(lastUpdated) {
    const now = new Date();
    const updated = new Date(lastUpdated);
    const fiveMinutes = 5 * 1000; // 5 second in milliseconds

    return (now - updated) > fiveMinutes;
  }

  refreshAllContractData() {
        // Show loading indicator if you have one
        const loadingIndicator = document.getElementById("loadingIndicator");
        if (loadingIndicator) {
            loadingIndicator.style.display = "block";
        }

        // Update all contracts
        const promises = this.contracts.map(contract => 
            this.updateContractStatus(contract.address)
        );

        // Hide loading indicator when all updates are complete
        Promise.all(promises).finally(() => {
            if (loadingIndicator) {
                loadingIndicator.style.display = "none";
            }
            this.renderTable();
        });
    }
}

// Global functions for HTML event handlers
function addContract() {
  const addressInput = document.getElementById("contractAddress");
  const nameInput = document.getElementById("contractName");
  const address = addressInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();
  app.addContract(address, name);
}

function refreshAll() {
  if (app) {
    app.refreshAllContractData();
  }
}

// Make functions available globally
window.addContract = addContract;
window.refreshAll = refreshAll;

// Handle Enter key in the input fields
document.addEventListener("DOMContentLoaded", () => {
  const addressInput = document.getElementById("contractAddress");
  const nameInput = document.getElementById("contractName");
  
  const handleEnter = (e) => {
    if (e.key === "Enter") {
      addContract();
    }
  };
  
  addressInput.addEventListener("keypress", handleEnter);
  nameInput.addEventListener("keypress", handleEnter);
});

// Initialize the app when the page loads
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new LeaderboardApp();
  // Make app globally accessible for onclick handlers
  window.app = app;
});
