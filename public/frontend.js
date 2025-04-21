document.addEventListener('DOMContentLoaded', () => {
    const urlsTextarea = document.getElementById('urls');
    const scrapeButton = document.getElementById('scrapeButton');
    const resultsArea = document.getElementById('resultsArea');
    const loadingIndicator = document.getElementById('loading');
    const storageKey = 'scrapedResults'; // Key for localStorage

    // --- Function to load and display results from localStorage ---
    function loadAndDisplayStoredResults() {
        const storedResults = localStorage.getItem(storageKey);
        if (storedResults) {
            console.log('Found stored results. Displaying...');
            try {
                const results = JSON.parse(storedResults);
                displayResults(results);
            } catch (error) {
                console.error('Error parsing stored results:', error);
                resultsArea.innerHTML = `<p class="error-message">Could not load previously saved results. They might be corrupted.</p>`;
                localStorage.removeItem(storageKey); // Clear corrupted data
            }
        } else {
            // Initial message if nothing is stored
            resultsArea.innerHTML = '<p>Enter URLs above and click "Scrape Websites" to see results. Previously scraped data will be saved here.</p>';
        }
    }

    // --- Function to display results (mostly unchanged) ---
    function displayResults(results) {
        if (!results || results.length === 0) {
            resultsArea.innerHTML = '<p>No results found or provided.</p>';
            return;
        }

        resultsArea.innerHTML = ''; // Clear previous results or placeholder text

        results.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.classList.add('result-item');

            // Ensure result object exists and has expected properties
            const url = result?.url || 'Unknown URL';
            const status = result?.status || 'unknown';
            const records = result?.records || [];
            const errorMsg = result?.error || 'Unknown error';

            let content = `<h3>${url}</h3>`; // Use safeUrl
            content += `<p>Status: <span class="status-${status}">${status}</span></p>`; // Use safeStatus

            if (status === 'success') {
                if (records.length > 0) {
                    content += `<p>Found ${records.length} record(s):</p>`;
                    content += '<ul>';
                    records.slice(0, 10).forEach(record => { // Limit displayed records per URL for brevity
                        content += '<li>';
                        for (const key in record) {
                            // Basic sanitation - replace < and > to prevent HTML injection
                            const safeValue = String(record[key] ?? '').replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            const safeKey = String(key).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            content += `<strong>${safeKey}:</strong> ${safeValue}<br>`;
                        }
                        content += '</li>';
                    });
                     if (records.length > 10) {
                         content += `<li>... and ${records.length - 10} more</li>`;
                     }
                    content += '</ul>';
                } else {
                    content += '<p>No records found or extracted for this URL.</p>';
                }
            } else { // status === 'failed' or unknown
                const safeError = String(errorMsg).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                content += `<p class="error-message">Error: ${safeError}</p>`;
            }

            resultDiv.innerHTML = content;
            resultsArea.appendChild(resultDiv);
        });
    }

    // --- Event Listener for the Scrape Button ---
    scrapeButton.addEventListener('click', async () => {
        const urls = urlsTextarea.value
            .split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://'))); // Basic URL validation

        if (urls.length === 0) {
            resultsArea.innerHTML = '<p class="error-message">Please enter at least one valid URL (starting with http:// or https://).</p>';
            return;
        }

        loadingIndicator.classList.remove('hidden');
        resultsArea.innerHTML = ''; // Clear results area before new scrape
        scrapeButton.disabled = true;

        try {
            const response = await fetch('/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ urls: urls }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(`Server error: ${response.status} ${response.statusText} - ${errorData.error || ''}`);
            }

            const results = await response.json();

            // --- Save results to localStorage ---
            try {
                localStorage.setItem(storageKey, JSON.stringify(results));
                console.log('Results saved to localStorage.');
            } catch (storageError) {
                console.error('Error saving results to localStorage:', storageError);
                // Optionally notify the user that results couldn't be saved
                resultsArea.insertAdjacentHTML('beforeend', '<p class="error-message">Note: Could not save results for next session (localStorage error).</p>');
            }
            // --- End of saving ---

            // Display the fresh results
            displayResults(results);

        } catch (error) {
            console.error('Error fetching scrape results:', error);
            resultsArea.innerHTML = `<p class="error-message">An error occurred during scraping: ${error.message}</p>`;
            // Optionally clear stored results on error? Or leave them? Leaving them for now.
        } finally {
            loadingIndicator.classList.add('hidden');
            scrapeButton.disabled = false;
        }
    });

    // --- Load any stored results when the page loads ---
    loadAndDisplayStoredResults();

}); // End of DOMContentLoaded
