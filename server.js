/**
 * server.js
 * Backend server for the web scraper.
 * To run: node server.js
 */

const express = require('express');
const cors = require('cors'); // Import CORS middleware
const cheerio = require('cheerio');

const app = express();
const port = 3000; // Port the server will listen on

// --- Middleware ---
// Enable CORS for all origins (simplest setup, adjust for production)
app.use(cors());
// Enable parsing of JSON request bodies
app.use(express.json());
// Serve static files (like index.html, frontend.js, styles.css) from a 'public' directory
app.use(express.static('public')); // We'll create this directory later

/**
 * Scrapes structured records from a single URL.
 * (Keep this function largely the same as before, maybe remove console.logs
 *  as feedback will go back to the frontend)
 *
 * @param {string} url - The URL to scrape.
 * @returns {Promise<object>} - Resolves with scraped data or error info.
 */
async function scrapeUrl(url) {
  // console.log(`Attempting to scrape records from: ${url}`); // Optional: Keep for server logs
  try {
    // Use a timeout for fetch to prevent hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId); // Clear timeout if fetch completes

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const records = [];

    // --- Site-Specific Record Scraping Logic ---
    if (url.includes('books.toscrape.com')) {
        $('article.product_pod').each((index, element) => {
            const bookArticle = $(element);
            const title = bookArticle.find('h3 a').attr('title');
            const relativeLink = bookArticle.find('h3 a').attr('href');
            const price = bookArticle.find('.product_price .price_color').text();
            const absoluteLink = relativeLink ? new URL(relativeLink, url).href : null;

            if (title && price && absoluteLink) {
                 records.push({
                    title: title.trim(),
                    price: price.trim(),
                    link: absoluteLink
                 });
            }
        });
        // console.log(`Found ${records.length} book records on ${url}`); // Optional server log
    }
    // Add other 'else if' blocks for different sites here
    else {
        // console.warn(`No specific record scraping logic defined for ${url}.`); // Optional server log
        // Maybe add a generic scrape attempt here?
        const genericTitle = $('h1').first().text().trim();
        if (genericTitle) {
            records.push({ title: genericTitle, source: 'Generic H1 scrape' });
        }
    }
    // --- End of Site-Specific Logic ---

    return {
      url: url,
      status: 'success',
      records: records
    };

  } catch (error) {
    // console.error(`Error scraping ${url}:`, error.message); // Optional server log
    return {
        url: url,
        status: 'failed',
        // Distinguish between fetch errors and other errors
        error: error.name === 'AbortError' ? 'Request timed out' : error.message
    };
  }
}

// --- API Endpoint ---
app.post('/scrape', async (req, res) => {
  console.log('Received /scrape request');
  const urls = req.body.urls; // Expect an array of URLs in the request body

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of URLs in the request body.' });
  }

  // Use Promise.allSettled to scrape all URLs concurrently
  const scrapePromises = urls.map(url => scrapeUrl(url));
  const results = await Promise.allSettled(scrapePromises);

  // Process results to send back a clean JSON response
  const responseData = results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value; // This is the object returned by scrapeUrl (success or handled failure)
    } else {
      // This catches unexpected errors within scrapeUrl or the Promise machinery itself
      console.error("Unexpected scraping error:", result.reason);
      // Try to find the URL if possible (might not be available if error is early)
      // This part is tricky as the original URL isn't directly in result.reason
      return {
          url: 'Unknown URL (unexpected error)', // Placeholder
          status: 'failed',
          error: result.reason?.message || 'An unexpected error occurred during scraping.'
      };
    }
  });

  console.log('Sending scrape results back to client.');
  res.json(responseData); // Send the array of results back to the frontend
});

// --- Start the server ---
app.listen(port, () => {
  console.log(`Scraper server listening at http://localhost:${port}`);
  console.log(`Frontend should be accessible at http://localhost:${port}`);
});
