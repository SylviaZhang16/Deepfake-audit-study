import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Twitter() {
  const [urls, setUrls] = useState(['']);
  const [logs, setLogs] = useState({});
  const [isValidUrls, setIsValidUrls] = useState([true]);
  const [postDetails, setPostDetails] = useState({});
  const [error, setError] = useState({});
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [metrics, setMetrics] = useState([]); 
  const intervalRefs = useRef({});

  const validateUrl = (url) => url.includes('.com');

  const checkPostStatus = async (url, index) => {
    if (!validateUrl(url)) {
      setIsValidUrls((prev) => {
        const newIsValidUrls = [...prev];
        newIsValidUrls[index] = false;
        return newIsValidUrls;
      });
      setPostDetails((prev) => {
        const newPostDetails = { ...prev };
        delete newPostDetails[url];
        return newPostDetails;
      });
      return false;
    }

    setIsValidUrls((prev) => {
      const newIsValidUrls = [...prev];
      newIsValidUrls[index] = true;
      return newIsValidUrls;
    });

    // Skipping the fetch post details part as requested
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    fetchMetrics();

    urls.forEach((url, index) => {
      const isPostAvailable = checkPostStatus(url, index);
      if (!isPostAvailable) {
        alert(`The post at ${url} is either invalid or has been taken down.`);
        return;
      }

      setLogs((prev) => ({ ...prev, [url]: 'Monitoring started...\n' }));

      if (intervalRefs.current[url]) {
        clearInterval(intervalRefs.current[url]);
      }

      intervalRefs.current[url] = setInterval(async () => {
        const isPostAvailable = await checkPostStatus(url, index);
        if (!isPostAvailable) {
          setLogs((prev) => ({
            ...prev,
            [url]: (prev[url] || '') + 'The post has been deleted or removed by a moderator.\n',
          }));
          clearInterval(intervalRefs.current[url]);
        }
      }, 10000);
    });
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/twitter-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password, urls }),
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      console.log('Metrics:', data.metrics);
      if (data.error) {
        setError(data.error);
        setMetrics([]); 
      } else {
        setMetrics(data.metrics);
        setError(null);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setError('Failed to fetch metrics');
      setMetrics([]); 
    }
  };

  const handleUrlChange = (index, value) => {
    setUrls((prev) => {
      const newUrls = [...prev];
      newUrls[index] = value;
      return newUrls;
    });
  };

  const addUrlField = () => {
    setUrls((prev) => [...prev, '']);
    setIsValidUrls((prev) => [...prev, true]);
  };

  useEffect(() => {
    return () => {
      Object.keys(intervalRefs.current).forEach((url) => {
        clearInterval(intervalRefs.current[url]);
      });
    };
  }, []);

  return (
    <div className="container">
      <Head>
        <title>Twitter Monitoring</title>
        <meta name="description" content="Monitor Twitter posts" />
      </Head>
      <header className="header">
        <h1>Content Monitor</h1>
        <nav>
          <ul>
            <li><Link href="/">Reddit (Login)</Link></li>
            <li><Link href="/reddit-original">Reddit</Link></li>
            <li><Link href="/twitter">Twitter</Link></li>
          </ul>
        </nav>
      </header>
      <main>
        <img src="/Logo-Twitter.png" alt="Logo" width={200} height={200} className="logo" />
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">Email:</label>
            <input
              type="text"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="username">Username:</label>
            <input
              type="text"
              id="username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password">Password:</label>
            <input
              // type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {urls.map((url, index) => (
            <div key={index}>
              <label htmlFor={`url-${index}`}>Enter URL:</label>
              <input
                type="text"
                id={`url-${index}`}
                name={`url-${index}`}
                value={url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
                required
                className={isValidUrls[index] ? '' : 'invalid'}
              />
            </div>
          ))}
          <button type="button" onClick={addUrlField}>Add URL</button>
          <button type="submit">Start Monitoring</button>
        </form>
        {metrics && metrics.length > 0 && metrics.map((metric, index) => (
            <div key={index} className="metrics">
                <h2>Metrics for Tweet ID: {metric.tweetID}</h2>
                <p><strong>Time of scraping:</strong> {metric.scrapeTime ? metric.scrapeTime : "N/A"}</p>
                <p><strong>Author ID:</strong> {metric.authorID}</p>
                <p><strong>Views:</strong> {metric.numViews}</p>
                <p><strong>Comments:</strong> {metric.numComments}</p>
                <p><strong>Retweets:</strong> {metric.numRetweets}</p>
                <p><strong>Likes:</strong> {metric.numLikes}</p>
                <p><strong>Deleted:</strong> {metric.isDeleted ? `Yes, detected at ${metric.scrapeTime}` : 'No'}</p>
            </div>
        ))}
        {error && <div className="error">{error.toString()}</div>}
      </main>
      <footer className="footer">
        <p>&copy; 2024 </p>
      </footer>
    </div>
  );
}
