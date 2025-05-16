// /Users/gracedice/Desktop/IR/Project/script.js
import { decades } from './decades-config.js';

document.addEventListener('DOMContentLoaded', () => {
  // Populate decade dropdown
  const decadeFilter = document.getElementById('decade-filter');
  decadeFilter.innerHTML = '<option value="all">All Decades</option>' + 
    decades.map(d => `<option value="${d.decade}">${d.decade}</option>`).join('');

  // Initialize TimelineJS
  function renderTimeline(data) {
    try {
      new TL.Timeline('timeline', data, {
        height: 600,
        default_bg_color: '#f4f4f4',
        timenav_height: 150,
        date_display: 'full'
      });
    } catch (error) {
      console.error('TimelineJS failed to initialize:', error);
      document.getElementById('timeline').innerHTML = '<p>Error loading timeline. Please try again.</p>';
    }
  }

  // Load data for a specific decade
  async function loadDecadeData(decade) {
    let data;
    try {
      const response = await fetch(`/api/events?decade=${decade}`);
      if (!response.ok) {
        throw new Error('Error fetching events');
      }
      data = await response.json();
    } catch (error) {
      console.error('Error loading decade data:', error);
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
      currentData = { decade, data: await loadDecadeData(decade) };
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
      events: filteredEvents.length ? filteredEvents : currentData.data.events
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