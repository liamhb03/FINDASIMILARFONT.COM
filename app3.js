// Google Fonts Tag Scraper
// This script will scrape font metadata (tags) from Google Fonts pages and add them to a CSV file

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const puppeteer = require('puppeteer');

// File paths
const inputCsvPath = 'google_fonts.csv';
const outputCsvPath = 'google_fonts_with_tags.csv';

// Array to store font data
const fonts = [];

// Function to extract tags from a Google Fonts page
async function scrapeFontTags(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for chip elements to load
    await page.waitForSelector('.mdc-evolution-chip', { timeout: 10000 }).catch(() => {
      console.log(`No chip elements found on ${url}`);
    });
    
    // Extract tags from the chip elements
    const tags = await page.evaluate(() => {
      const chipElements = document.querySelectorAll('.mdc-evolution-chip__text-label');
      return Array.from(chipElements).map(chip => chip.textContent.trim());
    });
    
    // Filter tags to get only the ones we're interested in
    const relevantTags = tags.filter(tag => {
      return tag.includes('Feeling —') || 
             tag.includes('Appearance —') || 
             tag.includes('Calligraphy') || 
             tag.includes('Serif') || 
             tag.includes('Sans Serif') || 
             tag.includes('Seasonal');
    });
    
    return relevantTags;
  } catch (error) {
    console.error(`Error scraping ${url}: ${error.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// Function to process each font
async function processFonts() {
  const totalFonts = fonts.length;
  let processedCount = 0;
  
  // Process fonts in batches to avoid overwhelming the system
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < totalFonts; i += batchSize) {
    const batch = fonts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (font) => {
      console.log(`Processing ${processedCount + 1}/${totalFonts}: ${font.Name}`);
      
      try {
        // Check if the URL is valid
        if (!font.URL || !font.URL.startsWith('http')) {
          console.log(`Skipping ${font.Name}: Invalid URL`);
          return { ...font, Tags: '' };
        }
        
        // Scrape tags
        const tags = await scrapeFontTags(font.URL);
        processedCount++;
        
        console.log(`Found ${tags.length} tags for ${font.Name}: ${tags.join(', ')}`);
        return { ...font, Tags: tags.join('; ') };
      } catch (error) {
        console.error(`Error processing ${font.Name}: ${error.message}`);
        return { ...font, Tags: '' };
      }
    });
    
    // Wait for the current batch to complete
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return results;
}

// Main function
async function main() {
  console.log(`Reading font data from ${inputCsvPath}...`);
  
  // Read the input CSV
  await new Promise((resolve) => {
    fs.createReadStream(inputCsvPath)
      .pipe(csv())
      .on('data', (row) => {
        fonts.push(row);
      })
      .on('end', () => {
        console.log(`Found ${fonts.length} fonts in CSV file.`);
        resolve();
      });
  });
  
  // Process the fonts
  console.log('Starting to process fonts and scrape tags...');
  const processedFonts = await processFonts();
  
  // Determine headers dynamically
  const headers = Object.keys(processedFonts[0] || {}).map(key => {
    return { id: key, title: key };
  });
  
  // Write to the output CSV
  const csvWriter = createCsvWriter({
    path: outputCsvPath,
    header: headers
  });
  
  await csvWriter.writeRecords(processedFonts);
  console.log(`Done! Data written to ${outputCsvPath}`);
}

// Run the script
main().catch(error => {
  console.error('Error running script:', error);
  process.exit(1);
});