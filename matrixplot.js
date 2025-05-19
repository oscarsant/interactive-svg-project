import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function render({ data, mapping, visualOptions, width, height, element, maxWidth }) {
  const margin = { top: 40, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Remove any previous SVG
  d3.select(element).selectAll("svg").remove();

  // Responsive SVG: use viewBox and width: 100%
  const svg = d3.select(element)
    .append("svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    // .style("width", "100%")
    // .style("height", "auto")
    // .style("max-width", maxWidth ? `${maxWidth}px` : "600px")
    .style("border", "1px solid #ccc");

  const chart = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Force competitions order: UCL left, UEL right
  const competitions = ["UCL", "UEL"].filter(c => data.some(d => d.competition === c));
  const years = Array.from(new Set(data.map(d => d[mapping.rows.value])))
    .map(String)
    .sort();

  // For each year, show UCL and UEL stacked vertically in a single column
  let cells = [];
  years.forEach((year, yearIdx) => {
    competitions.forEach((comp, compIdx) => {
      // Winner
      const winner = data.find(d => d.competition === comp && String(d[mapping.rows.value]) === year && d.value === 2);
      if (winner) {
        cells.push({
          competition: comp,
          year,
          value: 2,
          team: winner[mapping.columns.value],
          country: winner.country,
          compIdx,
          yearIdx,
          row: 0, // winner row (top)
          col: compIdx // column for this competition
        });
      }
      // Runner-up
      const runnerUp = data.find(d => d.competition === comp && String(d[mapping.rows.value]) === year && d.value === 1);
      if (runnerUp) {
        cells.push({
          competition: comp,
          year,
          value: 1,
          team: runnerUp[mapping.columns.value],
          country: runnerUp.country,
          compIdx,
          yearIdx,
          row: 1, // runner-up row (bottom)
          col: compIdx // column for this competition
        });
      }
    });
  });

  // Layout: x = competitions, y = years, stack winner/runner-up vertically in each cell
  const cellWidth = 150;
  const cellHeight = 100;
  const cellPadding = 20;
  const gapBetween = 4; // or any value you like

  // Color scale for country
  const countries = Array.from(new Set(data.map(d => d.country))).sort();
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(countries);

  // Country color map for rectangles
  const countryColors = {
    spain:   "#8E0A27",
    italy:   "#2C5DA1",
    england: "#ABB0B5",
    france:  "#0B3767",
    germany: "#9F8137",
    default: "hwb(215 5% 90% / .9)"
  };

  // Country color map for text (customize as you wish)
  const countryTextColors = {
    spain:   "#9F8137",
    italy:   "#9FA3A8",
    england: "#932027",
    france:  "#9F8137",
    germany: "#060A0F",
    default: "#54514F"
  };

  // Helper to get color by country for rectangles
  function getCountryColor(country) {
    return countryColors[country?.toLowerCase()] || countryColors.default;
  }

  // Helper to get color by country for text
  function getCountryTextColor(country) {
    return countryTextColors[country?.toLowerCase()] || countryTextColors.default;
  }

  // Helper to get x position: one column per competition
  function getX(compIdx) {
    return compIdx * (cellWidth + cellPadding);
  }

  // Helper to get y position for each cell (winner on top, runner-up on bottom)
  function getCellY(yearIdx, row) {
    // winner (row 0): top half, runner-up (row 1): bottom half
    return yearIdx * (cellHeight + cellPadding) + row * (cellHeight / 2) + (row === 1 ? gapBetween : 0);
  }

  // Draw rectangles (winner on top, runner-up on bottom in one column)
  chart.selectAll("rect")
    .data(cells)
    .enter()
    .append("rect")
    .attr("x", d => getX(d.col))
    .attr("y", d => getCellY(d.yearIdx, d.row))
    .attr("width", cellWidth)
    .attr("height", cellHeight / 2)
    .attr("rx", 8)
    .attr("ry", 8)
    .attr("fill", d => getCountryColor(d.country));

  // Map country names to acronyms
  const countryAcronyms = {
    spain: "ESP",
    italy: "ITA",
    england: "ENG",
    france: "FRA",
    germany: "GER"
  };

  // Helper to get acronym or fallback to country name in all caps
  function getCountryAcronym(country) {
    if (!country) return "";
    const key = country.toLowerCase();
    if (countryAcronyms[key]) return countryAcronyms[key];
    // Default: first 3 uppercase letters of the country name
    return country.slice(0, 3).toUpperCase();
  }

  // Country label (acronym, centered in top/bottom half)
  chart.selectAll("text.country-label")
    .data(cells)
    .enter()
    .append("text")
    .attr("class", "country-label")
    .attr("x", d => getX(d.col) + cellWidth / 2)
    .attr("y", d => getCellY(d.yearIdx, d.row) + (cellHeight / 4) - 8)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", d => getCountryTextColor(d.country))
    .text(d => getCountryAcronym(d.country));

  // Team label (centered in top/bottom half, below country)
  chart.selectAll("text.team-label")
    .data(cells)
    .enter()
    .append("text")
    .attr("class", "team-label")
    .attr("x", d => getX(d.col) + cellWidth / 2)
    .attr("y", d => getCellY(d.yearIdx, d.row) + (cellHeight / 4) + 8)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("fill", d => getCountryTextColor(d.country))
    .text(d => {
      // Only for the first year (yearIdx === 0)
      if (d.yearIdx === 0) {
        if (d.row === 0) return `${d.team} [W]`;
        if (d.row === 1) return `${d.team} [R]`;
      }
      return d.team;
    });

  // Calculate total width needed for all columns
  const totalColumns = competitions.length;
  const totalWidth = totalColumns * cellWidth + (totalColumns - 1) * cellPadding;

  // Calculate total height needed for all rows (years)
  const totalRows = years.length;
  const totalHeight = totalRows * (cellHeight + cellPadding);

  // Update SVG and chart size dynamically
  const svgWidth = totalWidth + margin.left + margin.right;
  const svgHeight = totalHeight + margin.top + margin.bottom;

  svg
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
    .style("border", "1px solid #ffffff2b");

  // Center between columns
  const centerCol = (competitions.length - 1) / 2;
  const xAxis = getX(centerCol) + cellWidth / 2;

  // Calculate the vertical start and end for the y-axis line
  const yAxisTop = cellHeight / 2;
  const yAxisBottom = totalRows * (cellHeight + cellPadding) - cellHeight / 2;

  chart.append("line")
    .attr("x1", xAxis)
    .attr("x2", xAxis)
    .attr("y1", yAxisTop)
    .attr("y2", yAxisBottom)
    .attr("stroke", "#bbb")
    .attr("stroke-width", 1)
    .attr("opacity", 0.3);


  // Draw year labels and backgrounds, centered
  years.forEach((year, yearIdx) => {
    const centerCol = (competitions.length - 1) / 2;
    const x = getX(centerCol) + cellWidth / 2;
    const y = yearIdx * (cellHeight + cellPadding) + cellHeight / 2;
    const rectWidth = 40;
    const rectHeight = 25;

    // Draw background rectangle
    chart.append("rect")
      .attr("x", x - rectWidth / 2)
      .attr("y", y - rectHeight / 2)
      .attr("width", rectWidth)
      .attr("height", rectHeight)
      .attr("rx", 2)
      .attr("fill", "#0F1826")
      .attr("opacity", 0.85);

    // Draw year label text
    chart.append("text")
      .attr("class", "y-year-label")
      .attr("x", x)
      .attr("y", y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("fill", "#999")
      .text(year);
  });

  // Add competition and role labels at the top
  competitions.forEach((comp, compIdx) => {
    chart.append("text")
      .attr("class", "x-label")
      .attr("x", getX(compIdx) + cellWidth / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("fill", "#999")
      .text(comp);
  });
}
