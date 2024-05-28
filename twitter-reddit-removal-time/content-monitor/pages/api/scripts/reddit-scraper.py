import time
import json
import csv
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime
import pytz

def get_reddit_posts_metrics(username, password):
    username = sys.argv[1]
    password = sys.argv[2]

    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    
    options = webdriver.ChromeOptions()
    # options.add_argument('--headless')
    options.add_argument(f'user-agent={user_agent}')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)

    try:
        driver.get('https://www.reddit.com/login/')
        time.sleep(2)
        
        driver.find_element(By.ID, 'login-username').send_keys(username)
        driver.find_element(By.ID, 'login-password').send_keys(password)
        driver.find_element(By.ID, 'login-password').send_keys(Keys.RETURN)
        time.sleep(5)

        driver.save_screenshot('after_login.png')

        profile_url = f'https://www.reddit.com/user/{username}/submitted/'
        driver.get(profile_url)
        time.sleep(5)

        trackers_xpath = '//*[@id="main-content"]//faceplate-tracker[@source="post_insights" and @action="view" and @noun="aggregate_stats"]'

        wait = WebDriverWait(driver, 5)
        tracker_elements = wait.until(EC.presence_of_all_elements_located((By.XPATH, trackers_xpath)))
        # print(f"Found {len(tracker_elements)} faceplate-tracker elements")

        posts_data = []

        for tracker_element in tracker_elements:
            try:
                data_faceplate_context = tracker_element.get_attribute('data-faceplate-tracking-context')
                data_context_json = json.loads(data_faceplate_context.replace('&quot;', '"'))
                post_id = data_context_json['action_info']['post_id'].split('_')[-1]
                subreddit_id = data_context_json['action_info']['subreddit_id'].split('_')[-1]

                views_xpath = './div[1]/div/faceplate-tooltip[1]/div/div'
                upvote_rate_xpath = './div[1]/div/faceplate-tooltip[2]/div/div'
                comments_xpath = './div[1]/div/faceplate-tooltip[3]/div/div'
                shares_xpath = './div[1]/div/faceplate-tooltip[4]/div/div'

                views = tracker_element.find_element(By.XPATH, views_xpath).text
                upvote_rate = tracker_element.find_element(By.XPATH, upvote_rate_xpath).text
                comments = tracker_element.find_element(By.XPATH, comments_xpath).text
                shares = tracker_element.find_element(By.XPATH, shares_xpath).text
                tz = pytz.timezone('America/New_York')
                current_time = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")

                post_data = {
                    "postID": post_id,
                    "subredditId": subreddit_id,
                    "scrapeTime": current_time,
                    "numViews": views,
                    "numUpvotes": upvote_rate,
                    "numComments": comments,
                    "numXPosts": shares
                }

                posts_data.append(post_data)

            except Exception as e:
                print(f"An error occurred while processing a post: {e}")

        fieldnames = ['postID', 'subredditId', 'numViews', 'numUpvotes', 'numComments', 'numXPosts']

        # # Writing to CSV
        # with open(f'reddit-data/{username}.csv', 'w', newline='') as f:
        #     writer = csv.DictWriter(f, fieldnames=fieldnames)

        #     writer.writeheader()
            
        #     for post in posts_data:
        #         writer.writerow(post)

        print(json.dumps(posts_data)) 

    except Exception as e:
        print(f"An error occurred: {e}")
        print(json.dumps({"error": str(e)})) 
    finally:
        driver.quit()

if __name__ == "__main__":
    get_reddit_posts_metrics(sys.argv[1], sys.argv[2])
    # TODO:read crencidentials from a csv file
    # username = input("Enter Reddit username: ")
    # password = input("Enter Reddit password: ")


    # posts_metrics = get_reddit_posts_metrics(username, password)
    # if posts_metrics:
    #     print(f"All Post Metrics: {posts_metrics}")
    # else:
    #     print("Failed to retrieve post metrics")
