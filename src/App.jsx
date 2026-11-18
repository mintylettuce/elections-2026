import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpDown,
  Check,
  ChevronDown,
  ExternalLink,
  Info,
  Search,
  X,
} from "lucide-react";
import Papa from "papaparse";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CountyMap from "./components/CountyMap.jsx";

const partyColors = {
  DEM: "#5b9cff",
  REP: "#f16b73",
  OTHER: "#9ba9bc",
};

const numberFormat = new Intl.NumberFormat("en-US");
const percentFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatNumber(value) {
  return numberFormat.format(value || 0);
}

function formatPercent(value) {
  return `${percentFormat.format(value || 0)}%`;
}

function raceLabel(contestName) {
  const labels = {
    "US SENATE": "U.S. Senate",
    "NC SUPREME COURT ASSOCIATE JUSTICE SEAT 01":
      "N.C. Supreme Court · Associate Justice, Seat 1",
    "NC COURT OF APPEALS JUDGE SEAT 01":
      "N.C. Court of Appeals · Judge, Seat 1",
    "NC COURT OF APPEALS JUDGE SEAT 02":
      "N.C. Court of Appeals · Judge, Seat 2",
    "NC COURT OF APPEALS JUDGE SEAT 03":
      "N.C. Court of Appeals · Judge, Seat 3",
  };
  return labels[contestName] || contestName;
}

function partyLabel(party) {
  if (party === "DEM") return "Democratic";
  if (party === "REP") return "Republican";
  if (party === "TIE") return "Tie";
  return party || "Other";
}

function partyClass(party) {
  if (party === "DEM") return "dem";
  if (party === "REP") return "rep";
  return "other";
}

function marginBins(counties) {
  const bins = [
    { range: "Under 2%", min: 0, max: 2, count: 0 },
    { range: "2–5%", min: 2, max: 5, count: 0 },
    { range: "5–10%", min: 5, max: 10, count: 0 },
    { range: "10–20%", min: 10, max: 20, count: 0 },
    { range: "20%+", min: 20, max: Infinity, count: 0 },
  ];
  counties.forEach((county) => {
    const bin = bins.find(
      (item) =>
        county.marginPercent >= item.min &&
        (county.marginPercent < item.max || item.max === Infinity),
    );
    if (bin) bin.count += 1;
  });
  return bins;
}

function DataCard({ label, value, note, className = "" }) {
  return (
    <article className={`stat-card ${className}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{note}</span>
    </article>
  );
}

function SectionHeading({ eyebrow, title, note, id }) {
  return (
    <div className="section-heading" id={id}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {note && <p className="section-note">{note}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, valueName = "Votes" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((entry) => (
        <span key={entry.name || entry.dataKey}>
          <i style={{ background: entry.color || entry.payload?.fill }} />
          {entry.name || valueName}: {formatNumber(entry.value)}
        </span>
      ))}
    </div>
  );
}

function CountyDetails({ county, onClose }) {
  if (!county) return null;
  const partyBreakdown = [
    { label: "Democratic", votes: county.demVotes, color: partyColors.DEM },
    { label: "Republican", votes: county.repVotes, color: partyColors.REP },
    { label: "Other", votes: county.otherVotes, color: partyColors.OTHER },
  ];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="county-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="county-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close county details">
          <X size={19} />
        </button>
        <p className="eyebrow">County results</p>
        <h2 id="county-dialog-title">{county.name} County</h2>
        <p className="dialog-subtitle">
          {county.winner
            ? `${county.winner} leads by ${formatNumber(county.marginVotes)} votes`
            : "The leading candidates are tied"}
        </p>
        <div className={`winner-banner ${partyClass(county.winnerParty)}`}>
          <span>Leading party</span>
          <strong>{partyLabel(county.winnerParty)}</strong>
          <span>{formatPercent(county.marginPercent)} margin</span>
        </div>
        <div className="dialog-kpis">
          <div><span>Total votes</span><strong>{formatNumber(county.totalVotes)}</strong></div>
          <div><span>2024 population estimate</span><strong>{formatNumber(county.population)}</strong></div>
          <div><span>Registered-voter turnout</span><strong>Not available</strong></div>
        </div>
        <div className="candidate-list">
          <h3>Candidate results</h3>
          {county.candidates.map((candidate) => (
            <div className="candidate-row" key={`${candidate.name}-${candidate.party}`}>
              <span className="candidate-party-dot" style={{ background: partyColors[candidate.party] || partyColors.OTHER }} />
              <span className="candidate-name">
                <strong>{candidate.name}</strong>
                <small>{partyLabel(candidate.party)}</small>
              </span>
              <span className="candidate-count">{formatNumber(candidate.votes)}</span>
              <span className="candidate-share">
                {formatPercent((candidate.votes / county.totalVotes) * 100)}
              </span>
            </div>
          ))}
        </div>
        <div className="party-breakdown">
          {partyBreakdown.map((party) => (
            <div key={party.label}>
              <span><i style={{ background: party.color }} />{party.label}</span>
              <strong>{formatNumber(party.votes)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CountyComparison({ counties }) {
  const [leftName, setLeftName] = useState("Wake");
  const [rightName, setRightName] = useState("Mecklenburg");
  const left = counties.find((county) => county.name === leftName) || counties[0];
  const right =
    counties.find((county) => county.name === rightName) ||
    counties.find((county) => county.name !== left?.name) ||
    counties[1];

  if (!left || !right) return null;

  const metrics = [
    { name: "Total votes", key: "totalVotes" },
    { name: "Democratic votes", key: "demVotes" },
    { name: "Republican votes", key: "repVotes" },
    { name: "Other votes", key: "otherVotes" },
    { name: "Population · 2024", key: "population" },
  ];

  return (
    <div className="comparison-card">
      <div className="comparison-selectors">
        <label>
          County one
          <span className="select-wrap">
            <select value={left.name} onChange={(event) => setLeftName(event.target.value)}>
              {counties.map((county) => <option key={county.name}>{county.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>
        <span className="versus">VS</span>
        <label>
          County two
          <span className="select-wrap">
            <select value={right.name} onChange={(event) => setRightName(event.target.value)}>
              {counties.map((county) => <option key={county.name}>{county.name}</option>)}
            </select>
            <ChevronDown size={16} />
          </span>
        </label>
      </div>
      <div className="comparison-table">
        {metrics.map((metric) => (
          <div className="comparison-row" key={metric.key}>
            <strong>{metric.name}</strong>
            <span>{formatNumber(left[metric.key])}</span>
            <span>{formatNumber(right[metric.key])}</span>
          </div>
        ))}
        <div className="comparison-row">
          <strong>Leading party</strong>
          <span className={`party-text ${partyClass(left.winnerParty)}`}>{partyLabel(left.winnerParty)}</span>
          <span className={`party-text ${partyClass(right.winnerParty)}`}>{partyLabel(right.winnerParty)}</span>
        </div>
        <div className="comparison-row">
          <strong>Victory margin</strong>
          <span>{formatNumber(left.marginVotes)} · {formatPercent(left.marginPercent)}</span>
          <span>{formatNumber(right.marginVotes)} · {formatPercent(right.marginPercent)}</span>
        </div>
      </div>
      <p className="micro-note">Population is a Census estimate, not a voter-turnout denominator.</p>
    </div>
  );
}

export default function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [geojson, setGeojson] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [selectedCounty, setSelectedCounty] = useState(null);
  const [search, setSearch] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("ALL");
  const [minimumPopulation, setMinimumPopulation] = useState("");
  const [sort, setSort] = useState({ key: "totalVotes", direction: "desc" });

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/election-results.json`).then((response) => {
        if (!response.ok) throw new Error("Election results could not be loaded.");
        return response.json();
      }),
      fetch(`${import.meta.env.BASE_URL}data/nc-counties.geojson`).then((response) => {
        if (!response.ok) throw new Error("County boundaries could not be loaded.");
        return response.json();
      }),
    ])
      .then(([results, boundaries]) => {
        if (!active) return;
        setDashboardData(results);
        setGeojson(boundaries);
        setSelectedRaceId(results.races.find((race) => race.contestName === "US SENATE")?.id || results.races[0]?.id);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      });
    return () => { active = false; };
  }, []);

  const races = dashboardData?.races || [];
  const race = races.find((item) => item.id === selectedRaceId) || races[0];
  const counties = race?.counties || [];
  const totalVotes = race?.totalVotes || 0;
  const democraticShare = totalVotes ? (race.demVotes / totalVotes) * 100 : 0;
  const republicanShare = totalVotes ? (race.repVotes / totalVotes) * 100 : 0;
  const democraticWins = counties.filter((county) => county.winnerParty === "DEM").length;
  const republicanWins = counties.filter((county) => county.winnerParty === "REP").length;
  const otherWins = counties.filter(
    (county) => county.winnerParty !== "DEM" && county.winnerParty !== "REP" && county.winnerParty !== "TIE",
  ).length;
  const candidates = race?.candidates || [];
  const partyShareData = [
    { name: "Democratic", value: race?.demVotes || 0, color: partyColors.DEM },
    { name: "Republican", value: race?.repVotes || 0, color: partyColors.REP },
    { name: "Other", value: race?.otherVotes || 0, color: partyColors.OTHER },
  ].filter((entry) => entry.value > 0);
  const marginData = marginBins(counties);
  const topCounties = [...counties].sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 10);
  const lastUpdated = dashboardData?.resultsLastModified
    ? new Date(dashboardData.resultsLastModified).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : "Not provided";
  const retrievedDate = dashboardData?.retrievedAt
    ? new Date(dashboardData.retrievedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : "Not provided";

  const filteredCounties = useMemo(() => {
    const minimum = Number(minimumPopulation) || 0;
    return counties
      .filter((county) => county.name.toLowerCase().includes(search.trim().toLowerCase()))
      .filter((county) => minimum === 0 || county.population >= minimum)
      .filter((county) => {
        if (winnerFilter === "ALL") return true;
        if (winnerFilter === "OTHER") return !["DEM", "REP", "TIE"].includes(county.winnerParty);
        return county.winnerParty === winnerFilter;
      })
      .sort((a, b) => {
        const left = a[sort.key] ?? "";
        const right = b[sort.key] ?? "";
        const order = typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
        return sort.direction === "asc" ? order : -order;
      });
  }, [counties, minimumPopulation, search, sort, winnerFilter]);

  const changeSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const downloadCsv = () => {
    const csv = Papa.unparse(
      filteredCounties.map((county) => ({
        County: county.name,
        "Democratic candidate votes": county.demVotes,
        "Republican candidate votes": county.repVotes,
        "Other candidate votes": county.otherVotes,
        "Total candidate votes": county.totalVotes,
        "Leading candidate": county.winner || "Tie",
        "Leading party": partyLabel(county.winnerParty),
        "Victory margin votes": county.marginVotes,
        "Victory margin percent": county.marginPercent,
        "Population estimate (2024)": county.population,
        "Voter turnout percent": "",
      })),
      { columns: [
        "County", "Democratic candidate votes", "Republican candidate votes",
        "Other candidate votes", "Total candidate votes", "Leading candidate",
        "Leading party", "Victory margin votes", "Victory margin percent",
        "Population estimate (2024)", "Voter turnout percent",
      ] },
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nc-2026-${race.id}-county-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loadError) {
    return (
      <main className="load-state">
        <div className="load-card error-card">
          <Info size={22} />
          <h1>Dashboard data could not be loaded</h1>
          <p>{loadError} Please refresh the page or check the published data files.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }
  if (!dashboardData || !geojson || !race) {
    return (
      <main className="load-state">
        <div className="load-card">
          <span className="loading-spinner" />
          <h1>Loading North Carolina results</h1>
          <p>Preparing county boundaries and official results data…</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <header className="site-header">
        <div className="topline">
          <a className="brand" href="#overview" aria-label="North Carolina Election Dashboard home">
            <span className="brand-mark">NC</span>
            <span>THE ELECTION DESK <small>DATA + RESULTS</small></span>
          </a>
          <div className="header-status">
            <span className="status-dot" />
            <span>2026 GENERAL ELECTION</span>
            <i />
            <span>UNOFFICIAL RESULTS</span>
          </div>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#overview">Overview</a>
          <a href="#map">Election map</a>
          <a href="#counties">County results</a>
          <a href="#turnout">Voter turnout</a>
          <a href="#analysis">Analysis</a>
        </nav>
      </header>

      <main>
        <section className="hero page-shell" id="overview">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> NORTH CAROLINA · NOVEMBER 3, 2026</p>
            <h1>North Carolina<br /><span>Election 2026</span></h1>
            <p className="hero-subtitle">Explore the Results of the November 2026 General Election.</p>
            <div className="hero-footnote">
              <span><span className="live-dot" /> UNOFFICIAL RESULTS</span>
              <i />
              <span>Source file updated {lastUpdated}</span>
            </div>
          </div>
          <div className="hero-side">
            <div className="race-control">
              <label htmlFor="race-select">SELECT A RACE</label>
              <div className="select-wrap">
                <select
                  id="race-select"
                  value={race.id}
                  onChange={(event) => setSelectedRaceId(event.target.value)}
                >
                  {races.map((item) => (
                    <option key={item.id} value={item.id}>{raceLabel(item.contestName)}</option>
                  ))}
                </select>
                <ChevronDown size={17} />
              </div>
            </div>
            <div className="race-card">
              <span className="race-card-label">CURRENTLY VIEWING</span>
              <strong>{raceLabel(race.contestName)}</strong>
              <span className="race-card-divider" />
              <span className="race-winner-label">STATEWIDE LEADER</span>
              <strong className={`race-leader ${partyClass(candidates[0]?.party)}`}>
                {candidates[0]?.name}
              </strong>
              <span className="race-card-caption">
                {formatNumber(candidates[0]?.votes)} votes · {partyLabel(candidates[0]?.party)}
              </span>
              <span className="race-card-source">Reported in N.C. State Board of Elections results file</span>
            </div>
          </div>
        </section>

        <section className="page-shell results-section" aria-label="Election overview statistics">
          <div className="data-status">
            <div><span className="data-status-dot" />RESULTS SNAPSHOT <b>·</b> {retrievedDate}</div>
            <span>Certification status is not identified in the downloadable source file.</span>
          </div>
          <div className="stat-grid">
            <DataCard label="Votes in selected race" value={formatNumber(totalVotes)} note={raceLabel(race.contestName)} />
            <DataCard label="Statewide turnout" value="N/A" note="No reliable 2026 denominator" className="stat-muted" />
            <DataCard label="Democratic vote" value={formatPercent(democraticShare)} note={`${formatNumber(race.demVotes)} candidate votes`} className="stat-blue" />
            <DataCard label="Republican vote" value={formatPercent(republicanShare)} note={`${formatNumber(race.repVotes)} candidate votes`} className="stat-red" />
            <DataCard label="Counties won · DEM" value={democraticWins} note="Based on leading candidate" className="stat-blue" />
            <DataCard label="Counties won · REP" value={republicanWins} note={otherWins ? `${otherWins} other-party lead${otherWins === 1 ? "" : "s"}` : "Based on leading candidate"} className="stat-red" />
          </div>
          <p className="stat-footnote">
            Vote shares use total candidate votes in the selected single-choice race. They are not voter-turnout rates.
          </p>
        </section>

        <section className="page-shell visualization-section">
          <SectionHeading
            eyebrow="STATEWIDE SNAPSHOT"
            title="The race at a glance"
            note={`Candidate totals and party shares · ${raceLabel(race.contestName)}`}
          />
          <div className="chart-grid overview-charts">
            <article className="panel candidate-panel">
              <div className="panel-heading">
                <div><h3>Candidate vote totals</h3><p>Statewide votes by candidate</p></div>
                <span className="panel-kicker">ALL COUNTIES</span>
              </div>
              <div className="candidate-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candidates} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#243449" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={145}
                      tick={{ fill: "#bbc7d7", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                    <Bar dataKey="votes" name="Votes" radius={[0, 5, 5, 0]} maxBarSize={24}>
                      {candidates.map((candidate) => (
                        <Cell key={candidate.name} fill={partyColors[candidate.party] || partyColors.OTHER} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend">
                <span><i className="dot-blue" /> Democratic</span>
                <span><i className="dot-red" /> Republican</span>
                <span><i className="dot-gray" /> Other</span>
              </div>
            </article>
            <article className="panel share-panel">
              <div className="panel-heading">
                <div><h3>Statewide vote share</h3><p>Share of all candidate votes</p></div>
                <span className="panel-kicker">2026</span>
              </div>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={partyShareData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="68%"
                      outerRadius="91%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {partyShareData.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueName="Votes" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{formatPercent(democraticShare)}</strong>
                  <span>DEM SHARE</span>
                </div>
              </div>
              <div className="share-legend">
                {partyShareData.map((item) => (
                  <div key={item.name}>
                    <span><i style={{ background: item.color }} />{item.name}</span>
                    <strong>{formatPercent((item.value / totalVotes) * 100)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="map-section" id="map">
          <div className="page-shell">
            <SectionHeading
              eyebrow="100 COUNTIES · ONE STATE"
              title="Where North Carolina stands"
              note="Select a county for a closer look. Shading reflects the winner’s margin."
            />
            <div className="map-layout">
              <div className="panel map-panel">
                <div className="map-topline">
                  <span><span className="data-status-dot" /> COUNTY RESULTS</span>
                  <span>{raceLabel(race.contestName)}</span>
                </div>
                <CountyMap
                  geojson={geojson}
                  counties={counties}
                  raceId={race.id}
                  onSelectCounty={setSelectedCounty}
                />
                <div className="map-attribution">County boundaries: U.S. Census Bureau TIGERweb</div>
              </div>
              <aside className="map-aside">
                <div className="panel map-summary">
                  <p className="eyebrow">COUNTY LEADERS</p>
                  <h3>County wins</h3>
                  <div className="county-win-line">
                    <span><i className="dot-blue" />Democratic</span><strong>{democraticWins}</strong>
                  </div>
                  <div className="county-win-line">
                    <span><i className="dot-red" />Republican</span><strong>{republicanWins}</strong>
                  </div>
                  <div className="county-win-line">
                    <span><i className="dot-gray" />Other / tied</span><strong>{otherWins + counties.filter((county) => county.winnerParty === "TIE").length}</strong>
                  </div>
                  <div className="county-win-total"><span>Counties reporting</span><strong>{counties.length} / 100</strong></div>
                </div>
                <div className="panel map-legend">
                  <p className="eyebrow">MAP KEY</p>
                  <h3>Margin of victory</h3>
                  <div className="legend-party">
                    <span><i className="dot-blue" />Democratic lead</span>
                    <div className="swatch-row">
                      <i className="swatch dem-1" /><i className="swatch dem-2" /><i className="swatch dem-3" /><i className="swatch dem-4" />
                    </div>
                  </div>
                  <div className="legend-party">
                    <span><i className="dot-red" />Republican lead</span>
                    <div className="swatch-row">
                      <i className="swatch rep-1" /><i className="swatch rep-2" /><i className="swatch rep-3" /><i className="swatch rep-4" />
                    </div>
                  </div>
                  <div className="map-key-note"><i className="swatch neutral-swatch" />Other winner, tie, or unavailable</div>
                  <p className="micro-note">Darker shades indicate wider candidate margins. Hover or tap for county totals.</p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="page-shell county-section" id="counties">
          <SectionHeading
            eyebrow="COUNTY-BY-COUNTY"
            title="Explore county results"
            note="Search, filter, sort, and export the counties shown for this race."
          />
          <div className="panel county-panel">
            <div className="table-toolbar">
              <label className="search-field">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Search counties"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="filter-field">
                <span>Leading party</span>
                <span className="select-wrap">
                  <select value={winnerFilter} onChange={(event) => setWinnerFilter(event.target.value)}>
                    <option value="ALL">All parties</option>
                    <option value="DEM">Democratic</option>
                    <option value="REP">Republican</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <ChevronDown size={15} />
                </span>
              </label>
              <label className="filter-field population-filter">
                <span>Min. population</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Any"
                  value={minimumPopulation}
                  onChange={(event) => setMinimumPopulation(event.target.value)}
                />
              </label>
              <button className="button button-secondary export-button" onClick={downloadCsv}>
                <ArrowDownToLine size={16} /> Download CSV
              </button>
            </div>
            <div className="table-meta">
              <span><strong>{filteredCounties.length}</strong> counties shown</span>
              <span>Population filter: 2024 U.S. Census county estimates</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      ["name", "County"],
                      ["demVotes", "Democratic"],
                      ["repVotes", "Republican"],
                      ["otherVotes", "Other"],
                      ["totalVotes", "Total votes"],
                      ["winnerParty", "Leading party"],
                      ["marginVotes", "Margin"],
                      ["population", "Population"],
                    ].map(([key, title]) => (
                      <th key={key} aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="sort-button" onClick={() => changeSort(key)}>
                          {title}<ArrowUpDown size={12} />
                        </button>
                      </th>
                    ))}
                    <th>Turnout</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCounties.length ? filteredCounties.map((county) => (
                    <tr key={county.name} onClick={() => setSelectedCounty(county)} tabIndex={0}
                      onKeyDown={(event) => event.key === "Enter" && setSelectedCounty(county)}>
                      <td className="county-name-cell">{county.name}</td>
                      <td className="vote-cell dem-cell">{formatNumber(county.demVotes)}</td>
                      <td className="vote-cell rep-cell">{formatNumber(county.repVotes)}</td>
                      <td className="vote-cell">{formatNumber(county.otherVotes)}</td>
                      <td className="vote-cell total-cell">{formatNumber(county.totalVotes)}</td>
                      <td><span className={`party-pill ${partyClass(county.winnerParty)}`}>{partyLabel(county.winnerParty)}</span></td>
                      <td className="vote-cell">{formatNumber(county.marginVotes)} <small>({formatPercent(county.marginPercent)})</small></td>
                      <td className="vote-cell">{formatNumber(county.population)}</td>
                      <td className="unavailable-cell">—</td>
                    </tr>
                  )) : (
                    <tr><td className="empty-row" colSpan="9">No counties match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span><Info size={14} /> Turnout is not calculated without a verified eligible- or registered-voter denominator.</span>
              <span>Click a county row to view candidate details.</span>
            </div>
          </div>
        </section>

        <section className="turnout-section" id="turnout">
          <div className="page-shell">
            <SectionHeading
              eyebrow="PARTICIPATION"
              title="Voter turnout"
              note="Turnout is only calculated when the correct voter denominator is available."
            />
            <div className="turnout-grid">
              <div className="panel turnout-note">
                <div className="unavailable-icon"><Info size={18} /></div>
                <p className="eyebrow">DENOMINATOR CHECK</p>
                <h3>Turnout is not available yet</h3>
                <p>
                  The 2026 election-results file reports candidate votes, not the number of eligible or registered voters in each county. We do not calculate turnout from candidate votes or total population.
                </p>
                <div className="turnout-method">
                  <Check size={16} />
                  <span>2024 Census population is shown only as context—not as an electorate denominator.</span>
                </div>
                <a className="text-link" href={dashboardData.sources.results} target="_blank" rel="noreferrer">
                  Review official results source <ExternalLink size={14} />
                </a>
              </div>
              <div className="panel turnout-chart-panel">
                <div className="panel-heading">
                  <div><h3>Turnout vs. Democratic vote share</h3><p>County-level relationship</p></div>
                  <span className="panel-kicker">SCATTERPLOT</span>
                </div>
                <div className="empty-chart">
                  <div className="empty-chart-grid" />
                  <span className="empty-chart-label x-label">County turnout →</span>
                  <span className="empty-chart-label y-label">DEM share ↑</span>
                  <div className="empty-chart-message">
                    <span className="empty-chart-mark">···</span>
                    <strong>Waiting for a reliable denominator</strong>
                    <span>No points plotted to avoid implying unavailable turnout data.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-shell analysis-section" id="analysis">
          <SectionHeading
            eyebrow="DEEPER LOOK"
            title="Compare and analyze"
            note="County comparisons and vote margins update with the selected race."
          />
          <div className="analysis-grid">
            <article className="panel analysis-chart-panel">
              <div className="panel-heading">
                <div><h3>Largest county vote totals</h3><p>Ranked by total candidate votes—not turnout percentage</p></div>
                <span className="panel-kicker">TOP 10</span>
              </div>
              <div className="rank-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCounties} layout="vertical" margin={{ top: 5, right: 18, bottom: 5, left: 8 }}>
                    <CartesianGrid horizontal={false} stroke="#243449" />
                    <XAxis type="number" tick={{ fill: "#8999ad", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fill: "#bbc7d7", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                    <Bar dataKey="totalVotes" name="Candidate votes" radius={[0, 4, 4, 0]} maxBarSize={17}>
                      {topCounties.map((county) => (
                        <Cell key={county.name} fill={partyColors[county.winnerParty] || partyColors.OTHER} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-caption">Vote volume can reflect county size; it is not a turnout rate.</p>
            </article>
            <article className="panel analysis-chart-panel">
              <div className="panel-heading">
                <div><h3>County victory margins</h3><p>Counties grouped by candidate vote-share margin</p></div>
                <span className="panel-kicker">100 COUNTIES</span>
              </div>
              <div className="margin-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marginData} margin={{ top: 16, right: 15, bottom: 2, left: -18 }}>
                    <CartesianGrid vertical={false} stroke="#243449" />
                    <XAxis dataKey="range" tick={{ fill: "#9ba9bc", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#8999ad", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip valueName="Counties" />} />
                    <Bar dataKey="count" name="Counties" fill="#7892b7" radius={[4, 4, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-caption">Margin = top candidate’s votes minus runner-up votes, as a share of county candidate votes.</p>
            </article>
          </div>
          <div className="comparison-section">
            <div className="comparison-heading">
              <div><p className="eyebrow">SIDE-BY-SIDE</p><h3>Compare two counties</h3></div>
              <span className="panel-kicker">RACE-AWARE COMPARISON</span>
            </div>
            <CountyComparison counties={counties} />
          </div>
        </section>

        <section className="method-section">
          <div className="page-shell">
            <SectionHeading
              eyebrow="TRANSPARENCY"
              title="Sources & methodology"
              note={`Data snapshot retrieved ${retrievedDate}. The results archive was last modified ${lastUpdated}.`}
            />
            <div className="method-grid">
              <article className="panel method-card">
                <span className="method-index">01</span>
                <h3>Election results</h3>
                <p>County candidate totals are summed from precinct-level rows in the State Board of Elections’ Nov. 3, 2026 results download.</p>
                <a href={dashboardData.sources.resultsFile} target="_blank" rel="noreferrer">Download results ZIP <ExternalLink size={14} /></a>
                <a href={dashboardData.sources.results} target="_blank" rel="noreferrer">N.C. State Board of Elections <ExternalLink size={14} /></a>
              </article>
              <article className="panel method-card">
                <span className="method-index">02</span>
                <h3>Boundaries & population</h3>
                <p>County shapes use TIGERweb. Population context uses the Census Bureau’s 2024 county population estimates.</p>
                <a href="https://tigerweb.geo.census.gov/" target="_blank" rel="noreferrer">Census TIGERweb <ExternalLink size={14} /></a>
                <a href={dashboardData.sources.populationFile} target="_blank" rel="noreferrer">2024 county estimates <ExternalLink size={14} /></a>
              </article>
              <article className="panel method-card method-caveat">
                <span className="method-index">03</span>
                <h3>Certification & turnout</h3>
                <p>{dashboardData.certificationNote} No certified result is claimed here. Turnout remains blank until a reliable eligible- or registered-voter denominator is available.</p>
                <a href="https://www.ncsbe.gov/results-data/voter-turnout" target="_blank" rel="noreferrer">N.C. voter-turnout data <ExternalLink size={14} /></a>
              </article>
            </div>
            <p className="method-footnote">
              Party vote share is candidate votes for that party divided by all candidate votes in the selected single-choice race. County margin is the difference between the top two candidates. 2024 resident population is not used to calculate turnout.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <a className="brand footer-brand" href="#overview">
            <span className="brand-mark">NC</span>
            <span>THE ELECTION DESK <small>DATA + RESULTS</small></span>
          </a>
          <p>Independent visualization · Public data, clearly labeled.</p>
          <a href="#overview">Back to top ↑</a>
        </div>
      </footer>

      <CountyDetails county={selectedCounty} onClose={() => setSelectedCounty(null)} />
    </>
  );
}
