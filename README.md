# Token Radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Tommmy23/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Tommmy23/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An empirical token launch valuation radar for pre-token DeFi protocols, built for make.fun's [Build the best token launch radar](https://make.fun/bounty/token-radar-01) bounty ($1,325 in USDC).

## Features

- **Empirical Valuation Model**: Dynamically derives sector-level Mcap/TVL multiples from live DefiLlama protocol benchmarks to project realistic FDVs.
- **Actionable Farm Plans**: Generates concrete, chain-specific deployment steps with accurate network fee estimates and holding retention requirements.
- **FinTech Terminal Dashboard**: Clean, responsive dark-theme dashboard operating 100% offline with zero external dependencies.

## How to Run

```bash
# Run with Node.js 22+
node main.ts --input /path/to/snapshot.json --output ./out
```

## License

[MIT](LICENSE)
