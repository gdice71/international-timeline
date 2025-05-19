document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contribute-form');
    const addSourceButton = document.getElementById('add-source');
    const sourcesContainer = document.getElementById('sources-container');
    let sourceCount = 1;
  
    // Add new source fields dynamically
    addSourceButton.addEventListener('click', () => {
      const sourceDiv = document.createElement('div');
      sourceDiv.className = 'source';
      sourceDiv.innerHTML = `
        <label>URL:</label>
        <input type="url" name="source-url-${sourceCount}" required>
        <label>Title:</label>
        <input type="text" name="source-title-${sourceCount}">
        <label>Summary:</label>
        <textarea name="source-summary-${sourceCount}"></textarea>
        <label>Relevance:</label>
        <textarea name="source SharePoint</textarea>
        <label>Relevance:</label>
        <textarea name="source-relevance-${sourceCount}"></textarea>
        <button type="button" class="remove-source">Remove</button>
      `;
      sourcesContainer.appendChild(sourceDiv);
      sourceCount++;
  
      // Handle remove source
      sourceDiv.querySelector('.remove-source').addEventListener('click', () => {
        sourcesContainer.removeChild(sourceDiv);
      });
    });
  
    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const primarySources = [];
  
      // Collect source data
      for (let i = 0; i < sourceCount; i++) {
        const url = formData.get(`source-url-${i}`);
        if (url) {
          primarySources.push({
            url,
            title: formData.get(`source-title-${i}`) || '',
            summary: formData.get(`source-summary-${i}`) || '',
            relevance: formData.get(`source-relevance-${i}`) || ''
          });
        }
      }
  
      const eventData = {
        headline: formData.get('headline'),
        description: formData.get('description'),
        date: formData.get('date'),
        region: formData.get('region'),
        category: formData.get('category'),
        imageUrl: formData.get('image-url') || '',
        summary: formData.get('summary') || '',
        primarySources
      };
  
      try {
        const response = await fetch('/api/submit-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        });
        const result = await response.json();
        document.getElementById('form-message').textContent = response.ok
          ? 'Event submitted successfully!'
          : `Error: ${result.message}`;
      } catch (error) {
        document.getElementById('form-message').textContent = 'Error submitting event.';
        console.error('Submission error:', error);
      }
    });
  });