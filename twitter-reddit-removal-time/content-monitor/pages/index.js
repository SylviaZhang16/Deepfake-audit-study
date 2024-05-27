import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [urls, setUrls] = useState(['']);
  const [logs, setLogs] = useState({});
  const [isValidUrls, setIsValidUrls] = useState([true]);
  const [postDetails, setPostDetails] = useState({});
  const [error, setError] = useState({});
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
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

    try {
      const response = await fetch('/api/fetch-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.status === 'error') {
        setPostDetails((prev) => {
          const newPostDetails = { ...prev };
          delete newPostDetails[url];
          return newPostDetails;
        });
        setError((prev) => ({ ...prev, [url]: data.message }));
        return false;
      } else {
        setPostDetails((prev) => ({ ...prev, [url]: data }));
        setError((prev) => ({ ...prev, [url]: '' }));
        return !data.is_deleted;
      }
    } catch (error) {
      console.error('Error checking post status:', error);
      setPostDetails((prev) => {
        const newPostDetails = { ...prev };
        delete newPostDetails[url];
        return newPostDetails;
      });
      setError((prev) => ({ ...prev, [url]: 'Failed to check post status' }));
      return false;
    }
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
      const response = await fetch('/api/reddit-login-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      if (data.error) {
        setError(data.error);
        setMetrics([]);
      } else {
        setMetrics(data.metrics || []);
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
        <title>Reddit Monitoring</title>
        <meta name="description" content="Monitor Reddit posts" />
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
        <img src="/logo.png" alt="Logo" width={200} height={200} className="logo" />
        <form onSubmit={handleSubmit}>
          <div>
            <p>Please enter the url of all posts created by this user at once.</p>
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

        {urls.map((url, index) => (
          <div key={index}>
            <div id="log">
              <pre>{logs[url]}</pre>
            </div>
            {postDetails[url] && (
              <div className="post-details">
                <h2>Post Details for {url}</h2>
                <p><strong>Title:</strong> {postDetails[url].title}</p>
                <p><strong>Post ID:</strong> {postDetails[url].post_id}</p> 
                <p><strong>Author:</strong> {postDetails[url].author}</p>
                <p><strong>Created:</strong> {new Date(postDetails[url].created_utc * 1000).toLocaleString()}</p>
                <p><strong>Subreddit:</strong> {postDetails[url].subreddit}</p>
                <p><strong>Status:</strong> {postDetails[url].is_deleted ? 'Deleted or Removed by a Moderator' : 'Available'}</p>
                {loading && <p>Loading metrics...</p>}
                {metrics && metrics.find(m => m.postID === postDetails[url].post_id) ? (
                  <div>
                    <h3>Metrics</h3>
                    <p><strong>Time of scraping:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).scrapeTime}</p>
                    <p><strong>Views:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numViews}</p>
                    <p><strong>Upvotes:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numUpvotes}</p>
                    <p><strong>Comments:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numComments}</p>
                    <p><strong>XPosts:</strong> {metrics.find(m => m.postID === postDetails[url].post_id).numXPosts}</p>
                  </div>
                ) : (
                  <p>This post may not be created by this user.</p>
                )}
              </div>
            )}
            {/* {error[url] && <div className="error">{error[url]}</div>} */}
            {!isValidUrls[index] && <div className="error">Invalid URL. Please enter a valid post URL.</div>}
          </div>
        ))}

      </main>
      <footer className="footer">
        <p>&copy; 2024 </p>
      </footer>
    </div>
  );
}
