# Stellar Contract Leaderboard

A minimal static website that tracks the status of Stellar smart contracts using HTMX, CSS, and vanilla JavaScript.

## Features

- **Contract Address Input**: Add Stellar contract addresses to track their status
- **Session Storage**: Contracts persist across browser sessions
- **Real-time Status Tracking**: Monitor five key metrics for each contract:
  - **Deployed**: Checks if the contract instance exists on the Stellar network
  - **Build Verified**: Verifies contract build according to SEP contract build info specification
  - **Minted**: Monitors for mint events in the last couple of days
  - **Soroswap Pair with XLM Setup**: Checks if a Soroswap trading pair exists with XLM
  - **Soroswap Swapped**: Monitors for swap events involving the contract
- **Visual Status Indicators**: Uses emoji status indicators (✅ ❌ ⏳ ➖)
- **Responsive Design**: Works on desktop and mobile devices

## Usage

1. Open `index.html` in a web browser
2. Enter a Stellar contract address (56 characters, uppercase, A-Z and 2-7)
3. Click "Add Contract" to add it to the leaderboard
4. The system will automatically check the contract status using Stellar RPC
5. Status updates automatically every 30 seconds

## Example Contract Addresses

You can test with these sample addresses:
- `CBVFAI4TEJCHIICFUYN2C5VYW5TD3CKPIZ4S5P5LVVUWMF5MRLJH77NH` (Soroswap Factory)
- `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENOWID` (Native XLM)

## Technical Implementation

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, HTMX
- **Styling**: Responsive design with gradient background and clean table layout
- **Storage**: Browser sessionStorage for contract persistence
- **API**: Stellar RPC client for blockchain interactions
- **Error Handling**: Graceful fallbacks for network issues

## Files

- `index.html` - Main application interface
- `styles.css` - Responsive styling and layout
- `app.js` - Application logic and UI management
- `stellar-rpc.js` - Stellar network interaction client

## Development

To run locally:
```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

## License

Apache License 2.0