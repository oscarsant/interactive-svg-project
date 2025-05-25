// Import D3 - use the same pattern as your original code
// Simple approach - assume D3 is available globally or handle the import properly
// You'll need to load D3 in your HTML or handle the import in your main script

// Check if d3 is available
function getD3() {
	// If d3 is loaded globally (via script tag)
	if (typeof window !== "undefined" && window.d3) {
		return window.d3;
	}

	// If you're using ES modules, you'll need to pass d3 as a parameter
	throw new Error(
		"D3 library not found. Please ensure D3 is loaded before calling render."
	);
}

// Configuration constants
const CONFIG = {
	MARGIN: { top: 40, right: 20, bottom: 20, left: 20 },
	CELL: {
		WIDTH: 120,
		HEIGHT: 120,
		PADDING: 20,
		GAP_BETWEEN: 4,
		BORDER_RADIUS: 8,
		MIN_WIDTH: 120, // Reduced minimum
		MAX_WIDTH: 400, // Increased maximum
	},
	COLORS: {
		COUNTRY: {
			spain: "#8E0A27",
			italy: "#2C5DA1",
			england: "#ABB0B5",
			france: "#0B3767",
			germany: "#9F8137",
			default: "hwb(215 5% 90% / .9)",
		},
		TEXT: {
			spain: "#9F8137",
			italy: "#9FA3A8",
			england: "#932027",
			france: "#9F8137",
			germany: "#060A0F",
			default: "#54514F",
		},
		AXIS: "#bbb",
		YEAR_BG: "#0F1826",
		YEAR_TEXT: "#999",
	},
	COUNTRY_ACRONYMS: {
		spain: "ESP",
		italy: "ITA",
		england: "ENG",
		france: "FRA",
		germany: "GER",
	},
	ANIMATION: {
		DURATION: 800,
		DELAY: 50,
	},
};

// Global state for cleanup
let currentResizeListener = null;
const colorCache = new Map();

// Utility functions
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

function validateInputs({ data, mapping, element }) {
	if (!data || !Array.isArray(data)) {
		console.warn("Invalid data provided to render function");
		return false;
	}

	if (!element) {
		console.warn("No DOM element provided");
		return false;
	}

	if (!mapping || !mapping.rows || !mapping.columns) {
		console.warn("Invalid mapping object provided");
		return false;
	}

	return true;
}

function calculateDimensions(containerWidth, maxWidth, years) {
	// Use the full container width, only limit by maxWidth if specified
	const actualWidth = maxWidth
		? Math.min(containerWidth, maxWidth)
		: containerWidth;

	// Make cell width adaptive to fill the container better
	const availableWidth = actualWidth - CONFIG.MARGIN.left - CONFIG.MARGIN.right;
	const numberOfColumns = 2; // UCL and UEL
	const totalPadding = (numberOfColumns - 1) * CONFIG.CELL.PADDING;
	const adaptiveCellWidth = Math.max(
		CONFIG.CELL.MIN_WIDTH,
		(availableWidth - totalPadding) / numberOfColumns
	);

	// Calculate height based on number of years
	const totalRows = years ? years.length : 1;
	const calculatedHeight =
		CONFIG.MARGIN.top +
		CONFIG.MARGIN.bottom +
		totalRows * (CONFIG.CELL.HEIGHT + CONFIG.CELL.PADDING) -
		CONFIG.CELL.PADDING;

	return {
		actualWidth,
		cellWidth: adaptiveCellWidth,
		cellHeight: CONFIG.CELL.HEIGHT,
		cellPadding: CONFIG.CELL.PADDING,
		calculatedHeight,
	};
}

function getCountryColor(country) {
	const key = `color_${country}`;
	if (colorCache.has(key)) {
		return colorCache.get(key);
	}

	const color =
		CONFIG.COLORS.COUNTRY[country?.toLowerCase()] ||
		CONFIG.COLORS.COUNTRY.default;
	colorCache.set(key, color);
	return color;
}

function getCountryTextColor(country) {
	const key = `text_${country}`;
	if (colorCache.has(key)) {
		return colorCache.get(key);
	}

	const color =
		CONFIG.COLORS.TEXT[country?.toLowerCase()] || CONFIG.COLORS.TEXT.default;
	colorCache.set(key, color);
	return color;
}

function getCountryAcronym(country) {
	if (!country) return "";
	const key = country.toLowerCase();
	return CONFIG.COUNTRY_ACRONYMS[key] || country.slice(0, 3).toUpperCase();
}

function getX(compIdx, cellWidth, cellPadding) {
	return compIdx * (cellWidth + cellPadding);
}

function getCellY(yearIdx, row, cellHeight, cellPadding) {
	return (
		yearIdx * (cellHeight + cellPadding) +
		row * (cellHeight / 2) +
		(row === 1 ? CONFIG.CELL.GAP_BETWEEN : 0)
	);
}

function createCellsData(data, mapping, years, competitions) {
	const cells = [];

	years.forEach((year, yearIdx) => {
		competitions.forEach((comp, compIdx) => {
			// Find winner
			const winner = data.find(
				(d) =>
					d.competition === comp &&
					String(d[mapping.rows.value]) === year &&
					d.value === 2
			);
			if (winner) {
				cells.push({
					competition: comp,
					year,
					value: 2,
					team: winner[mapping.columns.value],
					country: winner.country,
					compIdx,
					yearIdx,
					row: 0,
					col: compIdx,
				});
			}

			// Find runner-up
			const runnerUp = data.find(
				(d) =>
					d.competition === comp &&
					String(d[mapping.rows.value]) === year &&
					d.value === 1
			);
			if (runnerUp) {
				cells.push({
					competition: comp,
					year,
					value: 1,
					team: runnerUp[mapping.columns.value],
					country: runnerUp.country,
					compIdx,
					yearIdx,
					row: 1,
					col: compIdx,
				});
			}
		});
	});

	return cells;
}

function renderCells(chart, cells, dimensions, d3) {
	const { cellWidth, cellHeight } = dimensions;

	// Use general update pattern for better performance
	const rects = chart
		.selectAll("rect.cell")
		.data(cells, (d) => `${d.competition}_${d.year}_${d.row}`);

	// Remove old rectangles
	rects
		.exit()
		.transition()
		.duration(CONFIG.ANIMATION.DURATION / 2)
		.style("opacity", 0)
		.remove();

	// Add new rectangles
	const rectsEnter = rects
		.enter()
		.append("rect")
		.attr("class", "cell")
		.attr("x", (d) => getX(d.col, cellWidth, CONFIG.CELL.PADDING))
		.attr("y", (d) =>
			getCellY(d.yearIdx, d.row, cellHeight, CONFIG.CELL.PADDING)
		)
		.attr("width", cellWidth)
		.attr("height", cellHeight / 2)
		.attr("rx", CONFIG.CELL.BORDER_RADIUS)
		.attr("ry", CONFIG.CELL.BORDER_RADIUS)
		.style("opacity", 0);

	// Update all rectangles (new + existing)
	rectsEnter
		.merge(rects)
		.transition()
		.duration(CONFIG.ANIMATION.DURATION)
		.delay((d, i) => i * CONFIG.ANIMATION.DELAY)
		.attr("fill", (d) => getCountryColor(d.country))
		.style("opacity", 1);
}

function renderLabels(chart, cells, dimensions) {
	const { cellWidth, cellHeight } = dimensions;

	// Country labels
	const countryLabels = chart
		.selectAll("text.country-label")
		.data(cells, (d) => `country_${d.competition}_${d.year}_${d.row}`);

	countryLabels.exit().remove();

	const countryEnter = countryLabels
		.enter()
		.append("text")
		.attr("class", "country-label")
		.style("opacity", 0);

	countryEnter
		.merge(countryLabels)
		.attr(
			"x",
			(d) => getX(d.col, cellWidth, CONFIG.CELL.PADDING) + cellWidth / 2
		)
		.attr(
			"y",
			(d) =>
				getCellY(d.yearIdx, d.row, cellHeight, CONFIG.CELL.PADDING) +
				cellHeight / 4 -
				8
		)
		.attr("text-anchor", "middle")
		.attr("dominant-baseline", "middle")
		.attr("fill", (d) => getCountryTextColor(d.country))
		.text((d) => getCountryAcronym(d.country))
		.transition()
		.duration(CONFIG.ANIMATION.DURATION)
		.delay((d, i) => i * CONFIG.ANIMATION.DELAY)
		.style("opacity", 1);

	// Team labels
	const teamLabels = chart
		.selectAll("text.team-label")
		.data(cells, (d) => `team_${d.competition}_${d.year}_${d.row}`);

	teamLabels.exit().remove();

	const teamEnter = teamLabels
		.enter()
		.append("text")
		.attr("class", "team-label")
		.style("opacity", 0);

	teamEnter
		.merge(teamLabels)
		.attr(
			"x",
			(d) => getX(d.col, cellWidth, CONFIG.CELL.PADDING) + cellWidth / 2
		)
		.attr(
			"y",
			(d) =>
				getCellY(d.yearIdx, d.row, cellHeight, CONFIG.CELL.PADDING) +
				cellHeight / 4 +
				8
		)
		.attr("text-anchor", "middle")
		.attr("dominant-baseline", "middle")
		.attr("fill", (d) => getCountryTextColor(d.country))
		.text((d) =>
			d.yearIdx === 0 ? `${d.team} [${d.row === 0 ? "W" : "R"}]` : d.team
		)
		.call(wrapText, cellWidth - 10) // Add text wrapping
		.transition()
		.duration(CONFIG.ANIMATION.DURATION)
		.delay((d, i) => i * CONFIG.ANIMATION.DELAY)
		.style("opacity", 1);
}

function wrapText(text, width) {
	text.each(function () {
		const text = d3.select(this);
		const words = text.text().split(/\s+/).reverse();
		let word;
		let line = [];
		let lineNumber = 0;
		const lineHeight = 1.1;
		const y = text.attr("y");
		const dy = parseFloat(text.attr("dy")) || 0;

		text.text(null);
		const tspan = text
			.append("tspan")
			.attr("x", text.attr("x"))
			.attr("y", y)
			.attr("dy", dy + "em");

		while ((word = words.pop())) {
			line.push(word);
			tspan.text(line.join(" "));
			if (tspan.node().getComputedTextLength() > width) {
				line.pop();
				tspan.text(line.join(" "));
				line = [word];
				const newTspan = text
					.append("tspan")
					.attr("x", text.attr("x"))
					.attr("y", y)
					.attr("dy", ++lineNumber * lineHeight + dy + "em")
					.text(word);
			}
		}
	});
}

function renderAxis(chart, years, competitions, dimensions) {
	const { cellWidth, cellHeight } = dimensions;
	const centerCol = (competitions.length - 1) / 2;
	const xAxis = getX(centerCol, cellWidth, CONFIG.CELL.PADDING) + cellWidth / 2;
	const yAxisTop = cellHeight / 2;
	const yAxisBottom =
		years.length * (cellHeight + CONFIG.CELL.PADDING) - cellHeight / 2;

	// Main axis line
	chart.selectAll("line.main-axis").remove();
	chart
		.append("line")
		.attr("class", "main-axis")
		.attr("x1", xAxis)
		.attr("x2", xAxis)
		.attr("y1", yAxisTop)
		.attr("y2", yAxisBottom)
		.attr("stroke", CONFIG.COLORS.AXIS)
		.attr("stroke-width", 1)
		.attr("opacity", 0.3);

	// Year labels
	const yearLabels = chart.selectAll("g.year-label").data(years);

	yearLabels.exit().remove();

	years.forEach((year, yearIdx) => {
		const x = getX(centerCol, cellWidth, CONFIG.CELL.PADDING) + cellWidth / 2;
		const y = yearIdx * (cellHeight + CONFIG.CELL.PADDING) + cellHeight / 2;
		const rectWidth = 40;
		const rectHeight = 25;

		const yearGroup = chart.selectAll(`g.year-${yearIdx}`).data([year]);
		const yearGroupEnter = yearGroup
			.enter()
			.append("g")
			.attr("class", `year-${yearIdx}`);

		yearGroupEnter
			.append("rect")
			.attr("x", x - rectWidth / 2)
			.attr("y", y - rectHeight / 2)
			.attr("width", rectWidth)
			.attr("height", rectHeight)
			.attr("rx", 2)
      .attr("ry", CONFIG.CELL.BORDER_RADIUS)
      .attr("rx", CONFIG.CELL.BORDER_RADIUS)
			.attr("fill", CONFIG.COLORS.YEAR_BG)
			.attr("opacity", 0.85);

		yearGroupEnter
			.append("text")
			.attr("class", "year-label")
			.attr("x", x)
			.attr("y", y)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "middle")
			.style("fill", CONFIG.COLORS.YEAR_TEXT)
			.text(year);
	});

	// Competition labels
	const compLabels = chart.selectAll("text.x-label").data(competitions);

	compLabels.exit().remove();

	compLabels
		.enter()
		.append("text")
		.attr("class", "x-label")
		.merge(compLabels)
		.attr(
			"x",
			(d, i) => getX(i, cellWidth, CONFIG.CELL.PADDING) + cellWidth / 2
		)
		.attr("y", -10)
		.attr("text-anchor", "middle")
		.style("fill", CONFIG.COLORS.YEAR_TEXT)
		.text((d) => d);
}

function setupResizeHandler(renderParams) {
	// Clean up existing listener
	if (currentResizeListener) {
		window.removeEventListener("resize", currentResizeListener);
	}

	// Create new debounced listener
	currentResizeListener = debounce(() => {
		const { element } = renderParams;
		if (element && element.clientWidth) {
			render({
				...renderParams,
				width: element.clientWidth,
			});
		}
	}, 250);

	window.addEventListener("resize", currentResizeListener);
}

export function render({
	data,
	mapping,
	visualOptions,
	width,
	height,
	element,
	maxWidth,
	d3: d3Instance,
}) {
	// Use passed d3 instance or try to get it globally
	const d3 = d3Instance || getD3();

	// Input validation
	if (!validateInputs({ data, mapping, element })) {
		return;
	}

	try {
		// Process data first to get years for height calculation
		const competitions = ["UCL", "UEL"].filter((c) =>
			data.some((d) => d.competition === c)
		);

		const years = Array.from(new Set(data.map((d) => d[mapping.rows.value])))
			.map(String)
			.sort();

		if (years.length === 0 || competitions.length === 0) {
			console.warn("No valid data found for visualization");
			return;
		}

		// Calculate dimensions with auto height - use passed width instead of element.clientWidth
		const dimensions = calculateDimensions(
			width || element.clientWidth,
			maxWidth,
			years
		);
		const { actualWidth, cellWidth, cellHeight, calculatedHeight } = dimensions;

		// Use calculated height instead of passed height
		const finalHeight = height || calculatedHeight;

		// Clear existing SVG
		d3.select(element).selectAll("svg").remove();

		// Create SVG with calculated height
		const svg = d3
			.select(element)
			.append("svg")
			.attr("width", actualWidth)
			.attr("height", finalHeight);

		const chart = svg
			.append("g")
			.attr(
				"transform",
				`translate(${CONFIG.MARGIN.left},${CONFIG.MARGIN.top})`
			);

		const cells = createCellsData(data, mapping, years, competitions);

		// Render components
		renderCells(chart, cells, dimensions, d3);
		renderLabels(chart, cells, dimensions, d3);
		renderAxis(chart, years, competitions, dimensions, d3);

		// Setup resize handling
		setupResizeHandler({
			data,
			mapping,
			visualOptions,
			width,
			height,
			element,
			maxWidth,
			d3: d3Instance,
		});
	} catch (error) {
		console.error("Error rendering visualization:", error);

		// Display error message to user
		d3.select(element).selectAll("*").remove();
		d3.select(element)
			.append("div")
			.style("color", "red")
			.style("padding", "20px")
			.text("Error rendering visualization. Please check console for details.");
	}
}

// Cleanup function (call this when component unmounts)
export function cleanup() {
	if (currentResizeListener) {
		window.removeEventListener("resize", currentResizeListener);
		currentResizeListener = null;
	}
	colorCache.clear();
}
