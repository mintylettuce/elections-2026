import { GeoJSON, MapContainer, ZoomControl } from "react-leaflet";

const colors = {
  DEM: ["#193f75", "#2358a1", "#3474ce", "#5794ed"],
  REP: ["#762a39", "#a43749", "#d34b5b", "#ee7077"],
  neutral: "#475569",
};

function countyFill(county) {
  if (!county || !county.winnerParty || county.winnerParty === "TIE") {
    return colors.neutral;
  }
  const shades = colors[county.winnerParty] || [];
  if (!shades.length) return colors.neutral;
  const margin = county.marginPercent || 0;
  const index = margin < 2 ? 0 : margin < 5 ? 1 : margin < 10 ? 2 : 3;
  return shades[index];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function countyTooltip(county) {
  const title = escapeHtml(county?.name || "County results unavailable");
  if (!county) return `<strong>${title}</strong><br />No results available`;

  const winner = county.winner
    ? `${escapeHtml(county.winner)} (${escapeHtml(county.winnerParty)})`
    : "Tie";
  const candidates = county.candidates
    .map((candidate) => {
      const share = (candidate.votes / county.totalVotes) * 100;
      return `${escapeHtml(candidate.name)} (${escapeHtml(candidate.party)}): ${candidate.votes.toLocaleString()} · ${share.toFixed(1)}%`;
    })
    .join("<br />");
  return [
    `<strong>${title}</strong>`,
    `Winner: ${winner}`,
    candidates,
    `Total candidate votes: ${county.totalVotes.toLocaleString()}`,
    `Margin: ${county.marginVotes.toLocaleString()} votes (${county.marginPercent.toFixed(1)}%)`,
  ].join("<br />");
}

export default function CountyMap({ geojson, counties, raceId, onSelectCounty }) {
  const resultsByName = new Map(counties.map((county) => [county.name, county]));

  return (
    <MapContainer
      center={[35.55, -79.45]}
      zoom={6.6}
      minZoom={5.5}
      maxZoom={9}
      zoomControl={false}
      scrollWheelZoom={false}
      className="county-map"
      aria-label="Interactive map of North Carolina county election results"
    >
      <ZoomControl position="topright" />
      <GeoJSON
        key={raceId}
        data={geojson}
        style={(feature) => {
          const countyName = feature.properties.NAME.replace(/ County$/, "");
          const result = resultsByName.get(countyName);
          return {
            fillColor: countyFill(result),
            fillOpacity: 0.92,
            color: "#0a1422",
            weight: 1.15,
            opacity: 1,
          };
        }}
        onEachFeature={(feature, layer) => {
          const countyName = feature.properties.NAME.replace(/ County$/, "");
          const result = resultsByName.get(countyName);
          layer.bindTooltip(countyTooltip(result), {
            sticky: true,
            direction: "top",
            className: "county-tooltip",
          });
          layer.on("click", () => result && onSelectCounty(result));
          layer.on("mouseover", () => {
            layer.setStyle({ color: "#f8fafc", weight: 2, fillOpacity: 1 });
          });
          layer.on("mouseout", () => {
            layer.setStyle({
              fillColor: countyFill(result),
              fillOpacity: 0.92,
              color: "#0a1422",
              weight: 1.15,
              opacity: 1,
            });
          });
        }}
      />
    </MapContainer>
  );
}
