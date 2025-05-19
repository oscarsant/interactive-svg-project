import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function render({ data, mapping, visualOptions, width, height, element, maxWidth }) {
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Remove any previous SVG
  d3.select(element).selectAll("svg").remove();

  // Responsive SVG: use viewBox and width: 100%
  const svg = d3.select(element)
    .append("svg")
    // .attr("width", width)
    // .attr("height", height)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .style("width", "100%")
    .style("height", "auto")
    .style("max-width", maxWidth ? `${maxWidth}px` : "600px")
    .style("border", "1px solid #ccc");

  const chart = svg.append("g")
    .attr("class", "matrixplot-chart")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Force competitions order: UCL left, UEL right
  const competitions = ["UCL", "UEL"].filter(c => data.some(d => d.competition === c));
  const years = Array.from(new Set(data.map(d => d[mapping.rows.value])))
    .map(String)
    .sort();

  // For each year, show UCL and UEL side by side (not stacked)
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
          row: 0 // winner row (top)
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
          row: 1 // runner-up row (bottom)
        });
      }
    });
  });

  // Layout: x = competitions × 2 (winner, runner-up), y = years
  const cellWidth = 100;
  const cellHeight = 40;
  const cellPadding = 8;

  // Color scale for country
  const countries = Array.from(new Set(data.map(d => d.country))).sort();
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(countries);

  // Helper to get x position: [UCL-winner, UCL-runner, UEL-winner, UEL-runner]
  function getX(compIdx, row) {
    return (compIdx * 2 + row) * (cellWidth + cellPadding);
  }

  // Draw rectangles (horizontal layout)
  chart.selectAll("rect")
    .data(cells)
    .enter()
    .append("rect")
    .attr("x", d => getX(d.compIdx, d.row))
    .attr("y", d => d.yearIdx * (cellHeight + cellPadding))
    .attr("width", cellWidth)
    .attr("height", cellHeight)
    .attr("fill", d => colorScale(d.country))
    .attr("stroke", "#fff");

  // Team label inside rectangle
  chart.selectAll("text.team-label")
    .data(cells)
    .enter()
    .append("text")
    .attr("class", "team-label")
    .attr("x", d => getX(d.compIdx, d.row) + cellWidth / 2)
    .attr("y", d => d.yearIdx * (cellHeight + cellPadding) + cellHeight / 2 - 4)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", "1em") // for team label
    .style("font-weight", d => d.value === 2 ? "bold" : "normal")
    .style("fill", "#fff")
    .text(d => d.team);

  // Country label below team
  chart.selectAll("text.country-label")
    .data(cells)
    .enter()
    .append("text")
    .attr("class", "country-label")
    .attr("x", d => getX(d.compIdx, d.row) + cellWidth / 2)
    .attr("y", d => d.yearIdx * (cellHeight + cellPadding) + cellHeight / 2 + 8)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .style("font-size", "0.82em") // for country label
    .style("fill", "#fff")
    .text(d => d.country);

  // Calculate total width needed for all columns
  const totalColumns = competitions.length * 2; // 2 columns per competition (winner, runner-up)
  const totalWidth = totalColumns * (cellWidth + cellPadding);

  // Calculate total height needed for all rows (years)
  const totalRows = years.length;
  const totalHeight = totalRows * (cellHeight + cellPadding);

  // Update SVG and chart size dynamically
  // svg.attr("width", totalWidth + margin.left + margin.right);
  // svg.attr("height", totalHeight + margin.top + margin.bottom);
  svg.attr("viewBox", `0 0 ${totalWidth + margin.left + margin.right} ${totalHeight + margin.top + margin.bottom}`);
  chart.attr("width", totalWidth);
  chart.attr("height", totalHeight);

  // Update x position for year labels in the middle
  years.forEach((year, yearIdx) => {
    chart.append("text")
      .attr("class", "y-year-label")
      .attr(
        "x",
        totalWidth / 2 // center of all columns
      )
      .attr("y", yearIdx * (cellHeight + cellPadding) + cellHeight / 2)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "1.27em") // for year label
      .style("font-weight", "bold")
      .style("fill", "#222")
      .text(year);
  });

  // Add competition and role labels at the top
  ["UCL", "UEL"].forEach((comp, compIdx) => {
    ["Winner", "Runner-up"].forEach((role, row) => {
      chart.append("text")
        .attr("class", "x-label")
        .attr("x", getX(compIdx, row) + cellWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "1.1em") // for x-label
        .style("font-weight", "bold")
        .style("fill", "#222")
        .text(`${comp} ${role}`);
    });
  });
}
