// Define the decades you want to include
const decadeRanges = [
  [1400, 1690, 10], // From 1400 to 1690 in steps of 10 (1400s, 1410s, ...)
  [1700, 1990, 10], // From 1700 to 1990
  [2000, 2010, 10], // From 2000 to 2010
];

// Generate the decade strings dynamically
const decades = [];

for (const [start, end, step] of decadeRanges) {
  for (let year = start; year <= end; year += step) {
    const decade = `${year}s`;
    try {
      // Dynamically import the data file
      const data = require(`./years/data-${decade}.js`).timelineData;
      decades.push({ decade, data });
    } catch (error) {
      console.warn(`Data for ${decade} not found.`);
    }
  }
}

export { decades };
