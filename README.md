# North Carolina Election 2026

An interactive React dashboard for the November 3, 2026 North Carolina general election. County results are built from the North Carolina State Board of Elections' public precinct results file. Figures are labeled unofficial because the downloadable file does not identify certification status.

## Run locally

Requires Node.js 20+ and Python 3 for refreshing the data.

```bash
npm install
npm run dev
```

Vite prints a local URL when the development server is ready. To create and preview a production build:

```bash
npm run build
npm run preview
```

## Data and methodology

The checked-in files under `public/data/` are a compact snapshot used by the dashboard:

- **Election results:** the State Board of Elections' November 3, 2026 results ZIP. The refresh script sums precinct-level candidate votes by county for statewide, single-choice partisan contests.
- **County boundaries:** U.S. Census Bureau TIGERweb county GeoJSON.
- **Population:** Census Bureau 2024 county population estimates. Population is context only; it is not used as a voter-turnout denominator.

The dashboard derives party vote share from candidate votes in the selected race and county margin from the top two candidates' vote totals. The election file does not provide verified county eligible- or registered-voter denominators, so turnout and turnout comparisons are intentionally left unavailable.

The results archive has no certification field. The dashboard identifies its results as unofficial and does not claim that they are certified. The source-file modification date and the local snapshot retrieval date are shown in the interface.

### Sources

- [N.C. State Board of Elections: election results](https://www.ncsbe.gov/results-data/election-results)
- [2026 results ZIP](https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2026_11_03/results_pct_20261103.zip)
- [N.C. State Board of Elections: voter turnout](https://www.ncsbe.gov/results-data/voter-turnout)
- [U.S. Census Bureau: TIGERweb](https://tigerweb.geo.census.gov/)
- [2024 county population estimates](https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv)

Refresh the public data snapshot with Python 3 and the standard library:

```bash
npm run update-data
```

The script downloads the official results ZIP, Census county estimates, and Census county boundaries, then regenerates the JSON files in `public/data/`. It checks that it has all 100 counties before writing the dashboard data.

## GitHub Pages

The repository includes a GitHub Actions workflow that builds and publishes the Vite site when changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The Vite base path is configured for this repository at `/elections-2026/`; update `base` in `vite.config.js` if deploying under a different repository path.
