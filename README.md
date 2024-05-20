# Deepfake Audit Study

## Scraping Instructions

This part contains tools for scraping post metrics from Reddit and Twitter. Follow the instructions below to set up and use the scrapers.

1. Navigate to the root directory containing `reddit-scraper.py` or `twitter-scraper.py` .
2. Run the script:
   ```bash
   python3 reddit-scraper.py
   ```
   or
   ```bash
   python3 twitter-scraper.py
   ```
3. Input your Reddit credentials when prompted. Alternatively, you can copy and modify the script to use your own account secrets, but ensure you protect your information.
4. Then The scrapers will run in headless mode to minimize resource usage. The resulting metrics will be saved in the `/data` subfolder, named by the username (Reddit) or the post id (Twitter).

## Notes

1. If you are working on someone else's code or are unsure about your modifications, follow this practice:
   - Create a branch
   - Commit your changes
   - Make a pull request
   - Undergo code review & Resolve any conflicts
   - Merge the changes
