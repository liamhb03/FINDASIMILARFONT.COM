const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  // Create font-photos directory if it doesn't exist
  const outputDir = path.join(__dirname, 'font-photos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1200, height: 800 }
  });
  
  const page = await browser.newPage();
  
  // Navigate to the website
  console.log('Navigating to findasimilarfont.com...');
  await page.goto('https://findasimilarfont.com/', { 
    waitUntil: 'networkidle2',
    timeout: 60000
  });
  
  // Wait for the font list to load
  await page.waitForSelector('#fontList', { timeout: 60000 });
  console.log('Page loaded successfully');
  
  // Get all font preview elements
  const fontPreviews = await page.$$('#fontList .font-preview');
  console.log(`Found ${fontPreviews.length} font previews`);
  
  // Process each font preview
  for (let i = 0; i < fontPreviews.length; i++) {
    const preview = fontPreviews[i];
    
    // Get the font name
    const fontNameElement = await preview.$('.font-medium.text-lg');
    const fontName = await page.evaluate(el => el.textContent.trim(), fontNameElement);
    
    // Sanitize the font name for use as a filename
    const sanitizedFontName = fontName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    // Get the paragraph element (sample text)
    const paragraphElement = await preview.$('p.sample-text');
    
    if (paragraphElement) {
      console.log(`Taking screenshot of "${fontName}" (${i+1}/${fontPreviews.length})`);
      
      // Take screenshot of just the paragraph element
      const screenshot = await paragraphElement.screenshot({
        path: path.join(outputDir, `${sanitizedFontName}.png`),
        omitBackground: false
      });
      
      console.log(`Saved screenshot for "${fontName}"`);
    } else {
      console.log(`Could not find sample text element for "${fontName}"`);
    }
  }
  
  await browser.close();
  console.log('Done! All screenshots saved to the font-photos directory.');
}

captureScreenshots().catch(error => {
  console.error('An error occurred:', error);
  process.exit(1);
});