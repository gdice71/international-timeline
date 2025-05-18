import { decades } from './decades.js';

document.addEventListener('DOMContentLoaded', () => {
  // Populate decade dropdown
  const decadeFilter = document.getElementById('decade-filter');
  decadeFilter.innerHTML = '<option value="all">All Decades</option>' + 
    decades.map(d => `<option value="${d.decade}">${d.decade}</option>`).join('');

  // Initialize TimelineJS
  function renderTimeline(data) {
    try {
      // Ensure there is at least one event to avoid TimelineJS error
      if (!data.events || data.events.length === 0) {
        data.events = [{
          text: { headline: "No Events", text: "No events match the current filters." },
          start_date: { year: "2025" }
        }];
      }
      new TL.Timeline('timeline', data, {
        height: 600,
        default_bg_color: '#f4f4f4',
        timenav_height: 150,
        date_display: 'full' // Display full dates (e.g., "October 16, 1962") when month and day are available
      });
    } catch (error) {
      console.error('TimelineJS failed to initialize:', error);
      document.getElementById('timeline').innerHTML = '<p>Error loading timeline. Please try again.</p>';
    }
  }

  // Load data for a specific decade
  function loadDecadeData(decade) {
    let data;
    try {
      if (decade === 'all') {
        // Combine events from all decades
        data = {
          title: decades[0]?.data?.title || { text: { headline: 'International Relations Timeline', text: '' } },
          events: decades.flatMap(d => d.data?.events || [])
        };
      } else {
        const decadeConfig = decades.find(d => d.decade === decade);
        if (!decadeConfig) {
          throw new Error(`Decade ${decade} not found in config`);
        }
        data = decadeConfig.data;
      }
    } catch (error) {
      console.error('Error loading decade data:', error);
      // Fallback data to prevent timeline crash
      data = {
        title: { text: { headline: 'International Relations Timeline', text: 'Error loading events.' } },
        events: []
      };
    }
    return data;
  }

  // Filtering and Search
  const regionFilter = document.getElementById('region-filter');
  const categoryFilter = document.getElementById('category-filter');
  const monthFilter = document.getElementById('month-filter');
  const searchInput = document.getElementById('search');

  let currentData = null;

  async function updateTimeline() {
    const decade = decadeFilter.value;
    const region = regionFilter.value;
    const category = categoryFilter.value;
    const month = monthFilter ? monthFilter.value : '';
    const search = searchInput.value.toLowerCase();

    // Load data if decade changes or first load
    if (!currentData || currentData.decade !== decade) {
      currentData = { decade, data: loadDecadeData(decade) };
    }

    const filteredEvents = currentData.data.events.filter(event => {
      const matchesRegion = !region || event.group === region;
      const matchesCategory = !category || event.category === category;
      const matchesMonth = !month || (event.start_date && event.start_date.month === month);
      const matchesSearch = !search || 
        event.text.headline.toLowerCase().includes(search) || 
        event.text.text.toLowerCase().includes(search);
      return matchesRegion && matchesCategory && matchesMonth && matchesSearch;
    });

    const newData = {
      title: currentData.data.title,
      events: filteredEvents
    };

    renderTimeline(newData);
  }

  // Load all events by default
  updateTimeline();

  // Event listeners
  decadeFilter.addEventListener('change', updateTimeline);
  regionFilter.addEventListener('change', updateTimeline);
  categoryFilter.addEventListener('change', updateTimeline);
  if (monthFilter) {
    monthFilter.addEventListener('change', updateTimeline);
  }
  searchInput.addEventListener('input', updateTimeline);
});