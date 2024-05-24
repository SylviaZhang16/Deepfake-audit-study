import time
import json
import csv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def get_twitter_post_metrics(post_url):
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument(f'user-agent={user_agent}')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('--disable-blink-features=AutomationControlled')
    
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    
    driver.execute_cdp_cmd('Network.setUserAgentOverride', {"userAgent": user_agent})
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    try:
        driver.get('https://twitter.com/login')
        time.sleep(5)

        email_input_xpath = '//*[@id="layers"]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div/div/div/div[4]/label/div/div[2]/div/input'
        username_input_xpath = '//*[@id="layers"]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div[1]/div/div[2]/label/div/div[2]/div/input'
        password_input_xpath = '//*[@id="layers"]/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div[2]/div[1]/div/div/div[3]/div/label/div/div[2]/div[1]/input'

        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH, email_input_xpath))).send_keys(email)
        driver.find_element(By.XPATH, email_input_xpath).send_keys(Keys.RETURN)
        time.sleep(2)

        try:
            username_element = WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH, username_input_xpath)))
            username_element.send_keys(username)
            driver.find_element(By.XPATH, username_input_xpath).send_keys(Keys.RETURN)
            time.sleep(2)
        except:
            print("Username input field not found. Skipping this step.")

        WebDriverWait(driver, 5).until(EC.presence_of_element_located((By.XPATH, password_input_xpath))).send_keys(password)
        driver.find_element(By.XPATH, password_input_xpath).send_keys(Keys.RETURN)
        time.sleep(5)

        driver.get(post_url)
        time.sleep(5)

        # driver.save_screenshot('twitter_post_page.png')

        user = post_url.split("/")[3]
        post_id = post_url.split("/")[5]

        
        # view_count_xpath = '//*[@id="react-root"]/div/div/div[2]/main/div/div/div/div/div/section/div/div/div[1]/div/div/article/div/div/div[3]/div[4]/div/div[1]/div/div[3]/span/div/span/span/span'  
        # reposts_xpath = '//div[@role="group"]//a[contains(@href, "retweets")]/div/span/span/span'
        # quotes_xpath = '//div[@role="group"]//a[contains(@href, "retweets/with_comments")]/div/span/span/span'
        # likes_xpath = '//div[@role="group"]//a[contains(@href, "likes")]/div/span/span/span'

        # view_count = driver.find_element(By.XPATH, view_count_xpath).text
        # reposts_number = driver.find_element(By.XPATH, reposts_xpath).text
        # quotes_number = driver.find_element(By.XPATH, quotes_xpath).text
        # likes_number = driver.find_element(By.XPATH, likes_xpath).text

        metrics_xpath = '//div[@role="group" and @aria-label]'
        metrics_element = driver.find_element(By.XPATH, metrics_xpath)
        aria_label = metrics_element.get_attribute('aria-label')
        # print(aria_label)

        metrics = {}
        for item in aria_label.split(','):
            key, value = item.strip().rsplit(' ', 1)
            metrics[value] = key

        view_count = metrics.get('views', '0')
        quotes_number = metrics.get('replies', '0')
        reposts_number = metrics.get('reposts', '0')
        likes_number = metrics.get('likes', '0')

        post_metrics = {
            "authorID": user,
            "tweetID": post_id,
            "numViews": view_count,
            "numComments": quotes_number,
            "numRetweets": reposts_number,
            "numLikes": likes_number
        }

        filename = f"data/{post_id}.csv"

        with open(filename, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=post_metrics.keys())

            writer.writeheader()
            writer.writerow(post_metrics)

        return post_metrics

    except Exception as e:
        print(f"An error occurred: {e}")
        return None
    finally:
        driver.quit()

if __name__ == "__main__":

    # TODO: read credentials from a csv file / environment variables
    # email = input("Enter Twitter email: ")
    # username = input("Enter Twitter username: ")
    # password = input("Enter Twitter password: ")
    # post_url = input("Enter post URL: ")

    email = 'sylviaboom16@gmail.com'
    username = 'BoomSylvia'
    password = 'test12345'
    post_url = 'https://x.com/sounderatheart/status/1792050822890831878' 

    # url for testing
    # post_url = 'https://x.com/sounderatheart/status/1792050822890831878'  

    post_metrics = get_twitter_post_metrics(post_url)
    if post_metrics:
        print(f"Post Metrics: {post_metrics}")
    else:
        print("Failed to retrieve post metrics")
